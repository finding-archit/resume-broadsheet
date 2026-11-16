"""Resume text extraction from PDF and DOCX files.

Security notes
--------------
* Files are validated by extension, size and *magic bytes* (file signature),
  so a renamed executable is rejected even with a ".pdf" extension.
* Document contents are only read as text; nothing inside them is executed
  (no macros, no embedded scripts, no external links are followed).
* Uploads are written to a private temporary directory (mode 0700) under a
  generated filename, never the user-supplied one, and the directory is
  removed in a ``finally`` block whether parsing succeeds or fails.
* Scanned (image-only) PDFs are NOT supported: OCR is not implemented, and
  such files are reported as having no extractable text.
"""

import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from app.config import settings

PDF_SIGNATURE = b"%PDF-"
ZIP_SIGNATURE = b"PK\x03\x04"  # DOCX files are ZIP archives


class ResumeParseError(Exception):
    """Base class for user-facing parsing errors."""

    status_code = 422


class UnsupportedFileError(ResumeParseError):
    status_code = 415


class FileTooLargeError(ResumeParseError):
    status_code = 413


class EmptyDocumentError(ResumeParseError):
    status_code = 422


class CorruptedDocumentError(ResumeParseError):
    status_code = 422


TEMP_DIR_PREFIX = "resume_matcher_"


def get_extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def validate_upload(filename: str, content: bytes) -> str:
    """Validate an upload and return its normalized extension."""
    ext = get_extension(filename)
    if ext not in settings.allowed_extensions:
        allowed = " or ".join(e.lstrip(".").upper() for e in settings.allowed_extensions)
        raise UnsupportedFileError(
            f"Unsupported file type '{ext or 'unknown'}'. Please upload a {allowed} file "
            "or paste your resume text."
        )
    if len(content) == 0:
        raise EmptyDocumentError("The uploaded file is empty.")
    if len(content) > settings.max_file_size_bytes:
        limit_mb = settings.max_file_size_bytes // (1024 * 1024)
        raise FileTooLargeError(f"The file is larger than the {limit_mb} MB limit.")
    if ext == ".pdf" and not content.startswith(PDF_SIGNATURE):
        raise CorruptedDocumentError(
            "This file does not look like a valid PDF (missing PDF signature)."
        )
    if ext == ".docx" and not content.startswith(ZIP_SIGNATURE):
        raise CorruptedDocumentError(
            "This file does not look like a valid DOCX document. Note that old "
            "Word .doc files are not supported; save the resume as .docx or PDF."
        )
    return ext


def _import_pymupdf():
    try:
        import pymupdf
    except ImportError:  # PyMuPDF releases before 1.24.3 only provide "fitz"
        import fitz as pymupdf
    return pymupdf


def _extract_pdf(path: Path) -> str:
    pymupdf = _import_pymupdf()

    try:
        # Open from bytes, not the path: if opening fails, PyMuPDF's exception
        # keeps a path-opened file handle alive, and Windows then refuses to
        # delete the temporary file.
        doc = pymupdf.open(stream=path.read_bytes(), filetype="pdf")
    except Exception as exc:  # PyMuPDF raises several internal error types
        raise CorruptedDocumentError(
            "The PDF could not be opened. It may be corrupted or incomplete."
        ) from exc
    try:
        if doc.needs_pass:
            raise CorruptedDocumentError(
                "The PDF is password-protected. Please upload an unlocked copy."
            )
        if doc.page_count == 0:
            raise EmptyDocumentError("The PDF has no pages.")
        try:
            pages = [page.get_text("text") for page in doc]
        except Exception as exc:
            raise CorruptedDocumentError("Text could not be read from this PDF.") from exc
    finally:
        doc.close()
    text = "\n".join(pages).strip()
    if not text:
        raise EmptyDocumentError(
            "No extractable text was found in this PDF. It may be a scanned image; "
            "OCR is not supported, so please upload a text-based PDF/DOCX or paste the text."
        )
    return text


def _extract_docx(path: Path) -> str:
    import docx  # python-docx

    try:
        document = docx.Document(str(path))
    except (zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise CorruptedDocumentError(
            "The DOCX file could not be opened. It may be corrupted."
        ) from exc
    except Exception as exc:
        raise CorruptedDocumentError("The DOCX file could not be read.") from exc

    parts = [p.text for p in document.paragraphs]
    # Many resume templates put content in tables (e.g. two-column layouts).
    for table in document.tables:
        for row in table.rows:
            seen = set()
            for cell in row.cells:
                # Merged cells are returned repeatedly; keep each once.
                if id(cell._tc) in seen:
                    continue
                seen.add(id(cell._tc))
                parts.append(cell.text)
    text = "\n".join(p for p in parts if p and p.strip()).strip()
    if not text:
        raise EmptyDocumentError("No text was found in this DOCX document.")
    return text


def extract_text_from_file(filename: str, content: bytes) -> str:
    """Validate and extract text from an uploaded resume file.

    The bytes are written to a private temporary directory that is always
    deleted afterwards.
    """
    ext = validate_upload(filename, content)
    tmp_dir = tempfile.mkdtemp(prefix=TEMP_DIR_PREFIX)
    try:
        os.chmod(tmp_dir, 0o700)
        tmp_path = Path(tmp_dir) / f"upload{ext}"  # never trust the client's filename
        tmp_path.write_bytes(content)
        if ext == ".pdf":
            return _extract_pdf(tmp_path)
        return _extract_docx(tmp_path)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
