from app.services import resume_parser as rp
from tests.conftest import make_blank_pdf_bytes, make_docx_bytes, make_pdf_bytes

REQUIRED_KEYS = {
    "overall_match_score",
    "tfidf_similarity",
    "skill_coverage",
    "matched_skills",
    "missing_skills",
    "additional_skills",
    "extracted_resume_text_length",
    "job_description_keywords",
    "recommendations",
    "scoring_method",
}


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok" and body["skills_in_taxonomy"] > 50


def test_openapi_docs_available(client):
    assert client.get("/docs").status_code == 200
    assert "/api/analyze" in client.get("/openapi.json").json()["paths"]


def test_analyze_with_pasted_text(client, backend_resume_text, backend_jd):
    res = client.post(
        "/api/analyze", data={"resume_text": backend_resume_text, "job_description": backend_jd}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert REQUIRED_KEYS <= body.keys()
    assert body["input_source"] == {"type": "text"}
    assert 0 <= body["overall_match_score"] <= 100


def test_analyze_with_pdf(client, backend_resume_text, backend_jd):
    pdf = make_pdf_bytes(backend_resume_text)
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("resume.pdf", pdf, "application/pdf")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["input_source"]["filename"] == "resume.pdf"
    assert "Python" in {s["name"] for s in body["matched_skills"]}


def test_pdf_and_text_give_same_skills(client, backend_resume_text, backend_jd):
    pdf = make_pdf_bytes(backend_resume_text)
    from_pdf = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("r.pdf", pdf, "application/pdf")},
    ).json()
    from_text = client.post(
        "/api/analyze", data={"resume_text": backend_resume_text, "job_description": backend_jd}
    ).json()
    assert {s["name"] for s in from_pdf["matched_skills"]} == {
        s["name"] for s in from_text["matched_skills"]
    }


def test_analyze_with_docx(client, backend_jd):
    docx_bytes = make_docx_bytes(
        ["Backend developer", "Python, FastAPI, PostgreSQL, Docker, Git and AWS for REST APIs"]
    )
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("cv.docx", docx_bytes, "application/octet-stream")},
    )
    assert res.status_code == 200, res.text
    assert "AWS" in {s["name"] for s in res.json()["matched_skills"]}


def test_missing_resume_returns_400(client, backend_jd):
    res = client.post("/api/analyze", data={"job_description": backend_jd})
    assert res.status_code == 400
    assert "upload a resume" in res.json()["detail"]


def test_both_file_and_text_returns_400(client, backend_resume_text, backend_jd):
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd, "resume_text": backend_resume_text},
        files={"resume_file": ("r.pdf", make_pdf_bytes(backend_resume_text), "application/pdf")},
    )
    assert res.status_code == 400


def test_missing_job_description_returns_422(client, backend_resume_text):
    res = client.post("/api/analyze", data={"resume_text": backend_resume_text})
    assert res.status_code == 422


def test_short_job_description_returns_422(client, backend_resume_text):
    res = client.post(
        "/api/analyze", data={"resume_text": backend_resume_text, "job_description": "Python dev"}
    )
    assert res.status_code == 422
    assert "too short" in res.json()["detail"]


def test_unsupported_file_returns_415(client, backend_jd):
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("resume.txt", b"plain text resume", "text/plain")},
    )
    assert res.status_code == 415


def test_corrupted_pdf_returns_422(client, backend_jd):
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("resume.pdf", b"%PDF-1.7 corrupted", "application/pdf")},
    )
    assert res.status_code == 422
    assert "corrupted" in res.json()["detail"]


def test_scanned_pdf_returns_422(client, backend_jd):
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("scan.pdf", make_blank_pdf_bytes(), "application/pdf")},
    )
    assert res.status_code == 422
    assert "OCR" in res.json()["detail"]


def test_oversized_file_returns_413(client, backend_jd):
    big = b"%PDF-" + b"0" * (rp.settings.max_file_size_bytes + 10)
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("big.pdf", big, "application/pdf")},
    )
    assert res.status_code == 413


def test_resume_text_is_not_logged(client, caplog, backend_resume_text, backend_jd):
    caplog.set_level("DEBUG")
    client.post(
        "/api/analyze", data={"resume_text": backend_resume_text, "job_description": backend_jd}
    )
    logged = " ".join(r.getMessage() for r in caplog.records)
    assert "PRIYA" not in logged and "FastAPI and PostgreSQL" not in logged



NEW_KEYS = {
    "similarity_terms",
    "evidence_summary",
    "copied_text_removed",
    "score_cap",
    "documents",
}


def test_analyze_response_has_new_fields(client, backend_resume_text, backend_jd):
    body = client.post(
        "/api/analyze", data={"resume_text": backend_resume_text, "job_description": backend_jd}
    ).json()
    assert NEW_KEYS <= body.keys()
    assert body["score_cap"] is None
    assert body["documents"]["resume"]["spans"] and body["documents"]["job"]["spans"]
    assert {"evidence"} <= body["matched_skills"][0].keys()


def test_config_endpoint(client):
    res = client.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    assert body["weights"] == {"tfidf": 0.6, "skill_coverage": 0.4}
    assert body["bands"] == [
        {"min": 60, "label": "Strong match"},
        {"min": 40, "label": "Good match"},
        {"min": 20, "label": "Partial match"},
        {"min": 0, "label": "Low match"},
    ]
    assert body["max_file_size_mb"] == 5
    assert body["min_resume_words"] == 10 and body["min_job_description_words"] == 10
    assert body["skills_in_taxonomy"] == 118
    assert sum(c["count"] for c in body["categories"]) == 118
    assert body["keyword_list_cap"] == 39.9
    assert "/api/config" in client.get("/openapi.json").json()["paths"]


def _request_limit():
    return rp.settings.max_file_size_bytes + rp.settings.request_overhead_bytes


def test_oversized_request_body_returns_413(client, backend_jd):
    big = b"%PDF-" + b"0" * (_request_limit() + 10)
    res = client.post(
        "/api/analyze",
        data={"job_description": backend_jd},
        files={"resume_file": ("big.pdf", big, "application/pdf")},
    )
    assert res.status_code == 413
    assert "too large" in res.json()["detail"]


def test_streamed_body_without_content_length_is_limited(client):
    chunk = b"0" * (256 * 1024)
    chunks = _request_limit() // len(chunk) + 2

    def body():
        yield (
            b'--xyz\r\nContent-Disposition: form-data; name="resume_file"; filename="r.pdf"\r\n'
            b"Content-Type: application/pdf\r\n\r\n%PDF-"
        )
        for _ in range(chunks):
            yield chunk

    res = client.post(
        "/api/analyze",
        content=body(),
        headers={"content-type": "multipart/form-data; boundary=xyz"},
    )
    assert res.status_code == 413
    assert "too large" in res.json()["detail"]


def test_uploads_are_spooled_in_memory_up_to_the_limit():
    from starlette.formparsers import MultiPartParser

    import app.main  # noqa: F401  (applies the setting)

    assert MultiPartParser.spool_max_size == rp.settings.max_file_size_bytes
