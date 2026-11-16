"""HTTP endpoints."""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import __version__
from app.config import settings
from app.schemas.analysis import AnalysisResponse, ConfigResponse, ErrorResponse, HealthResponse
from app.services import matching_engine as me
from app.services.analyzer import InputValidationError, analyze
from app.services.resume_parser import FileTooLargeError, ResumeParseError, extract_text_from_file
from app.services.skill_extractor import get_taxonomy

# Only metadata is logged (sizes, types, status) - never resume or job text.
logger = logging.getLogger("resume_matcher")

router = APIRouter(prefix="/api")

_ERRORS = {
    400: {"model": ErrorResponse, "description": "Missing or conflicting resume input"},
    413: {"model": ErrorResponse, "description": "File or request body too large"},
    415: {"model": ErrorResponse, "description": "Unsupported file type"},
    422: {"model": ErrorResponse, "description": "Unreadable document or invalid text"},
}


@router.get("/health", response_model=HealthResponse, tags=["System"])
def health():
    return {"status": "ok", "version": __version__, "skills_in_taxonomy": len(get_taxonomy())}


@router.get("/config", response_model=ConfigResponse, tags=["System"])
def config():
    """Scoring weights, bands and input limits, so clients need not hard-code them."""
    w_t, w_s = me.normalized_weights()
    categories: dict[str, int] = {}
    for skill in get_taxonomy():
        categories[skill.category] = categories.get(skill.category, 0) + 1
    return {
        "version": __version__,
        "weights": {"tfidf": round(w_t, 4), "skill_coverage": round(w_s, 4)},
        "bands": me.bands(),
        "max_file_size_mb": settings.max_file_size_bytes // (1024 * 1024),
        "min_resume_chars": settings.min_resume_chars,
        "min_resume_words": settings.min_resume_words,
        "min_job_description_chars": settings.min_job_description_chars,
        "min_job_description_words": settings.min_job_description_words,
        "skills_in_taxonomy": len(get_taxonomy()),
        "categories": [{"name": name, "count": count} for name, count in categories.items()],
        "keyword_list_cap": settings.keyword_list_cap,
    }


async def _read_limited(upload: UploadFile) -> bytes:
    """Read an upload without accepting more than the configured size."""
    limit = settings.max_file_size_bytes
    content = await upload.read(limit + 1)
    if len(content) > limit:
        raise FileTooLargeError(f"The file is larger than the {limit // (1024 * 1024)} MB limit.")
    return content


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    responses=_ERRORS,
    tags=["Analysis"],
    summary="Compare a resume with a job description",
)
async def analyze_resume(
    job_description: str = Form(..., description="Full job description text"),
    resume_file: UploadFile | None = File(None, description="Resume as PDF or DOCX (max 5 MB)"),
    resume_text: str | None = Form(None, description="Resume as plain text (alternative to a file)"),
):
    """Send **either** `resume_file` **or** `resume_text`, plus `job_description`,
    as `multipart/form-data`. Files are processed in a temporary directory and
    deleted immediately; nothing is stored."""
    has_file = resume_file is not None and bool(resume_file.filename)
    has_text = bool(resume_text and resume_text.strip())
    if has_file and has_text:
        raise HTTPException(400, "Provide either a resume file or pasted resume text, not both.")
    if not has_file and not has_text:
        raise HTTPException(400, "Please upload a resume file or paste your resume text.")

    try:
        if has_file:
            content = await _read_limited(resume_file)
            text = await run_in_threadpool(extract_text_from_file, resume_file.filename, content)
            source = {"type": "file", "filename": resume_file.filename, "size_bytes": len(content)}
        else:
            text = resume_text
            source = {"type": "text"}
        result = await run_in_threadpool(analyze, text, job_description, source)
    except ResumeParseError as exc:
        logger.info("resume rejected: %s (%s)", type(exc).__name__, exc.status_code)
        raise HTTPException(exc.status_code, str(exc)) from None
    except InputValidationError as exc:
        logger.info("input rejected: validation error")
        raise HTTPException(422, str(exc)) from None
    finally:
        if resume_file is not None:
            await resume_file.close()

    logger.info(
        "analysis complete: source=%s score=%.1f", source["type"], result["overall_match_score"]
    )
    return result
