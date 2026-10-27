"""TF-IDF similarity, skill coverage and the weighted overall score.

Formulas (all components on a 0-100 scale):

    TF-IDF Similarity (%) = cosine(v_resume, v_job) x 100
    Skill Coverage (%)    = |matched required skills| / |unique JD skills| x 100
    Overall Match Score   = w_tfidf x TF-IDF Similarity + w_skill x Skill Coverage
                            (defaults: w_tfidf = 0.60, w_skill = 0.40)

If no taxonomy skills are detected in the job description, skill coverage is
reported as unavailable (None) and the overall score falls back to the TF-IDF
similarity alone. The response says so explicitly in ``scoring_method``.

These are heuristic weights for a transparent demo, not validated hiring
weights. A similarity score is NOT a probability of being hired.
"""

from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import settings
from app.services import text_preprocessor as tp
from app.services.skill_extractor import replace_skills_with_tokens, token_to_skill_name

TFIDF_SETTINGS = {
    "fitted_on": "the resume and job description together (a 2-document corpus)",
    "analyzer": "custom tokenizer that keeps C++, C#, .NET, Node.js, CI/CD intact",
    "skill_normalization": "skill aliases are replaced by one canonical token before vectorizing",
    "lowercase": True,
    "stop_words": "scikit-learn English list + a small resume/job-post domain list",
    "ngram_range": "(1, 1) - multi-word skills are already merged into single tokens",
    "sublinear_tf": True,
    "smooth_idf": True,
    "norm": "l2",
}


@dataclass
class TfidfResult:
    similarity: float  # cosine similarity in [0, 1]
    keywords: list  # top job-description terms


def _build_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        analyzer=tp.analyzer,
        lowercase=False,  # text is lowercased before vectorizing
        sublinear_tf=True,  # 1 + log(tf) dampens repeated words
        smooth_idf=True,
        norm="l2",
    )


def prepare_for_tfidf(clean_text: str) -> str:
    return tp.normalize_for_vectorizer(replace_skills_with_tokens(clean_text))


def compute_tfidf(resume_clean: str, job_clean: str, top_n: int = 15) -> TfidfResult:
    """Fit TF-IDF on both documents and compute their cosine similarity.

    Edge cases: if either document has no usable tokens (only stop words,
    numbers, or nothing), similarity is 0.0 instead of raising.
    """
    docs = [prepare_for_tfidf(resume_clean), prepare_for_tfidf(job_clean)]
    if not all(tp.analyzer(d) for d in docs):
        return TfidfResult(similarity=0.0, keywords=[])

    vectorizer = _build_vectorizer()
    try:
        matrix = vectorizer.fit_transform(docs)
    except ValueError:  # "empty vocabulary"
        return TfidfResult(similarity=0.0, keywords=[])

    similarity = float(cosine_similarity(matrix[0], matrix[1])[0, 0])
    similarity = min(max(similarity, 0.0), 1.0)

    terms = vectorizer.get_feature_names_out()
    resume_row = matrix[0].toarray().ravel()
    job_row = matrix[1].toarray().ravel()
    names = token_to_skill_name()
    order = np.argsort(-job_row, kind="stable")
    keywords = []
    for idx in order[:top_n]:
        if job_row[idx] <= 0:
            break
        term = terms[idx]
        keywords.append(
            {
                "term": names.get(term, term),
                "weight": round(float(job_row[idx]), 4),
                "in_resume": bool(resume_row[idx] > 0),
                "is_skill": term in names,
            }
        )
    return TfidfResult(similarity=similarity, keywords=keywords)


def skill_coverage(job_skills: set, resume_skills: set) -> float | None:
    """Percentage of unique JD skills present in the resume, or None if no JD skills."""
    if not job_skills:
        return None
    return len(job_skills & resume_skills) / len(job_skills) * 100.0


def normalized_weights() -> tuple[float, float]:
    w_t, w_s = max(settings.tfidf_weight, 0.0), max(settings.skill_weight, 0.0)
    total = w_t + w_s
    if total == 0:
        return 0.6, 0.4
    return w_t / total, w_s / total


def overall_score(tfidf_pct: float, coverage_pct: float | None) -> float:
    w_t, w_s = normalized_weights()
    if coverage_pct is None:
        score = tfidf_pct
    else:
        score = w_t * tfidf_pct + w_s * coverage_pct
    return round(min(max(score, 0.0), 100.0), 1)


def match_level(score: float) -> str:
    """Descriptive band for the score. Bands are heuristic, not predictive.

    They are calibrated to the observed range of TF-IDF cosine values: two
    different real documents rarely exceed ~0.45 cosine even when closely
    related, so a perfect-skill, strongly-related resume lands around 60-70.
    """
    if score >= 60:
        return "Strong match"
    if score >= 40:
        return "Good match"
    if score >= 20:
        return "Partial match"
    return "Low match"
