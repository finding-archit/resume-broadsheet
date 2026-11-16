"""End-to-end analysis pipeline.

raw text -> clean -> drop lines copied from the JD -> skill extraction (with
negation) -> evidence (demonstrated / listed / inferred) -> TF-IDF similarity
-> skill coverage -> weighted score -> keyword-list cap -> recommendations
-> structured result (including highlight spans and a similarity breakdown)
"""

from app.config import settings
from app.services import matching_engine as me
from app.services import text_preprocessor as tp
from app.services.evidence import INFERRED, assess_evidence, remove_copied_lines
from app.services.recommendation_engine import generate_recommendations, prioritize_missing
from app.services.skill_extractor import detect_mentions, extract_skills, satisfied_by_alternative


class InputValidationError(ValueError):
    """Raised when resume or job-description text is unusable."""


def _validate_text(text: str, label: str, min_chars: int, min_words: int) -> str:
    cleaned = tp.clean_text(text or "")
    if not cleaned:
        raise InputValidationError(f"The {label} is empty.")
    if len(cleaned) > settings.max_text_chars:
        raise InputValidationError(
            f"The {label} is too long (over {settings.max_text_chars:,} characters)."
        )
    if len(cleaned) < min_chars or tp.word_count(cleaned) < min_words:
        raise InputValidationError(
            f"The {label} is too short to analyze. Please provide at least "
            f"{min_words} words ({min_chars} characters)."
        )
    return cleaned


def _skill_row(match, resume_match=None, evidence=None) -> dict:
    row = {"name": match.name, "category": match.category}
    if resume_match is not None:
        row["implied"] = resume_match.implied
        row["implied_by"] = list(resume_match.implied_by)
        row["evidence"] = evidence.evidence_for(match.name, resume_match.implied)
    return row


def _spans(mentions, status_for) -> list[dict]:
    return [
        {
            "start": m.start,
            "end": m.end,
            "skill": m.skill.name,
            "category": m.skill.category,
            "status": "negated" if m.negated else status_for(m.skill.name),
        }
        for m in mentions
    ]


def scoring_method(coverage_available: bool) -> dict:
    w_t, w_s = me.normalized_weights()
    return {
        "overall_formula": (
            f"Overall Match Score = {w_t:.2f} x TF-IDF Similarity + {w_s:.2f} x Skill Coverage"
            if coverage_available
            else "Overall Match Score = TF-IDF Similarity (skill coverage unavailable: "
            "no taxonomy skills were detected in the job description)"
        ),
        "tfidf_formula": "TF-IDF Similarity (%) = cosine(resume vector, job vector) x 100",
        "skill_coverage_formula": (
            "Skill Coverage (%) = matched job-description skills / "
            "unique job-description skills x 100 (an alternative such as 'FastAPI or "
            "Django' counts as satisfied when the resume has one of the options)"
        ),
        "weights": {"tfidf": round(w_t, 4), "skill_coverage": round(w_s, 4)},
        "weights_rationale": (
            "Heuristic weights. TF-IDF uses the whole text (context, responsibilities, domain "
            "vocabulary), so it receives the larger share; skill coverage rewards explicitly "
            "matching the listed skills, but depends on the skill taxonomy. The weights are "
            "configurable and are not scientifically validated hiring weights."
        ),
        "adjustments": (
            f"Keyword-list cap: if the resume has fewer than {settings.min_descriptive_segments} "
            "descriptive segments (sentences or bullets of 6+ words that are not mostly skill "
            "names and not a 'Label: a, b, c' list), the overall score is capped at "
            f"{settings.keyword_list_cap} (below 'Good match'). Resume lines copied almost "
            "verbatim from the job description are removed before analysis, and negated skill "
            "mentions ('no experience with Java') are not counted."
        ),
        "bands": me.bands(),
        "tfidf_settings": me.TFIDF_SETTINGS,
        "semantic_embeddings": "Not used. Matching is lexical (keywords and TF-IDF) only.",
        "disclaimer": (
            "This score measures text and skill similarity between the resume and the job "
            "description. It is not a probability of being shortlisted or hired, and it does "
            "not measure candidate quality."
        ),
    }


def analyze(resume_text: str, job_description: str, source: dict | None = None) -> dict:
    resume_clean = _validate_text(
        resume_text, "resume", settings.min_resume_chars, settings.min_resume_words
    )
    job_clean = _validate_text(
        job_description,
        "job description",
        settings.min_job_description_chars,
        settings.min_job_description_words,
    )

    # Lines pasted from the job description are not evidence of anything. If
    # nothing usable remains, the analysis still runs (and scores ~0).
    resume_used, copied = remove_copied_lines(resume_clean, job_clean)

    job_mentions = detect_mentions(job_clean)
    resume_mentions = detect_mentions(resume_used)
    job_skills = extract_skills(
        job_clean, detect_importance=True, include_implied=False, mentions=job_mentions
    )
    resume_skills = extract_skills(resume_used, mentions=resume_mentions)
    evidence = assess_evidence(resume_used, resume_mentions)

    resume_names = set(resume_skills)
    # "FastAPI or Django": a JD skill offered as an alternative is not counted
    # as required when the resume already has another option from its group.
    alternatives = {}
    for name in set(job_skills) - resume_names:
        satisfied = satisfied_by_alternative(job_skills[name], resume_names)
        if satisfied:
            alternatives[name] = satisfied
    job_names = set(job_skills) - set(alternatives)
    matched_names = job_names & resume_names
    coverage = me.skill_coverage(job_names, resume_names)
    if coverage is not None:
        coverage = round(coverage, 1)

    tfidf = me.compute_tfidf(
        resume_used, job_clean, resume_mentions=resume_mentions, job_mentions=job_mentions
    )
    tfidf_pct = round(tfidf.similarity * 100, 1)
    # Use the same rounded components that are displayed and exported, so a
    # reader can reproduce the overall score from the numbers on screen.
    overall = me.overall_score(tfidf_pct, coverage)

    score_cap = None
    if (
        evidence.descriptive_segments < settings.min_descriptive_segments
        and overall > settings.keyword_list_cap
    ):
        score_cap = {
            "applied": True,
            "max_score": settings.keyword_list_cap,
            "uncapped_score": overall,
            "reason": (
                f"The resume has {evidence.descriptive_segments} descriptive segment"
                f"{'' if evidence.descriptive_segments == 1 else 's'} (sentences or bullets "
                "describing work); at least "
                f"{settings.min_descriptive_segments} are needed for a score above "
                f"{settings.keyword_list_cap}. Keyword lists alone are capped."
            ),
        }
        overall = settings.keyword_list_cap

    def sort_key(row):
        return (row["category"], row["name"].lower())

    matched = sorted(
        (
            {
                **_skill_row(job_skills[n], resume_skills[n], evidence),
                "importance": job_skills[n].importance,
            }
            for n in matched_names
        ),
        key=sort_key,
    )
    missing = prioritize_missing([job_skills[n] for n in job_names - resume_names])
    # Implied-only skills are not listed as "additional": they are inferences, not claims.
    additional_names = {
        n for n in resume_names - set(job_skills) if not resume_skills[n].implied
    }
    additional = sorted(
        (
            {**_skill_row(resume_skills[n]), "evidence": evidence.evidence_for(n)}
            for n in additional_names
        ),
        key=sort_key,
    )

    evidence_summary = {
        "descriptive_segments": evidence.descriptive_segments,
        "demonstrated": sum(1 for m in matched if m["evidence"] == "demonstrated"),
        "listed": sum(1 for m in matched if m["evidence"] == "listed"),
        "inferred": sum(1 for m in matched if m["evidence"] == INFERRED),
    }

    categories = {}
    for name in job_names:
        skill = job_skills[name]
        row = categories.setdefault(
            skill.category, {"category": skill.category, "required": 0, "matched": 0}
        )
        row["required"] += 1
        row["matched"] += int(name in resume_names)
    category_breakdown = sorted(categories.values(), key=lambda r: -r["required"])

    resume_words = tp.word_count(resume_clean)
    warnings = []
    if resume_words < 150:
        warnings.append(
            f"Only {resume_words} words were extracted from the resume; results may be less reliable."
        )
    if coverage is None:
        warnings.append("No known skills were detected in the job description.")
    if copied["lines"]:
        warnings.append(
            f"{copied['lines']} resume line{'s were' if copied['lines'] != 1 else ' was'} copied "
            "from the job description and excluded from the analysis."
        )
    if score_cap:
        warnings.append(
            f"The score was capped at {settings.keyword_list_cap} because the resume reads as a "
            "keyword list with little descriptive content."
        )

    recommendations = generate_recommendations(
        missing=missing,
        matched=matched,
        additional=additional,
        job_keywords=tfidf.keywords,
        tfidf_pct=tfidf_pct,
        coverage_pct=coverage,
        overall=overall,
        resume_word_count=resume_words,
        score_cap=score_cap,
        copied_text_removed=copied,
    )

    def resume_status(name):
        return "matched" if name in matched_names else "additional"

    def job_status(name):
        if name in alternatives:
            return "alternative"
        return "matched" if name in matched_names else "missing"

    return {
        "overall_match_score": overall,
        "match_level": me.match_level(overall),
        "tfidf_similarity": tfidf_pct,
        "skill_coverage": coverage,
        "matched_skills": matched,
        "missing_skills": missing,
        "additional_skills": additional,
        "alternative_skills": sorted(
            (
                {**_skill_row(job_skills[n]), "satisfied_by": by}
                for n, by in alternatives.items()
            ),
            key=sort_key,
        ),
        "job_skill_count": len(job_names),
        "resume_skill_count": len(resume_names),
        "category_breakdown": category_breakdown,
        "extracted_resume_text_length": len(resume_clean),
        "resume_word_count": resume_words,
        "job_description_word_count": tp.word_count(job_clean),
        "job_description_keywords": tfidf.keywords,
        "similarity_terms": me.similarity_terms(tfidf),
        "evidence_summary": evidence_summary,
        "copied_text_removed": copied,
        "score_cap": score_cap,
        "documents": {
            "resume": {"text": resume_used, "spans": _spans(resume_mentions, resume_status)},
            "job": {"text": job_clean, "spans": _spans(job_mentions, job_status)},
        },
        "recommendations": recommendations,
        "scoring_method": scoring_method(coverage is not None),
        "warnings": warnings,
        "input_source": source or {"type": "text"},
    }
