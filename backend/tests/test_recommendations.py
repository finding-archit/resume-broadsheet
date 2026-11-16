from app.services.analyzer import analyze
from app.services.recommendation_engine import generate_recommendations

FORBIDDEN = ["you have experience in", "certified", "add a certification"]


def test_recommendations_reference_actual_missing_skills(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    missing = {s["name"] for s in r["missing_skills"]}
    rec_skills = {s for rec in r["recommendations"] for s in rec["skills"]}
    gap_skills = {
        s for rec in r["recommendations"] if rec["category"] == "Missing skills" for s in rec["skills"]
    }
    assert gap_skills == missing
    assert rec_skills  # something concrete was recommended


def test_recommendations_sorted_by_priority(backend_resume_text, backend_jd):
    order = {"high": 0, "medium": 1, "low": 2}
    recs = analyze(backend_resume_text, backend_jd)["recommendations"]
    ranks = [order[r["priority"]] for r in recs]
    assert ranks == sorted(ranks)
    assert [r["id"] for r in recs] == list(range(1, len(recs) + 1))


def test_recommendations_do_not_fabricate(chef_resume_text, backend_jd):
    recs = analyze(chef_resume_text, backend_jd)["recommendations"]
    text = " ".join(r["detail"].lower() for r in recs)
    for phrase in FORBIDDEN:
        assert phrase not in text
    # Gap advice must be conditional on genuine experience.
    gap = next(r for r in recs if r["category"] == "Missing skills")
    assert "if you have real experience" in gap["detail"].lower()


def test_low_similarity_triggers_content_review(chef_resume_text, backend_jd):
    recs = analyze(chef_resume_text, backend_jd)["recommendations"]
    assert any(r["title"] == "Review project descriptions and experience bullets" for r in recs)


def test_required_missing_skills_are_high_priority(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    by_name = {s["name"]: s for s in r["missing_skills"]}
    # Kubernetes is under "Preferred Qualifications" in the sample JD.
    assert by_name["Kubernetes"]["priority"] == "low"



# ---------- grammatical number ----------

def _missing(name, priority):
    return {"name": name, "category": "x", "importance": "mentioned", "job_mentions": 1,
            "priority": priority}


def _details(missing):
    recs = generate_recommendations(
        missing=missing, matched=[], additional=[], job_keywords=[], tfidf_pct=30.0,
        coverage_pct=50.0, overall=40.0, resume_word_count=300,
    )
    return " ".join(r["detail"] for r in recs)


def test_recommendation_text_agrees_in_number():
    single = _details(
        [_missing("Communication", "high"), _missing("A/B Testing", "medium"),
         _missing("Redis", "low")]
    )
    assert "emphasises Communication, which was not found" in single
    assert "A/B Testing also appears" in single
    assert "Redis is listed as preferred" in single

    plural = _details(
        [_missing("Communication", "high"), _missing("Teamwork", "high"),
         _missing("AWS", "medium"), _missing("CI/CD", "medium"),
         _missing("Redis", "low"), _missing("Kubernetes", "low")]
    )
    assert "Communication and Teamwork, which were not found" in plural
    assert "AWS and CI/CD also appear" in plural
    assert "Redis and Kubernetes are listed" in plural


# ---------- evidence and anti-gaming ----------

def test_listed_skills_get_evidence_recommendation(backend_resume_text, backend_jd):
    r = analyze(backend_resume_text, backend_jd)
    listed = sorted(s["name"] for s in r["matched_skills"] if s["evidence"] == "listed")
    rec = next(x for x in r["recommendations"] if x["title"] == "Show where you used your listed skills")
    assert rec["priority"] == "medium" and rec["category"] == "Skill evidence"
    assert sorted(rec["skills"]) == listed and "Git" in listed


def test_score_cap_triggers_high_priority_recommendation(backend_jd):
    resume = "Skills: Python, FastAPI, Django, Flask, SQL, PostgreSQL, Git, GitHub, Docker, AWS"
    r = analyze(resume, backend_jd)
    assert r["score_cap"] is not None
    rec = next(x for x in r["recommendations"] if "keyword list" in x["title"])
    assert rec["priority"] == "high"


def test_copied_text_triggers_high_priority_recommendation(backend_jd):
    recs = analyze(backend_jd, backend_jd)["recommendations"]
    rec = next(x for x in recs if x["title"] == "Copied job-description text was ignored")
    assert rec["priority"] == "high"
    text = " ".join(x["detail"].lower() for x in recs)
    for phrase in FORBIDDEN:
        assert phrase not in text
