"""FastAPI application entry point.

Run with:  uvicorn app.main:app --reload   (from the backend/ directory)
Interactive API docs: http://127.0.0.1:8000/docs
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.formparsers import MultiPartParser

from app import __version__
from app.api.routes import router
from app.config import settings
from app.middleware import RequestSizeLimitMiddleware

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

# Starlette spools uploaded files to its own temporary files above
# ``spool_max_size`` (1 MB by default). Keep uploads up to our limit in memory;
# the parser writes them to a private temp directory that is always deleted.
if hasattr(MultiPartParser, "spool_max_size"):
    MultiPartParser.spool_max_size = settings.max_file_size_bytes

app = FastAPI(
    title="AI Resume Matcher API",
    version=__version__,
    description=(
        "Compares a resume with a job description using NLP (text preprocessing, "
        "skill extraction, TF-IDF and cosine similarity). The match score measures "
        "similarity only; it is **not** a probability of being hired."
    ),
)

app.add_middleware(
    RequestSizeLimitMiddleware,
    max_body_bytes=settings.max_file_size_bytes + settings.request_overhead_bytes,
    paths=("/api/analyze",),
)
# Added last so it is outermost and 413 responses also carry CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "AI Resume Matcher API. See /docs for interactive documentation."}
