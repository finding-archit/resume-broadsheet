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
* Overlapping matches are resolved longest-first, so "SQL Server" is one
  mention of Microsoft SQL Server rather than also a mention of SQL.
* ``implies`` adds closely related skills (e.g. PostgreSQL implies SQL).
  Implied skills are flagged so the UI can show they were inferred.
"""

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

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


@dataclass(frozen=True)
class Skill:
    name: str
    category: str
    patterns: tuple  # compiled regexes


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

    @property
    def implied(self) -> bool:
        return self.count == 0 and bool(self.implied_by)


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

    patterns = []
    if insensitive:
        alt = "|".join(sorted({_alias_to_regex(a) for a in insensitive}, key=len, reverse=True))
        patterns.append(re.compile(f"{_LEFT}(?:{alt}){_RIGHT}", re.IGNORECASE))
    for alias in exact:
        right = _RIGHT_STRICT if len(alias) <= 2 else _RIGHT
        patterns.append(re.compile(f"{_LEFT}{_alias_to_regex(alias)}{right}"))
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


def find_mentions(text: str, taxonomy=None) -> list[tuple[int, int, Skill]]:
    """Return non-overlapping (start, end, skill) mentions, longest match first."""
    taxonomy = taxonomy or get_taxonomy()
    candidates = []
    for skill in taxonomy:
        for pattern in skill.patterns:
            for m in pattern.finditer(text):
                candidates.append((m.start(), m.end(), skill))
    # Prefer longer spans; then earlier start.
    candidates.sort(key=lambda c: (-(c[1] - c[0]), c[0]))
    taken: list[tuple[int, int]] = []
    selected = []
    for start, end, skill in candidates:
        if any(start < t_end and end > t_start for t_start, t_end in taken):
            continue
        taken.append((start, end))
        selected.append((start, end, skill))
    selected.sort(key=lambda c: c[0])
    return selected


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
    text: str, detect_importance: bool = False, include_implied: bool = True
) -> dict[str, SkillMatch]:
    """Extract skills from cleaned (case-preserved) text.

    Returns a mapping of canonical skill name -> SkillMatch. When
    ``detect_importance`` is True (used for job descriptions), each skill is
    labelled required / mentioned / preferred from the surrounding line, and
    "X or Y" alternative groups are recorded. Implied skills are added only when ``include_implied`` is True (resumes);
    job descriptions use only skills that are stated explicitly.
    """
    taxonomy = get_taxonomy()
    by_name = {s.name: s for s in taxonomy}
    mentions = find_mentions(text, taxonomy)
    line_spans = _line_importance(text) if detect_importance else []
    alt_groups = _alternative_groups(text, mentions) if detect_importance else []

    results: dict[str, SkillMatch] = {}
    for idx, (start, _end, skill) in enumerate(mentions):
        match = results.setdefault(skill.name, SkillMatch(skill.name, skill.category))
        match.count += 1
        if detect_importance:
            match.alternative_groups.append(alt_groups[idx])
            label = next((lbl for s, e, lbl in line_spans if s <= start <= e), "mentioned")
            if match.count == 1 or _IMPORTANCE_RANK[label] > _IMPORTANCE_RANK[match.importance]:
                match.importance = label

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


def replace_skills_with_tokens(text: str) -> str:
    """Replace every skill mention with its canonical token.

    This makes TF-IDF treat aliases ("JS", "JavaScript", "ECMAScript") as one
    term and keeps multi-word skills ("machine learning") together.
    """
    out = []
    last = 0
    for start, end, skill in find_mentions(text):
        out.append(text[last:start])
        out.append(f" {canonical_token(skill.name)} ")
        last = end
    out.append(text[last:])
    return "".join(out)


def token_to_skill_name() -> dict[str, str]:
    return {canonical_token(s.name): s.name for s in get_taxonomy()}
