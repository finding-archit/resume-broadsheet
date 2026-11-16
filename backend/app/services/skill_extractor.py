"""Dictionary-based skill extraction with alias normalization.

How matching works
------------------
* Every skill has a canonical name plus aliases (``data/skills.json``).
* Aliases are compiled into regular expressions with *technical-term
  boundaries* instead of ``\\b``. ``\\b`` treats "+" and "#" as boundaries, so
  a naive ``\\bC\\b`` would match the "C" in "C++" and "C#". Our boundaries
  forbid letters, digits, "+", "#" and "." on either side, which means
  "Java" does not match inside "JavaScript", "C" does not match "C++", and
  "JS" does not match the "js" in "Node.js".
* Short or ambiguous names (C, R, Go, ML, AI, Swift, Excel ...) are listed
  as ``exact_aliases`` and matched case-sensitively, so the verb "go" or the
  letter "c" in ordinary text is not counted as a skill.
* One-letter exact aliases (C, R) are rejected when they look like a
  person's middle or first initial: "Priya R. Sharma", "R. Verma".
* Skills flagged ``"ambiguous": true`` (Swift, Express, Go, Spark, Excel) have
  exact aliases that are also ordinary English words. Such a mention only
  counts with technical context: inside a list ("Languages: Go, R"), after a
  word such as "in" / "with" / "using" ("services in Go"), or before a
  technical noun ("Spark streaming", "Excel formulas"). "Spark joy" and
  "Excel at teamwork" are therefore not skills.
* Overlapping matches are resolved longest-first with an occupied-character
  bitmap, so "SQL Server" is one mention of Microsoft SQL Server rather than
  also a mention of SQL, in linear time in the text length. Before running a
  skill's regex, a plain substring test on the first word of each alias skips
  skills that cannot occur in the text at all.
* Negation: a mention preceded in the same clause by a cue such as "no
  experience with", "never used" or "without" is flagged as negated. Negated
  mentions are reported (so the UI can show them) but never counted.
* ``implies`` adds closely related skills (e.g. PostgreSQL implies SQL).
  Implied skills are flagged so the UI can show they were inferred.
"""

import json
import re
from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

from app.config import settings

# Implied skills: knowing the key reasonably demonstrates the values.
IMPLIED_SKILLS = {
    "MySQL": ["SQL"],
    "PostgreSQL": ["SQL"],
    "SQLite": ["SQL"],
    "Microsoft SQL Server": ["SQL"],
    "Oracle Database": ["SQL"],
    "Next.js": ["React"],
    "Express.js": ["Node.js"],
    "GitHub": ["Git"],
    "GitLab": ["Git"],
    "Keras": ["Deep Learning"],
    "PyTorch": ["Deep Learning"],
    "TensorFlow": ["Deep Learning"],
}

_LEFT = r"(?<![A-Za-z0-9_+#.\-])"
_RIGHT = r"(?![A-Za-z0-9_+#]|\.[A-Za-z0-9])"
# Stricter right boundary for 1-2 character case-sensitive aliases so that
# "C-level", "Go-to" and "R&D" are not read as programming languages.
_RIGHT_STRICT = r"(?![A-Za-z0-9_+#&'\-]|\.[A-Za-z0-9])"

REQUIRED_MARKERS = re.compile(
    r"\b(required|requirements?|must|mandatory|essential|minimum|need to have|"
    r"must[- ]have|proficien\w*|strong|solid|expert\w*|hands-on)\b",
    re.IGNORECASE,
)
PREFERRED_MARKERS = re.compile(
    r"\b(preferred|nice[- ]to[- ]have|good[- ]to[- ]have|bonus|plus|desirable|"
    r"advantage|advantageous|optional|familiarity)\b",
    re.IGNORECASE,
)

# Pattern guards (see module docstring).
GUARD_INITIAL = "initial"
GUARD_AMBIGUOUS = "ambiguous"

_INITIAL_AFTER = re.compile(r"\.[ \t]+[A-Z][a-z]")
_NAME_BEFORE = re.compile(r"[A-Z][a-z]+[ \t]+$")

_LIST_PREV_CHARS = frozenset(",/(:|")
_LIST_NEXT_CHARS = frozenset(",/)")
_LIST_WORDS = frozenset({"and", "or", "&"})
_CONTEXT_PREV_WORDS = frozenset({"in", "with", "using", "via", "of", "on", "and", "or", "like"})
_CONTEXT_NEXT_WORDS = frozenset(
    {
        "developer", "developers", "programming", "language", "lang", "framework", "code",
        "coding", "services", "service", "apps", "app", "application", "applications", "api",
        "apis", "backend", "server", "spreadsheets", "spreadsheet", "formulas", "pivot", "jobs",
        "cluster", "clusters", "streaming", "sql", "ui", "ios", "macros", "modules",
        "microservices", "routines", "scripts",
    }
)
_PREV_WORD_RE = re.compile(r"([A-Za-z]+|&)\s*$")
_NEXT_WORD_RE = re.compile(r"\s*([A-Za-z]+|&)")

# A clause ends at sentence punctuation followed by whitespace, ";", a newline
# or the contrastive "but" ("No Java, but strong Python").
_CLAUSE_BOUNDARY = re.compile(r"[.!?](?=\s|$)|[;\n]|\bbut\b", re.IGNORECASE)
_NEGATION_CUE = re.compile(
    r"\b(?:"
    r"no\s+(?:prior\s+|previous\s+|professional\s+|commercial\s+|hands-on\s+)?"
    r"(?:experience|exposure|knowledge|background|familiarity)\s+(?:with|in|of|to|using)"
    r"|not\s+(?:familiar|experienced|proficient|skilled|comfortable)\s+(?:with|in)"
    r"|unfamiliar\s+with|without|lack\s+of|lacking|lacks"
    r"|never\s+(?:used|worked\s+(?:with|on|in)|touched)"
    r"|(?:do|does|did)\s+not\s+(?:know|use)|(?:don't|doesn't|didn't)\s+(?:know|use)"
    r")\b",
    re.IGNORECASE,
)


class AliasPattern(NamedTuple):
    regex: re.Pattern
    guard: str | None  # None, GUARD_INITIAL or GUARD_AMBIGUOUS
    # Substrings (the first word of each alias) of which at least one must
    # occur in the text for the regex to have any chance of matching.
    needles: tuple
    ignore_case: bool


@dataclass(frozen=True)
class Skill:
    name: str
    category: str
    patterns: tuple  # AliasPattern entries


class Mention(NamedTuple):
    start: int
    end: int
    skill: Skill
    negated: bool = False


@dataclass
class SkillMatch:
    name: str
    category: str
    count: int = 0
    implied_by: list = field(default_factory=list)
    importance: str = "mentioned"  # required | mentioned | preferred (JD only)
    # One entry per mention: the other skills offered as alternatives in that
    # mention ("FastAPI or Django"), or an empty set for a standalone mention.
    alternative_groups: list = field(default_factory=list)
    negated_count: int = 0

    @property
    def implied(self) -> bool:
        return self.count == 0 and bool(self.implied_by)


def _first_word(alias: str) -> str:
    return re.split(r"[\s\-]+", alias.strip())[0]


def _alias_to_regex(alias: str) -> str:
    """Escape an alias; spaces and hyphens match any run of spaces/hyphens."""
    parts = re.split(r"[\s\-]+", alias.strip())
    return r"[\s\-]+".join(re.escape(p) for p in parts if p)


def _compile_skill(entry: dict, category: str) -> Skill:
    name = entry["name"]
    insensitive = list(entry.get("aliases", []))
    if not entry.get("case_sensitive"):
        insensitive.insert(0, name)
    exact = list(entry.get("exact_aliases", []))
    ambiguous = bool(entry.get("ambiguous"))

    patterns = []
    if insensitive:
        alt = "|".join(sorted({_alias_to_regex(a) for a in insensitive}, key=len, reverse=True))
        regex = re.compile(f"{_LEFT}(?:{alt}){_RIGHT}", re.IGNORECASE)
        needles = tuple(sorted({_first_word(a).lower() for a in insensitive}))
        patterns.append(AliasPattern(regex, None, needles, True))
    for alias in exact:
        right = _RIGHT_STRICT if len(alias) <= 2 else _RIGHT
        if ambiguous:
            guard = GUARD_AMBIGUOUS
        elif len(alias) == 1:
            guard = GUARD_INITIAL
        else:
            guard = None
        regex = re.compile(f"{_LEFT}{_alias_to_regex(alias)}{right}")
        patterns.append(AliasPattern(regex, guard, (_first_word(alias),), False))
    return Skill(name=name, category=category, patterns=tuple(patterns))


def load_taxonomy(path: Path | None = None) -> list[Skill]:
    path = path or settings.skills_file
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    skills = []
    for category, entries in data["categories"].items():
        for entry in entries:
            skills.append(_compile_skill(entry, category))
    return skills


@lru_cache(maxsize=1)
def get_taxonomy() -> tuple[Skill, ...]:
    return tuple(load_taxonomy())


def _looks_like_initial(text: str, start: int, end: int) -> bool:
    """True for "Priya R. Sharma" / "John C. Smith" / a line starting "R. Verma"."""
    if not _INITIAL_AFTER.match(text, end):
        return False
    line_start = text.rfind("\n", max(0, start - 40), start) + 1
    before = text[max(line_start, start - 40):start]
    if line_start >= start - 40 and not before.strip():
        return True
    return bool(_NAME_BEFORE.search(before))


def _has_technical_context(text: str, start: int, end: int) -> bool:
    """Context test for ambiguous words such as "Go", "Swift" or "Excel"."""
    before = text[max(0, start - 40):start]
    after = text[end:end + 40]
    prev_char = before.rstrip()[-1:]
    next_char = after.lstrip()[:1]
    if prev_char in _LIST_PREV_CHARS or next_char in _LIST_NEXT_CHARS:
        return True
    prev = _PREV_WORD_RE.search(before)
    nxt = _NEXT_WORD_RE.match(after)
    prev_word = prev.group(1).lower() if prev else ""
    next_word = nxt.group(1).lower() if nxt else ""
    if prev_word in _LIST_WORDS or next_word in _LIST_WORDS:
        return True
    return prev_word in _CONTEXT_PREV_WORDS or next_word in _CONTEXT_NEXT_WORDS


def _accept(text: str, start: int, end: int, guard: str | None) -> bool:
    if guard == GUARD_AMBIGUOUS:
        return _has_technical_context(text, start, end)
    if guard == GUARD_INITIAL:
        return not _looks_like_initial(text, start, end)
    return True


def find_mentions(text: str, taxonomy=None) -> list[tuple[int, int, Skill]]:
    """Return non-overlapping (start, end, skill) mentions, longest match first.

    Overlaps are resolved with a bytearray marking occupied characters, so
    each candidate is checked in O(span length) instead of against every
    previously accepted span.
    """
    taxonomy = taxonomy or get_taxonomy()
    lowered = text.lower()
    candidates = []
    for skill in taxonomy:
        for regex, guard, needles, ignore_case in skill.patterns:
            haystack = lowered if ignore_case else text
            if not any(n in haystack for n in needles):
                continue
            for m in regex.finditer(text):
                if guard is None or _accept(text, m.start(), m.end(), guard):
                    candidates.append((m.start(), m.end(), skill))
    # Prefer longer spans; then earlier start.
    candidates.sort(key=lambda c: (-(c[1] - c[0]), c[0]))
    occupied = bytearray(len(text))
    selected = []
    for start, end, skill in candidates:
        if occupied.find(1, start, end) != -1:
            continue
        occupied[start:end] = b"\x01" * (end - start)
        selected.append((start, end, skill))
    selected.sort(key=lambda c: c[0])
    return selected


def detect_mentions(text: str, taxonomy=None) -> list[Mention]:
    """Like :func:`find_mentions`, with a ``negated`` flag on each mention.

    For each mention the clause start is found by bisecting the clause
    boundaries; the mention is negated if the first negation cue at or after
    the clause start ends before the mention. Cues are non-overlapping and
    ordered, so this is O(log n) per mention.
    """
    spans = find_mentions(text, taxonomy)
    if not spans:
        return []
    boundaries = [m.end() for m in _CLAUSE_BOUNDARY.finditer(text)]
    cues = [(m.start(), m.end()) for m in _NEGATION_CUE.finditer(text)]
    cue_starts = [c[0] for c in cues]
    mentions = []
    for start, end, skill in spans:
        negated = False
        if cues:
            i = bisect_right(boundaries, start) - 1
            clause_start = boundaries[i] if i >= 0 else 0
            k = bisect_left(cue_starts, clause_start)
            negated = k < len(cues) and cues[k][1] <= start
        mentions.append(Mention(start, end, skill, negated))
    return mentions


def _line_importance(text: str) -> list[tuple[int, int, str]]:
    """Label each line of a job description as required / preferred / mentioned.

    Section headers ("Preferred Qualifications:", "Requirements") set the
    context for following lines; explicit markers within a line override it.
    """
    spans = []
    section = "mentioned"
    pos = 0
    for line in text.split("\n"):
        start, end = pos, pos + len(line)
        pos = end + 1
        stripped = line.strip()
        is_header = bool(stripped) and len(stripped.split()) <= 6 and (
            stripped.endswith(":") or stripped.isupper() or stripped.istitle()
        )
        has_pref = bool(PREFERRED_MARKERS.search(line))
        has_req = bool(REQUIRED_MARKERS.search(line))
        if is_header and (has_pref or has_req):
            section = "preferred" if has_pref else "required"
            label = section
        elif is_header and (stripped.endswith(":") or stripped.isupper()):
            # A new neutral section ("Responsibilities:") resets the context.
            section = "mentioned"
            label = section
        elif has_pref:
            label = "preferred"
        elif has_req:
            label = "required"
        else:
            label = section
        spans.append((start, end, label))
    return spans


_IMPORTANCE_RANK = {"required": 3, "mentioned": 2, "preferred": 1}

# Text allowed between two skills of one list: ",", "/", "or", ", or", "and/or".
_LIST_SEPARATOR = re.compile(r"^\s*(?:,|/|\bor\b|,\s*or\b|\band/or\b)\s*$", re.IGNORECASE)
_ALTERNATIVE_SEPARATOR = re.compile(r"/|\bor\b", re.IGNORECASE)


def _alternative_groups(text: str, mentions: list) -> list[set]:
    """For each mention, return the set of skills it is an alternative to.

    "Python, Java or Go" forms one alternative group because the list uses
    "or"; "Python, SQL, Docker" does not (commas only = all required).
    """
    groups: list[set] = [set() for _ in mentions]
    i = 0
    while i < len(mentions):
        j, has_or = i, False
        while j + 1 < len(mentions):
            between = text[mentions[j][1]:mentions[j + 1][0]]
            if not _LIST_SEPARATOR.match(between):
                break
            has_or = has_or or bool(_ALTERNATIVE_SEPARATOR.search(between))
            j += 1
        if has_or:
            names = {mentions[k][2].name for k in range(i, j + 1)}
            for k in range(i, j + 1):
                groups[k] = names - {mentions[k][2].name}
        i = j + 1
    return groups


def extract_skills(
    text: str,
    detect_importance: bool = False,
    include_implied: bool = True,
    mentions: list[Mention] | None = None,
) -> dict[str, SkillMatch]:
    """Extract skills from cleaned (case-preserved) text.

    Returns a mapping of canonical skill name -> SkillMatch. When
    ``detect_importance`` is True (used for job descriptions), each skill is
    labelled required / mentioned / preferred from the surrounding line, and
    "X or Y" alternative groups are recorded. Implied skills are added only
    when ``include_implied`` is True (resumes); job descriptions use only
    skills that are stated explicitly. Negated mentions are not counted; a
    skill whose every mention is negated is absent. Pass precomputed
    ``mentions`` (from :func:`detect_mentions`) to avoid re-scanning the text.
    """
    taxonomy = get_taxonomy()
    by_name = {s.name: s for s in taxonomy}
    if mentions is None:
        mentions = detect_mentions(text, taxonomy)
    active = [m for m in mentions if not m.negated]
    negated_counts: dict[str, int] = {}
    for m in mentions:
        if m.negated:
            negated_counts[m.skill.name] = negated_counts.get(m.skill.name, 0) + 1

    line_spans = _line_importance(text) if detect_importance else []
    line_starts = [s for s, _e, _l in line_spans]
    alt_groups = _alternative_groups(text, active) if detect_importance else []

    results: dict[str, SkillMatch] = {}
    for idx, (start, _end, skill, _neg) in enumerate(active):
        match = results.setdefault(skill.name, SkillMatch(skill.name, skill.category))
        match.count += 1
        if detect_importance:
            match.alternative_groups.append(alt_groups[idx])
            line = bisect_right(line_starts, start) - 1
            label = line_spans[line][2] if line >= 0 else "mentioned"
            if match.count == 1 or _IMPORTANCE_RANK[label] > _IMPORTANCE_RANK[match.importance]:
                match.importance = label
    for name, count in negated_counts.items():
        if name in results:
            results[name].negated_count = count

    if not include_implied:
        return results
    for source in list(results):
        for implied in IMPLIED_SKILLS.get(source, []):
            if implied not in by_name:
                continue
            target = results.setdefault(implied, SkillMatch(implied, by_name[implied].category))
            if target.count == 0:
                target.implied_by.append(source)
    return results


def satisfied_by_alternative(job_skill: SkillMatch, resume_names: set) -> list[str]:
    """Resume skills that satisfy ``job_skill`` as an alternative, or [].

    Only applies when *every* mention of the skill is inside an alternative
    group that the resume satisfies. A skill that is also demanded on its own
    elsewhere in the job description still counts as required.
    """
    groups = job_skill.alternative_groups
    if not groups or any(not g for g in groups):
        return []
    satisfied = [g & resume_names for g in groups]
    if not all(satisfied):
        return []
    return sorted(set().union(*satisfied))


@lru_cache(maxsize=1024)
def canonical_token(skill_name: str) -> str:
    """Single-token form of a skill used inside the TF-IDF text.

    "C++" -> "skill_cplusplus", ".NET" -> "skill_dotnet",
    "Machine Learning" -> "skill_machine_learning".
    """
    slug = (
        skill_name.lower()
        .replace("+", "plus")
        .replace("#", "sharp")
        .replace(".", "dot")
    )
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return f"skill_{slug}"


def replace_skills_with_tokens(text: str, mentions: list[Mention] | None = None) -> str:
    """Replace every skill mention with its canonical token.

    This makes TF-IDF treat aliases ("JS", "JavaScript", "ECMAScript") as one
    term and keeps multi-word skills ("machine learning") together. Negated
    mentions are removed, so "no experience with Kubernetes" does not make a
    resume more similar to a Kubernetes job.
    """
    if mentions is None:
        mentions = detect_mentions(text)
    out = []
    last = 0
    for start, end, skill, negated in mentions:
        out.append(text[last:start])
        out.append(" " if negated else f" {canonical_token(skill.name)} ")
        last = end
    out.append(text[last:])
    return "".join(out)


def token_to_skill_name() -> dict[str, str]:
    return {canonical_token(s.name): s.name for s in get_taxonomy()}
