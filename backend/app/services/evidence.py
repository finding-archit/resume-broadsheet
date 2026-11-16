"""Skill evidence and anti-gaming checks for resumes.

Two weaknesses of pure keyword/TF-IDF matching are addressed here:

* Keyword stuffing. A bare list of skills scores as well as a resume that
  shows where the skills were used. The resume is split into *segments*
  (lines, further split at sentence ends). A segment is **descriptive** when
  it has at least 6 word tokens, fewer than half of its tokens belong to skill
  mentions, and it is not a "Label: a, b, c" list (3+ comma-separated items
  of 3 words or fewer on average). Each resume skill is then "demonstrated"
  (mentioned in a descriptive segment), "listed" (only in lists/headers) or
  "inferred" (only implied by a related skill). The analyzer caps the score of
  resumes with almost no descriptive segments.

* Copying the job description. Resume lines that are mostly verbatim copies
  of the job description are dropped before analysis. Copying is measured
  with word 4-gram shingles: a line with 8+ tokens is dropped when at least
  70% of its shingles occur in the job description; a shorter line (5-7
  tokens) only when all of them do, i.e. it is a verbatim fragment.
"""

import re
from bisect import bisect_right
from dataclasses import dataclass, field

from app.services import text_preprocessor as tp

DEMONSTRATED = "demonstrated"
LISTED = "listed"
INFERRED = "inferred"

MIN_DESCRIPTIVE_TOKENS = 6
MAX_SKILL_TOKEN_SHARE = 0.5
MIN_LIST_ITEMS = 3
MAX_LIST_ITEM_WORDS = 3

SHINGLE_SIZE = 4
COPY_MIN_TOKENS = 8
COPY_CONTAINMENT = 0.70
SHORT_COPY_MIN_TOKENS = 5

_SENTENCE_END_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(tp.TOKEN_PATTERN, re.IGNORECASE)
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


@dataclass
class EvidenceReport:
    segments: list  # (start, end, descriptive) per segment
    descriptive_segments: int
    # Skill name -> "demonstrated" | "listed" for explicitly mentioned skills.
    by_skill: dict = field(default_factory=dict)

    def evidence_for(self, skill_name: str, implied: bool = False) -> str:
        if implied:
            return INFERRED
        return self.by_skill.get(skill_name, LISTED)


def split_segments(text: str) -> list[tuple[int, int]]:
    """(start, end) offsets of lines, further split at sentence ends."""
    segments = []
    pos = 0
    for line in text.split("\n"):
        line_start = pos
        pos += len(line) + 1
        seg_start = 0
        for m in _SENTENCE_END_RE.finditer(line):
            segments.append((line_start + seg_start, line_start + m.start()))
            seg_start = m.end()
        segments.append((line_start + seg_start, line_start + len(line)))
    return [(s, e) for s, e in segments if text[s:e].strip()]


def is_label_list(segment: str) -> bool:
    """True for "Tools: Git, Docker, Linux" style lists (with or without a label)."""
    body = segment.split(":", 1)[1] if ":" in segment else segment
    items = [item.strip() for item in body.split(",") if item.strip()]
    if len(items) < MIN_LIST_ITEMS:
        return False
    return sum(len(item.split()) for item in items) / len(items) <= MAX_LIST_ITEM_WORDS


def _is_descriptive(text: str, start: int, end: int, skill_mask: bytearray) -> bool:
    tokens = [m.start() for m in _WORD_RE.finditer(text, start, end)]
    if len(tokens) < MIN_DESCRIPTIVE_TOKENS:
        return False
    skill_tokens = sum(1 for pos in tokens if skill_mask[pos])
    if skill_tokens / len(tokens) >= MAX_SKILL_TOKEN_SHARE:
        return False
    return not is_label_list(text[start:end])


def assess_evidence(text: str, mentions: list) -> EvidenceReport:
    """Classify segments and record, per skill, whether it is demonstrated."""
    skill_mask = bytearray(len(text))
    for start, end, _skill, _negated in mentions:
        skill_mask[start:end] = b"\x01" * (end - start)

    segments = [(s, e, _is_descriptive(text, s, e, skill_mask)) for s, e in split_segments(text)]
    starts = [s for s, _e, _d in segments]
    by_skill: dict[str, str] = {}
    for start, _end, skill, negated in mentions:
        if negated:
            continue
        idx = bisect_right(starts, start) - 1
        descriptive = idx >= 0 and segments[idx][2] and start < segments[idx][1]
        if descriptive:
            by_skill[skill.name] = DEMONSTRATED
        else:
            by_skill.setdefault(skill.name, LISTED)
    return EvidenceReport(
        segments=segments,
        descriptive_segments=sum(1 for *_se, d in segments if d),
        by_skill=by_skill,
    )


def _shingles(tokens: list[str]) -> set[tuple]:
    return set(zip(*(tokens[i:] for i in range(SHINGLE_SIZE))))


def _is_copied(tokens: list[str], job_shingles: set) -> bool:
    if len(tokens) < SHORT_COPY_MIN_TOKENS:
        return False
    shingles = _shingles(tokens)
    contained = len(shingles & job_shingles) / len(shingles)
    if len(tokens) >= COPY_MIN_TOKENS:
        return contained >= COPY_CONTAINMENT
    return contained == 1.0


def remove_copied_lines(resume_clean: str, job_clean: str) -> tuple[str, dict]:
    """Drop resume lines copied from the job description.

    Returns the filtered text and {"lines": int, "characters": int} removed.
    """
    job_shingles = _shingles(tp.tokenize(job_clean))
    kept = []
    removed_lines = removed_chars = 0
    for line in resume_clean.split("\n"):
        if job_shingles and _is_copied(tp.tokenize(line), job_shingles):
            removed_lines += 1
            removed_chars += len(line)
            continue
        kept.append(line)
    if not removed_lines:
        return resume_clean, {"lines": 0, "characters": 0}
    filtered = _MULTI_NEWLINE_RE.sub("\n\n", "\n".join(kept)).strip()
    return filtered, {"lines": removed_lines, "characters": removed_chars}
