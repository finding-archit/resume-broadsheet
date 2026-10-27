"""FastAPI application entry point.

Run with:  uvicorn app.main:app --reload   (from the backend/ directory)
Interactive API docs: http://127.0.0.1:8000/docs
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import router
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

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
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "AI Resume Matcher API. See /docs for interactive documentation."}
