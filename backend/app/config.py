"""Central configuration for the AI Resume Matcher backend.

All values can be overridden with environment variables (see .env.example).
No secrets or paid API keys are required.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    # Scoring weights (heuristic, NOT scientifically validated hiring weights).
    # TF-IDF captures overall vocabulary/context overlap; skill coverage captures
    # explicit requirement fulfilment. Text similarity gets the larger share
    # because it uses the whole document, while the taxonomy may not list
    # every skill a job description mentions.
    tfidf_weight: float = field(default_factory=lambda: _env_float("TFIDF_WEIGHT", 0.60))
    skill_weight: float = field(default_factory=lambda: _env_float("SKILL_WEIGHT", 0.40))

    # Input limits
    max_file_size_bytes: int = field(
        default_factory=lambda: _env_int("MAX_FILE_SIZE_MB", 5) * 1024 * 1024
    )
    min_resume_chars: int = 50
    min_resume_words: int = 10
    min_job_description_chars: int = 50
    min_job_description_words: int = 10
    max_text_chars: int = 100_000
    # Multipart overhead allowed on top of the file limit before /api/analyze
    # rejects a request body outright (413).
    request_overhead_bytes: int = 1024 * 1024

    # Anti-gaming: a resume with fewer descriptive segments (sentences/bullets
    # that describe work, not bare skill lists) is capped below "Good match".
    keyword_list_cap: float = 39.9
    min_descriptive_segments: int = 2

    allowed_extensions: tuple = (".pdf", ".docx")

    # Comma-separated list of origins allowed by CORS (the Vite dev server by default).
    cors_origins: tuple = field(
        default_factory=lambda: tuple(
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if o.strip()
        )
    )

    skills_file: Path = Path(__file__).parent / "data" / "skills.json"


settings = Settings()
