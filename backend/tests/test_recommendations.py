from app.services.analyzer import analyze

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
