"""Pydantic response models (also drive the OpenAPI docs at /docs)."""

from pydantic import BaseModel, Field


class SkillItem(BaseModel):
    name: str
    category: str
    implied: bool | None = Field(
        None, description="True if inferred from a related skill (e.g. PostgreSQL -> SQL)."
    )
    implied_by: list[str] | None = None
    importance: str | None = Field(
        None, description="Importance in the job description: required, mentioned or preferred."
    )


class MissingSkill(BaseModel):
    name: str
    category: str
    importance: str
    job_mentions: int
    priority: str = Field(description="high, medium or low")


class AlternativeSkill(BaseModel):
    name: str
    category: str
    satisfied_by: list[str] = Field(
        description="Resume skills listed as alternatives to this one in the job description"
    )


class Keyword(BaseModel):
    term: str
    weight: float = Field(description="TF-IDF weight of the term in the job description")
    in_resume: bool
    is_skill: bool


class Recommendation(BaseModel):
    id: int
    priority: str
    category: str
    title: str
    detail: str
    skills: list[str]


class CategoryBreakdown(BaseModel):
    category: str
    required: int
    matched: int


class AnalysisResponse(BaseModel):
    overall_match_score: float = Field(ge=0, le=100)
    match_level: str
    tfidf_similarity: float = Field(ge=0, le=100, description="Cosine similarity x 100")
    skill_coverage: float | None = Field(
        None, ge=0, le=100, description="Null when no skills were detected in the job description"
    )
    matched_skills: list[SkillItem]
    missing_skills: list[MissingSkill]
    additional_skills: list[SkillItem]
    alternative_skills: list[AlternativeSkill]
    job_skill_count: int
    resume_skill_count: int
    category_breakdown: list[CategoryBreakdown]
    extracted_resume_text_length: int
    resume_word_count: int
    job_description_word_count: int
    job_description_keywords: list[Keyword]
    recommendations: list[Recommendation]
    scoring_method: dict
    warnings: list[str]
    input_source: dict


class HealthResponse(BaseModel):
    status: str
    version: str
    skills_in_taxonomy: int


class ErrorResponse(BaseModel):
    detail: str
