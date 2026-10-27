import os
import tempfile

import pytest

from app.services import resume_parser as rp
from tests.conftest import make_blank_pdf_bytes, make_docx_bytes, make_pdf_bytes

RESUME = "Jane Doe\nSoftware Engineer\nSkills: Python, FastAPI, PostgreSQL, Docker"


def test_extract_pdf_text():
    text = rp.extract_text_from_file("resume.pdf", make_pdf_bytes(RESUME))
    assert "Python" in text and "PostgreSQL" in text


def test_extract_docx_paragraphs_and_tables():
    data = make_docx_bytes(["Jane Doe", "Skills: Python, Docker"], [["Tools", "Git, Linux"]])
    text = rp.extract_text_from_file("resume.docx", data)
    assert "Python" in text and "Git, Linux" in text


def test_extension_is_case_insensitive():
    assert "Python" in rp.extract_text_from_file("RESUME.PDF", make_pdf_bytes(RESUME))


@pytest.mark.parametrize("filename", ["resume.txt", "resume.doc", "resume.exe", "resume", "a.pdf.exe"])
def test_unsupported_extensions_rejected(filename):
    with pytest.raises(rp.UnsupportedFileError):
        rp.extract_text_from_file(filename, b"%PDF-1.4 anything")


def test_empty_file_rejected():
    with pytest.raises(rp.EmptyDocumentError):
        rp.extract_text_from_file("resume.pdf", b"")


def test_oversized_file_rejected():
    big = b"%PDF-" + b"0" * (rp.settings.max_file_size_bytes + 1)
    with pytest.raises(rp.FileTooLargeError):
        rp.extract_text_from_file("resume.pdf", big)


def test_renamed_non_pdf_rejected_by_signature():
    with pytest.raises(rp.CorruptedDocumentError, match="valid PDF"):
        rp.extract_text_from_file("resume.pdf", b"MZ\x90\x00 this is an executable")


def test_corrupted_pdf_rejected():
    with pytest.raises(rp.CorruptedDocumentError):
        rp.extract_text_from_file("resume.pdf", b"%PDF-1.7\n garbage garbage \x00\x01\x02")


def test_truncated_pdf_rejected_or_empty():
    data = make_pdf_bytes(RESUME)[:120]
    with pytest.raises((rp.CorruptedDocumentError, rp.EmptyDocumentError)):
        rp.extract_text_from_file("resume.pdf", data)


def test_corrupted_docx_rejected():
    with pytest.raises(rp.CorruptedDocumentError):
        rp.extract_text_from_file("resume.docx", b"PK\x03\x04 not really a zip archive")


def test_legacy_doc_renamed_to_docx_rejected():
    with pytest.raises(rp.CorruptedDocumentError, match="not look like a valid DOCX"):
        rp.extract_text_from_file("resume.docx", b"\xd0\xcf\x11\xe0 legacy word doc")


def test_pdf_without_text_reports_scanned():
    with pytest.raises(rp.EmptyDocumentError, match="OCR is not supported"):
        rp.extract_text_from_file("scan.pdf", make_blank_pdf_bytes())


def test_empty_docx_rejected():
    with pytest.raises(rp.EmptyDocumentError):
        rp.extract_text_from_file("resume.docx", make_docx_bytes(["", "   "]))


def _leftover_dirs():
    root = tempfile.gettempdir()
    return {d for d in os.listdir(root) if d.startswith(rp.TEMP_DIR_PREFIX)}


def test_temp_files_cleaned_up_after_success(monkeypatch):
    created = []
    real_mkdtemp = tempfile.mkdtemp

    def spy(*args, **kwargs):
        path = real_mkdtemp(*args, **kwargs)
        created.append(path)
        return path

    monkeypatch.setattr(rp.tempfile, "mkdtemp", spy)
    rp.extract_text_from_file("resume.pdf", make_pdf_bytes(RESUME))
    assert created and not os.path.exists(created[0])


def test_temp_files_cleaned_up_after_failure(monkeypatch):
    created = []
    real_mkdtemp = tempfile.mkdtemp

    def spy(*args, **kwargs):
        path = real_mkdtemp(*args, **kwargs)
        created.append(path)
        return path

    monkeypatch.setattr(rp.tempfile, "mkdtemp", spy)
    with pytest.raises(rp.CorruptedDocumentError):
        rp.extract_text_from_file("resume.pdf", b"%PDF-1.7 broken")
    assert created and not os.path.exists(created[0])


def test_no_temp_dirs_leak_across_many_parses():
    before = _leftover_dirs()
    for _ in range(5):
        rp.extract_text_from_file("resume.docx", make_docx_bytes(["Python developer"]))
    assert _leftover_dirs() == before
