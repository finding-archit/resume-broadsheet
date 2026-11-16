import pytest

from app.services import matching_engine as me
from app.services import text_preprocessor as tp
from app.services.analyzer import InputValidationError, analyze
from tests.conftest import read_sample


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



# ---------- performance ----------

def test_long_resume_is_analyzed_quickly(backend_jd):
    import time

    resume = ("Python developer using Docker and SQL daily. " * 2200)[:99000]
    start = time.perf_counter()
    analyze(resume, backend_jd)
    assert time.perf_counter() - start < 5.0


# ---------- stemming and readable keywords ----------

def test_stemming_matches_inflected_words():
    assert me.compute_tfidf("cleaned datasets", "cleaning dataset").similarity == pytest.approx(1.0)


def test_keywords_use_most_frequent_surface_form():
    result = me.compute_tfidf(
        "python", "Analyzing trends. We analyze sales and analyze churn in Python."
    )
    terms = {k["term"] for k in result.keywords}
    assert "analyze" in terms and "analyz" not in terms and "Python" in terms


def test_keyword_surface_ties_use_first_seen_word():
    result = me.compute_tfidf("python", "Reporting tools and report builders for Python teams")
    assert "reporting" in {k["term"] for k in result.keywords}


# ---------- similarity explanation ----------

def test_similarity_term_contributions_sum_to_one(backend_resume_text, backend_jd):
    result = me.compute_tfidf(tp.clean_text(backend_resume_text), tp.clean_text(backend_jd))
    assert result.similarity > 0
    assert sum(t["contribution"] for t in result.shared_terms) == pytest.approx(1.0, abs=1e-6)
    top = me.similarity_terms(result)
    assert 0 < len(top) <= 12
    assert sum(t["contribution"] for t in top) <= 1.0
    contributions = [t["contribution"] for t in top]
    assert contributions == sorted(contributions, reverse=True)
    python = next(t for t in top if t["term"] == "Python")
    assert python["is_skill"] is True and python["resume_weight"] > 0 and python["job_weight"] > 0


def test_similarity_terms_empty_without_overlap():
    result = me.compute_tfidf("chef cooking menus kitchen", "python developer apis databases")
    assert me.similarity_terms(result) == []


def test_similarity_terms_in_response(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    assert r["similarity_terms"] and len(r["similarity_terms"]) <= 12
    assert sum(t["contribution"] for t in r["similarity_terms"]) <= 1.0 + 1e-9


# ---------- evidence ----------

def test_skill_evidence_demonstrated_vs_listed(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    evidence = {s["name"]: s["evidence"] for s in r["matched_skills"]}
    assert evidence["FastAPI"] == "demonstrated"  # used in an experience bullet
    assert evidence["Git"] == "listed"  # only in "Tools: Git, GitHub, ..."
    assert all("evidence" in s for s in r["additional_skills"])
    summary = r["evidence_summary"]
    assert summary["descriptive_segments"] >= 2
    assert summary["demonstrated"] + summary["listed"] + summary["inferred"] == len(
        r["matched_skills"]
    )


def test_implied_skill_evidence_is_inferred():
    resume = (
        "Built reporting APIs backed by PostgreSQL for the finance team.\n"
        "Maintained nightly batch jobs and improved their reliability over a year."
    )
    jd = "We need a developer with strong SQL skills to build reporting services for finance."
    r = analyze(resume, jd)
    sql = next(s for s in r["matched_skills"] if s["name"] == "SQL")
    assert sql["implied"] is True and sql["evidence"] == "inferred"
    assert r["evidence_summary"]["inferred"] == 1


def test_descriptive_segment_rules():
    from app.services.evidence import assess_evidence, is_label_list
    from app.services.skill_extractor import detect_mentions

    assert is_label_list("Tools: Git, GitHub, Docker, Postman")
    assert not is_label_list("Built dashboards, reports and alerts for the operations team")
    text = (
        "Skills: Python, SQL, Docker, Git, Linux, AWS\n"
        "Python SQL Docker Git AWS Linux Kubernetes\n"
        "Short line here.\n"
        "Automated monthly reporting in Python, saving six hours each month."
    )
    report = assess_evidence(text, detect_mentions(text))
    assert report.descriptive_segments == 1
    assert report.by_skill["Python"] == "demonstrated"
    assert report.by_skill["Docker"] == "listed"


# ---------- copied text ----------

def test_pasting_the_job_description_scores_low(backend_jd):
    r = analyze(backend_jd, backend_jd)
    assert r["overall_match_score"] < 20
    assert r["copied_text_removed"]["lines"] > 0
    assert r["copied_text_removed"]["characters"] > 0
    assert any("copied from the job description" in w for w in r["warnings"])


def test_fully_copied_resume_still_returns_a_result(backend_jd):
    copied = "\n".join(line for line in backend_jd.splitlines() if len(line.split()) >= 9)
    r = analyze(copied, backend_jd)
    assert r["documents"]["resume"]["text"] == ""
    assert r["tfidf_similarity"] == 0 and r["matched_skills"] == []
    assert r["overall_match_score"] == 0


def test_genuine_resume_has_no_copied_lines(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    assert r["copied_text_removed"] == {"lines": 0, "characters": 0}


# ---------- keyword-list cap ----------

KEYWORD_LIST = (
    "Skills: Python, FastAPI, Django, Flask, SQL, PostgreSQL, Git, GitHub, Docker, AWS, CI/CD, "
    "Agile, Redis, Microservices, Kubernetes, REST API, Unit Testing, Object-Oriented "
    "Programming, Communication, Problem Solving, Teamwork backend services APIs"
)


def test_keyword_list_resume_is_capped(backend_jd):
    r = analyze(KEYWORD_LIST, backend_jd)
    assert r["overall_match_score"] <= 39.9
    assert r["match_level"] == "Partial match"
    cap = r["score_cap"]
    assert cap["applied"] is True and cap["max_score"] == 39.9
    assert cap["uncapped_score"] > 39.9 and cap["reason"]


def test_genuine_resumes_are_not_capped(backend_resume_text, chef_resume_text, backend_jd):
    good = analyze(backend_resume_text, backend_jd)
    assert good["score_cap"] is None and good["match_level"] == "Good match"
    analyst = analyze(
        read_sample("resumes/sample_resume_data_analyst.txt"),
        read_sample("job_descriptions/data_analyst.txt"),
    )
    assert analyst["score_cap"] is None
    assert analyze(chef_resume_text, backend_jd)["score_cap"] is None


def test_scoring_method_documents_adjustments_and_bands(backend_resume_text, backend_jd):
    method = analyze(backend_resume_text, backend_jd)["scoring_method"]
    assert "39.9" in method["adjustments"]
    assert method["bands"][0] == {"min": 60, "label": "Strong match"}
    assert [b["min"] for b in method["bands"]] == [60, 40, 20, 0]


# ---------- negation in the pipeline ----------

def test_negated_resume_skill_is_missing(backend_jd):
    resume = (
        "Backend developer building REST APIs in Python with FastAPI and PostgreSQL.\n"
        "Wrote unit tests and reviewed code for a team of five developers.\n"
        "No experience with Kubernetes or Redis yet."
    )
    r = analyze(resume, backend_jd)
    missing = {s["name"] for s in r["missing_skills"]}
    assert {"Kubernetes", "Redis"} <= missing
    negated = {s["skill"] for s in r["documents"]["resume"]["spans"] if s["status"] == "negated"}
    assert negated == {"Kubernetes", "Redis"}


# ---------- highlight spans ----------

def _assert_spans_are_mentions(doc, allowed):
    from app.services.skill_extractor import get_taxonomy

    by_name = {s.name: s for s in get_taxonomy()}
    text = doc["text"]
    for span in doc["spans"]:
        assert span["status"] in allowed
        skill = by_name[span["skill"]]
        assert span["category"] == skill.category
        assert any(
            (m := p.regex.match(text, span["start"])) and m.end() == span["end"]
            for p in skill.patterns
        ), (span, text[span["start"]:span["end"]])


def test_highlight_spans_point_at_real_mentions(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    resume_doc, job_doc = r["documents"]["resume"], r["documents"]["job"]
    _assert_spans_are_mentions(resume_doc, {"matched", "additional", "negated"})
    _assert_spans_are_mentions(job_doc, {"matched", "missing", "alternative", "negated"})
    assert "@" not in resume_doc["text"]
    matched = {s["name"] for s in r["matched_skills"]}
    explicit = {s["name"] for s in r["matched_skills"] if not s["implied"]}
    assert {s["skill"] for s in resume_doc["spans"] if s["status"] == "matched"} == explicit
    job_status = {s["skill"]: s["status"] for s in job_doc["spans"]}
    assert job_status["Django"] == "alternative"
    assert job_status["Kubernetes"] == "missing"
    assert all(job_status[name] == "matched" for name in matched if name in job_status)
