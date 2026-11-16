"""Rule-based recommendations generated from the actual analysis results.

Every recommendation is derived from computed data (missing skills, their
importance in the job description, keyword overlap, scores). The engine never
invents qualifications: suggestions to add a keyword are always conditional
on the candidate genuinely having that experience. Sentences agree in number
with the skills they list ("X was not found" / "X and Y were not found").
"""

from app.services.skill_extractor import SkillMatch

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _join(names: list[str], limit: int = 6) -> str:
    names = names[:limit]
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def _verb(names: list[str], singular: str, plural: str) -> str:
    """Pick the verb form that agrees with a list of names."""
    return singular if len(names) == 1 else plural


def _skill_priority(skill: SkillMatch) -> str:
    if skill.importance == "required" or skill.count >= 3:
        return "high"
    if skill.importance == "preferred":
        return "low"
    return "medium"


def prioritize_missing(missing: list[SkillMatch]) -> list[dict]:
    """Attach a priority to each missing skill, highest first."""
    rows = [
        {
            "name": s.name,
            "category": s.category,
            "importance": s.importance,
            "job_mentions": s.count,
            "priority": _skill_priority(s),
        }
        for s in missing
    ]
    rows.sort(key=lambda r: (_PRIORITY_ORDER[r["priority"]], -r["job_mentions"], r["name"]))
    return rows


def generate_recommendations(
    *,
    missing: list[dict],
    matched: list[dict],
    additional: list[dict],
    job_keywords: list[dict],
    tfidf_pct: float,
    coverage_pct: float | None,
    overall: float,
    resume_word_count: int,
    score_cap: dict | None = None,
    copied_text_removed: dict | None = None,
) -> list[dict]:
    recs: list[dict] = []

    def add(priority, category, title, detail, skills=None):
        recs.append(
            {
                "priority": priority,
                "category": category,
                "title": title,
                "detail": detail,
                "skills": skills or [],
            }
        )

    if copied_text_removed and copied_text_removed.get("lines"):
        lines = copied_text_removed["lines"]
        add(
            "high",
            "Content",
            "Copied job-description text was ignored",
            f"{lines} line{'s' if lines != 1 else ''} of your resume "
            f"{'was' if lines == 1 else 'were'} copied almost word for word from the job "
            "description and excluded from the analysis. Describe your own experience in your "
            "own words instead of pasting the posting.",
        )
    if score_cap and score_cap.get("applied"):
        add(
            "high",
            "Content",
            "Score capped: the resume reads as a keyword list",
            f"Your resume has few sentences or bullets that describe actual work, so the score "
            f"was capped at {score_cap['max_score']:.1f} (uncapped "
            f"{score_cap['uncapped_score']:.1f}). Add project and experience bullets that explain "
            "what you built, with which tools, and the outcome.",
        )

    high = [m["name"] for m in missing if m["priority"] == "high"]
    medium = [m["name"] for m in missing if m["priority"] == "medium"]
    low = [m["name"] for m in missing if m["priority"] == "low"]

    if high:
        add(
            "high",
            "Missing skills",
            f"Address {len(high)} high-priority skill gap{'s' if len(high) > 1 else ''}",
            f"The job description emphasises {_join(high)}, which "
            f"{_verb(high, 'was', 'were')} not found in your resume. "
            "If you have real experience with any of them, name the skill explicitly and show "
            "where you used it (a project, internship or course). If you do not, treat these as "
            "learning goals rather than adding them to your resume.",
            high,
        )
    if medium:
        add(
            "medium",
            "Missing skills",
            "Consider other skills mentioned in the job description",
            f"{_join(medium)} also {_verb(medium, 'appears', 'appear')} in the job description. "
            f"Mention {_verb(medium, 'it', 'them')} only where "
            f"{_verb(medium, 'it reflects', 'they reflect')} work you have actually done.",
            medium,
        )
    if low:
        add(
            "low",
            "Missing skills",
            "Optional / preferred skills",
            f"{_join(low)} {_verb(low, 'is', 'are')} listed as preferred or nice-to-have. "
            f"{_verb(low, 'It', 'They')} can strengthen an application but "
            f"{_verb(low, 'is', 'are')} usually not {_verb(low, 'a deal-breaker', 'deal-breakers')}.",
            low,
        )

    implied = [m["name"] for m in matched if m.get("implied")]
    if implied:
        add(
            "medium",
            "Skill evidence",
            "Make inferred skills explicit",
            f"{_join(implied)} {_verb(implied, 'was', 'were')} only inferred from related tools "
            "on your resume "
            "(for example, PostgreSQL implies SQL). Recruiters and keyword filters may not make "
            "that inference, so name these skills directly if they apply.",
            implied,
        )

    listed = [m["name"] for m in matched if m.get("evidence") == "listed"]
    if listed:
        add(
            "medium",
            "Skill evidence",
            "Show where you used your listed skills",
            f"{_join(listed)} {_verb(listed, 'appears', 'appear')} only in a skills list, not in "
            "a sentence describing your work. Where it is true, add a project or experience "
            f"bullet that shows how you used {_verb(listed, 'it', 'them')} and what the result was.",
            listed,
        )

    missing_terms = [
        k["term"] for k in job_keywords if not k["in_resume"] and not k["is_skill"]
    ][:6]
    if missing_terms:
        add(
            "medium",
            "Keywords",
            "Align terminology with the job description",
            f"Important job-description terms such as {_join([repr(t) for t in missing_terms])} "
            "do not appear in your resume. Where it is accurate, describe your experience using "
            "the same wording the employer uses.",
            [],
        )

    if tfidf_pct < 20:
        add(
            "high" if tfidf_pct < 10 else "medium",
            "Content",
            "Review project descriptions and experience bullets",
            f"The overall text similarity is low ({tfidf_pct:.1f}%). Rewrite bullets to describe "
            "what you built, the technologies used and the outcome, focusing on the "
            "responsibilities this role describes.",
        )
    else:
        add(
            "low",
            "Content",
            "Strengthen experience bullets",
            "Check that each relevant project or role states the technologies used and a "
            "measurable outcome (for example performance, accuracy or users served).",
        )

    if additional:
        names = [a["name"] for a in additional]
        add(
            "low",
            "Additional skills",
            "Highlight transferable skills carefully",
            f"Your resume also lists {_join(names)}, which this job description does not mention. "
            "Keep them if they are relevant, but place the skills this role asks for first.",
            names[:6],
        )

    if resume_word_count < 150:
        add(
            "medium",
            "Content",
            "Add more detail to your resume",
            f"Only about {resume_word_count} words were extracted. Short resumes give less "
            "evidence of your experience; add project and responsibility details where genuine.",
        )

    if coverage_pct is None:
        add(
            "low",
            "Analysis note",
            "No taxonomy skills detected in the job description",
            "Skill coverage could not be computed, so the overall score is based on TF-IDF "
            "similarity only. Paste a fuller job description for a more detailed analysis.",
        )
    elif overall >= 60 and not high:
        add(
            "low",
            "Summary",
            "Strong alignment",
            "Your resume already covers most of the skills this job description asks for. "
            "Focus on quantifying achievements and tailoring your summary to the role.",
        )

    recs.sort(key=lambda r: _PRIORITY_ORDER[r["priority"]])
    for i, rec in enumerate(recs, start=1):
        rec["id"] = i
    return recs
