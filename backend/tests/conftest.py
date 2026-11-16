"""Shared fixtures. Document fixtures are generated at test time so the
repository contains no binary test files and tests run fully offline."""

import io
import sys
from pathlib import Path

import pytest

try:
    import pymupdf
except ImportError:  # PyMuPDF releases before 1.24.3 only provide "fitz"
    import fitz as pymupdf

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
SAMPLE_DIR = BACKEND_DIR.parent / "sample_data"


def read_sample(rel: str) -> str:
    return (SAMPLE_DIR / rel).read_text(encoding="utf-8")


def make_pdf_bytes(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 50, 550, 800), text, fontsize=10)
    data = doc.tobytes()
    doc.close()
    return data


def make_blank_pdf_bytes() -> bytes:
    """A valid PDF with a page but no text - behaves like a scanned resume."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.draw_rect(pymupdf.Rect(100, 100, 300, 300), color=(0, 0, 0), fill=(0.5, 0.5, 0.5))
    data = doc.tobytes()
    doc.close()
    return data


def make_docx_bytes(paragraphs: list[str], table_rows: list[list[str]] | None = None) -> bytes:
    import docx

    document = docx.Document()
    for p in paragraphs:
        document.add_paragraph(p)
    if table_rows:
        table = document.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for r, row in enumerate(table_rows):
            for c, value in enumerate(row):
                table.cell(r, c).text = value
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()


@pytest.fixture
def backend_resume_text() -> str:
    return read_sample("resumes/sample_resume_python_developer.txt")


@pytest.fixture
def chef_resume_text() -> str:
    return read_sample("resumes/sample_resume_unrelated_chef.txt")


@pytest.fixture
def backend_jd() -> str:
    return read_sample("job_descriptions/python_backend_developer.txt")


@pytest.fixture
def frontend_jd() -> str:
    return read_sample("job_descriptions/frontend_developer.txt")


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
