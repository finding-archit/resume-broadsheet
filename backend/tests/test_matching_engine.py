import pytest

from app.services import matching_engine as me
from app.services.analyzer import InputValidationError, analyze


# ---------- skill coverage ----------

def test_skill_coverage_formula():
    assert me.skill_coverage({"Python", "SQL", "Docker", "AWS"}, {"Python", "SQL", "Java"}) == 50.0


def test_skill_coverage_full_and_none():
    assert me.skill_coverage({"Python"}, {"Python", "SQL"}) == 100.0
    assert me.skill_coverage({"Python", "SQL"}, set()) == 0.0


def test_skill_coverage_zero_denominator_returns_none():
    assert me.skill_coverage(set(), {"Python"}) is None


# ---------- TF-IDF ----------

def test_identical_documents_have_similarity_one():
    text = "Python developer building REST APIs with FastAPI and PostgreSQL"
    assert me.compute_tfidf(text, text).similarity == pytest.approx(1.0)


def test_disjoint_documents_have_similarity_zero():
    result = me.compute_tfidf("chef cooking menus kitchen", "python developer apis databases")
    assert result.similarity == pytest.approx(0.0)


def test_similarity_orders_related_above_unrelated():
    job = "Machine learning engineer with Python, PyTorch and NLP experience"
    related = "Built NLP models in Python using PyTorch and machine learning"
    unrelated = "Managed restaurant kitchen staff and menu planning"
    assert me.compute_tfidf(related, job).similarity > me.compute_tfidf(unrelated, job).similarity


def test_aliases_increase_similarity():
    """Skill canonicalization makes 'JS' and 'JavaScript' the same TF-IDF term."""
    job = "JavaScript developer"
    assert me.compute_tfidf("JS developer", job).similarity == pytest.approx(1.0)


def test_empty_vocabulary_returns_zero():
    # Only stop words and numbers -> nothing to vectorize.
    assert me.compute_tfidf("the and of 2024", "python developer").similarity == 0.0
    assert me.compute_tfidf("", "").similarity == 0.0


def test_keywords_report_presence_in_resume():
    result = me.compute_tfidf("Python and Docker", "Python, Docker and Kubernetes clusters")
    by_term = {k["term"]: k for k in result.keywords}
    assert by_term["Python"]["in_resume"] is True
    assert by_term["Kubernetes"]["in_resume"] is False
    assert by_term["Kubernetes"]["is_skill"] is True


# ---------- overall score ----------

def test_overall_score_formula_default_weights():
    assert me.overall_score(50.0, 100.0) == pytest.approx(0.6 * 50 + 0.4 * 100)


def test_overall_score_without_coverage_uses_tfidf_only():
    assert me.overall_score(42.0, None) == 42.0


@pytest.mark.parametrize("tfidf,coverage", [(0, 0), (100, 100), (150, 150), (-5, -5), (0, None)])
def test_overall_score_is_clamped(tfidf, coverage):
    assert 0 <= me.overall_score(tfidf, coverage) <= 100


def test_match_levels():
    assert me.match_level(70) == "Strong match"
    assert me.match_level(50) == "Good match"
    assert me.match_level(30) == "Partial match"
    assert me.match_level(5) == "Low match"


# ---------- full pipeline ----------

def test_matching_resume_scores_well(backend_resume_text, backend_jd):
    result = analyze(backend_resume_text, backend_jd)
    matched = {s["name"] for s in result["matched_skills"]}
    missing = {s["name"] for s in result["missing_skills"]}
    assert {"Python", "FastAPI", "PostgreSQL", "Docker", "Git"} <= matched
    assert "Kubernetes" in missing and "AWS" in missing
    assert result["skill_coverage"] >= 60
    assert result["overall_match_score"] >= 40
    assert result["match_level"] in {"Good match", "Strong match"}


def test_unrelated_resume_scores_low(chef_resume_text, backend_jd):
    result = analyze(chef_resume_text, backend_jd)
    assert result["overall_match_score"] < 20
    assert result["skill_coverage"] < 20
    assert result["match_level"] == "Low match"


def test_related_scores_higher_than_unrelated(backend_resume_text, chef_resume_text, backend_jd):
    good = analyze(backend_resume_text, backend_jd)["overall_match_score"]
    bad = analyze(chef_resume_text, backend_jd)["overall_match_score"]
    assert good > bad + 25


def test_result_is_internally_consistent(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    matched = {s["name"] for s in r["matched_skills"]}
    missing = {s["name"] for s in r["missing_skills"]}
    additional = {s["name"] for s in r["additional_skills"]}
    assert not matched & missing and not matched & additional and not missing & additional
    assert len(matched) + len(missing) == r["job_skill_count"]
    assert r["skill_coverage"] == pytest.approx(len(matched) / r["job_skill_count"] * 100, abs=0.05)
    w = r["scoring_method"]["weights"]
    expected = w["tfidf"] * r["tfidf_similarity"] + w["skill_coverage"] * r["skill_coverage"]
    assert r["overall_match_score"] == pytest.approx(expected, abs=0.051)
    assert sum(c["required"] for c in r["category_breakdown"]) == r["job_skill_count"]
    assert sum(c["matched"] for c in r["category_breakdown"]) == len(matched)


def test_all_scores_within_bounds(backend_resume_text, chef_resume_text, backend_jd, frontend_jd):
    for resume in (backend_resume_text, chef_resume_text):
        for jd in (backend_jd, frontend_jd):
            r = analyze(resume, jd)
            assert 0 <= r["overall_match_score"] <= 100
            assert 0 <= r["tfidf_similarity"] <= 100
            assert r["skill_coverage"] is None or 0 <= r["skill_coverage"] <= 100


def test_jd_without_known_skills_reports_unavailable_coverage(backend_resume_text):
    jd = (
        "We need a friendly person to greet visitors, answer the phone, organise the "
        "front desk and keep the reception area tidy during office hours."
    )
    r = analyze(backend_resume_text, jd)
    assert r["skill_coverage"] is None
    assert r["overall_match_score"] == r["tfidf_similarity"]
    assert "TF-IDF Similarity" in r["scoring_method"]["overall_formula"]


@pytest.mark.parametrize("resume,jd", [("", "x " * 50), ("   \n\t ", "x " * 50)])
def test_empty_resume_rejected(resume, jd):
    with pytest.raises(InputValidationError, match="resume is empty"):
        analyze(resume, jd)


def test_empty_job_description_rejected(backend_resume_text):
    with pytest.raises(InputValidationError, match="job description is empty"):
        analyze(backend_resume_text, "")


def test_short_job_description_rejected(backend_resume_text):
    with pytest.raises(InputValidationError, match="too short"):
        analyze(backend_resume_text, "Python developer")


def test_scoring_method_has_disclaimer(backend_resume_text, backend_jd):
    method = analyze(backend_resume_text, backend_jd)["scoring_method"]
    assert "not a probability" in method["disclaimer"]


def test_alternatives_not_counted_as_missing(backend_resume_text, backend_jd):
    """Sample JD asks for 'FastAPI, Django or Flask'; resume has FastAPI and Flask."""
    r = analyze(backend_resume_text, backend_jd)
    assert "Django" not in {s["name"] for s in r["missing_skills"]}
    alt = {s["name"]: s["satisfied_by"] for s in r["alternative_skills"]}
    assert set(alt["Django"]) == {"FastAPI", "Flask"}
