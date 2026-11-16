import pytest

from app.services import text_preprocessor as tp


def test_clean_text_normalizes_whitespace_and_bullets():
    raw = "  Skills:\t\tPython   •  Java\r\n\r\n\r\n\r\n● SQL  "
    assert tp.clean_text(raw) == "Skills: Python Java\n\nSQL"


def test_clean_text_joins_hyphenated_line_breaks_and_ligatures():
    assert tp.clean_text("develop-\nment of ﬁnance apps") == "development of finance apps"


def test_clean_text_removes_contact_details():
    cleaned = tp.clean_text("Email: jane.doe@example.com Phone: +91 98765 43210 https://x.dev/me")
    assert "@" not in cleaned
    assert "98765" not in cleaned
    assert "https" not in cleaned


def test_clean_text_preserves_case_for_skill_detection():
    assert "Go" in tp.clean_text("Experience with Go and C++")


def test_clean_text_handles_empty_input():
    assert tp.clean_text("") == ""
    assert tp.clean_text(None) == ""


def test_tokenizer_preserves_technical_terms():
    tokens = tp.tokenize("Worked with C++, C#, .NET, Node.js, CI/CD and React.js.")
    for term in ["c++", "c#", ".net", "node.js", "ci/cd", "react.js"]:
        assert term in tokens


def test_tokenizer_strips_trailing_sentence_period():
    assert tp.tokenize("I know Python.") == ["i", "know", "python"]


def test_stop_words_removed_but_skills_kept():
    tokens = tp.analyzer("we are looking for a developer with python and the sql skills")
    assert "python" in tokens and "sql" in tokens
    assert "the" not in tokens and "we" not in tokens and "looking" not in tokens


def test_numbers_are_dropped():
    assert "2024" not in tp.analyzer("internship 2024 python")


# ---------- phone numbers vs year ranges ----------

@pytest.mark.parametrize(
    "text", ["B.Tech (2021 - 2025)", "Intern 2021-2025", "Intern (Jun 2024 - Dec 2024)", "(2016 - 2019)"]
)
def test_year_ranges_survive_cleaning(text):
    assert tp.clean_text(text) == text


@pytest.mark.parametrize(
    "phone", ["+91 98765 43210", "+1 (555) 123-4567", "555-123-4567", "+00 00000 00000"]
)
def test_phone_numbers_removed(phone):
    cleaned = tp.clean_text(f"Call {phone} today")
    assert cleaned == "Call today"


def test_year_ranges_on_consecutive_lines_are_not_a_phone():
    assert tp.clean_text("2019 - 2021\n2021 - 2023") == "2019 - 2021\n2021 - 2023"


# ---------- stemming ----------

def test_analyzer_stems_plain_words():
    assert tp.analyzer("cleaning analyzed datasets") == tp.analyzer("clean analyze dataset")


def test_analyzer_does_not_stem_skills_or_technical_terms():
    tokens = tp.analyzer("skill_machine_learning node.js python3 c++ ci/cd")
    assert tokens == ["skill_machine_learning", "node.js", "python3", "c++", "ci/cd"]


def test_stop_words_checked_before_stemming():
    # "using" is a stop word; its stem "use" must not leak into the output.
    assert tp.analyzer("using python") == ["python"]


def test_tokenize_is_not_stemmed():
    assert tp.tokenize("cleaning datasets") == ["cleaning", "datasets"]
