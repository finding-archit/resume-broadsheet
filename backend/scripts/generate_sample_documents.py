"""Generate demo PDF and DOCX resumes from the fictional sample text files.

Usage (from backend/):  python scripts/generate_sample_documents.py
Output: sample_data/resumes/*.pdf and *.docx
"""

from pathlib import Path

import docx
import fitz  # PyMuPDF

RESUME_DIR = Path(__file__).resolve().parents[2] / "sample_data" / "resumes"


def is_heading(line: str) -> bool:
    return line.isupper() and len(line.split()) <= 4


def write_pdf(text: str, out: Path) -> None:
    doc = fitz.open()
    page = doc.new_page()
    y = 56
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            y += 6
            continue
        size, font = (11.5, "helvetica-bold") if is_heading(line) else (10, "helvetica")
        # Wrap long lines by width using PyMuPDF's text box.
        rect = fitz.Rect(56, y, 540, y + 200)
        used = page.insert_textbox(rect, line, fontsize=size, fontname=font)
        height = 200 - used if used >= 0 else 14
        y += max(height, size + 4) + 2
        if y > 780:
            page = doc.new_page()
            y = 56
    doc.save(out)
    doc.close()


def write_docx(text: str, out: Path) -> None:
    document = docx.Document()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if is_heading(line):
            document.add_heading(line.title(), level=2)
        elif line.startswith("- "):
            document.add_paragraph(line[2:], style="List Bullet")
        else:
            document.add_paragraph(line)
    document.save(out)


def main() -> None:
    for txt in sorted(RESUME_DIR.glob("*.txt")):
        text = txt.read_text(encoding="utf-8")
        write_pdf(text, txt.with_suffix(".pdf"))
        write_docx(text, txt.with_suffix(".docx"))
        print(f"Created {txt.stem}.pdf and {txt.stem}.docx")


if __name__ == "__main__":
    main()
