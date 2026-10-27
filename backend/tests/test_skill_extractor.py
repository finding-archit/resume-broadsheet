import pytest

from app.services.skill_extractor import (
    canonical_token,
    extract_skills,
    replace_skills_with_tokens,
)


def names(text, **kwargs):
    return set(extract_skills(text, **kwargs))


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Built apps in JS and ES6", "JavaScript"),
        ("Applied ML to forecasting", "Machine Learning"),
        ("Research in natural language processing", "Natural Language Processing"),
        ("Coursework in NLP", "Natural Language Processing"),
        ("Deployed on Amazon Web Services", "AWS"),
        ("Deployed on AWS", "AWS"),
        ("Used sklearn for modelling", "scikit-learn"),
        ("Services written in Golang", "Go"),
        ("Experience with k8s clusters", "Kubernetes"),
        ("Built RESTful services", "REST API"),
        ("Strong machine-learning background", "Machine Learning"),
    ],
)
def test_alias_normalization(text, expected):
    assert expected in names(text)


def test_multiword_phrase_matching_across_whitespace():
    assert "Machine Learning" in names("Passionate about machine\nlearning")


def test_c_does_not_match_ordinary_letters_or_cpp():
    text = "Proficient in C++ and C#. Can communicate clearly. Vitamin c. C-level reporting."
    found = names(text)
    assert "C++" in found and "C#" in found
    assert "C" not in found


def test_c_matches_when_used_as_language():
    assert "C" in names("Languages: C, Python")
    assert {"C", "C++"} <= names("Languages: C/C++")


def test_java_does_not_match_javascript():
    found = names("Frontend work in JavaScript")
    assert "JavaScript" in found and "Java" not in found


def test_go_and_r_are_case_sensitive():
    found = names("We go to great lengths. Ready to learn. R&D team.")
    assert "Go" not in found and "R" not in found
    assert {"Go", "R"} <= names("Languages: Go, R, Python")


def test_js_inside_node_js_is_not_javascript():
    found = names("Backend in Node.js")
    assert "Node.js" in found and "JavaScript" not in found


def test_dotnet_and_technical_punctuation():
    assert ".NET" in names("Built services with ASP.NET Core")
    assert "CI/CD" in names("Set up CI/CD with GitHub Actions")


def test_excel_verb_is_not_microsoft_excel():
    assert "Microsoft Excel" not in names("I always excel at teamwork")
    assert "Microsoft Excel" in names("Advanced Excel and pivot tables")


def test_overlapping_matches_prefer_longest():
    found = names("Administered SQL Server databases")
    assert "Microsoft SQL Server" in found


def test_implied_skills_are_flagged():
    result = extract_skills("Built APIs backed by PostgreSQL")
    assert result["SQL"].implied is True
    assert result["SQL"].implied_by == ["PostgreSQL"]
    assert result["PostgreSQL"].implied is False


def test_implied_skills_excluded_for_job_descriptions():
    assert "SQL" not in names("Experience with PostgreSQL", include_implied=False)


def test_mention_counts():
    assert extract_skills("Python, python and PYTHON")["Python"].count == 3


def test_importance_detection_from_sections_and_markers():
    jd = (
        "Requirements:\n- Python and SQL\n- Docker\n"
        "Preferred Qualifications:\n- Kubernetes\n"
        "Responsibilities:\n- Write code in Java\n"
        "Experience with Redis is a plus."
    )
    skills = extract_skills(jd, detect_importance=True)
    assert skills["Python"].importance == "required"
    assert skills["Docker"].importance == "required"
    assert skills["Kubernetes"].importance == "preferred"
    assert skills["Java"].importance == "mentioned"
    assert skills["Redis"].importance == "preferred"


def test_canonical_tokens_are_single_words():
    assert canonical_token("C++") == "skill_cplusplus"
    assert canonical_token("C#") == "skill_csharp"
    assert canonical_token(".NET") == "skill_dotnet"
    assert canonical_token("Machine Learning") == "skill_machine_learning"


def test_replace_skills_with_tokens_unifies_aliases():
    a = replace_skills_with_tokens("Expert in JS")
    b = replace_skills_with_tokens("Expert in JavaScript")
    assert "skill_javascript" in a and "skill_javascript" in b


def test_no_skills_in_plain_text():
    assert names("The quick brown fox jumps over the lazy dog.") == set()


def test_or_lists_form_alternative_groups():
    skills = extract_skills("Experience with FastAPI, Django or Flask.", detect_importance=True)
    assert skills["Django"].alternative_groups == [{"FastAPI", "Flask"}]


def test_comma_lists_are_not_alternatives():
    skills = extract_skills("Skills: Python, SQL, Docker", detect_importance=True)
    assert skills["SQL"].alternative_groups == [set()]


def test_and_breaks_alternative_group():
    skills = extract_skills("PyTorch or TensorFlow and scikit-learn", detect_importance=True)
    assert skills["PyTorch"].alternative_groups == [{"TensorFlow"}]
    assert skills["scikit-learn"].alternative_groups == [set()]


def test_satisfied_by_alternative():
    from app.services.skill_extractor import satisfied_by_alternative

    jd = extract_skills("Use AWS or GCP for deployment.", detect_importance=True)
    assert satisfied_by_alternative(jd["Google Cloud Platform"], {"AWS"}) == ["AWS"]
    assert satisfied_by_alternative(jd["Google Cloud Platform"], {"Python"}) == []


def test_standalone_mention_keeps_skill_required():
    from app.services.skill_extractor import satisfied_by_alternative

    jd = extract_skills("AWS or GCP.\nDeep GCP expertise is essential.", detect_importance=True)
    assert satisfied_by_alternative(jd["Google Cloud Platform"], {"AWS"}) == []
