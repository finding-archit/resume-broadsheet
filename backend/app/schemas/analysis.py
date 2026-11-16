"""Pydantic response models (also drive the OpenAPI docs at /docs)."""

from typing import Literal

from pydantic import BaseModel, Field

Evidence = Literal["demonstrated", "listed", "inferred"]


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
    evidence: Evidence | None = Field(
        None,
        description=(
            "Resume evidence: 'demonstrated' (used in a descriptive sentence or bullet), "
            "'listed' (only in a skills list) or 'inferred' (implied by a related skill)."
        ),
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
    term: str = Field(description="Readable form: skill name or the most frequent JD word")
    weight: float = Field(description="TF-IDF weight of the term in the job description")
    in_resume: bool
    is_skill: bool


class SimilarityTerm(BaseModel):
    term: str
    contribution: float = Field(
        ge=0, le=1, description="Share of the cosine similarity: r_i x j_i / cosine"
    )
    resume_weight: float = Field(description="TF-IDF weight r_i in the resume vector")
    job_weight: float = Field(description="TF-IDF weight j_i in the job-description vector")
    is_skill: bool


class EvidenceSummary(BaseModel):
    descriptive_segments: int = Field(
        description="Resume sentences/bullets that describe work (not skill lists)"
    )
    demonstrated: int = Field(description="Matched skills used in a descriptive segment")
    listed: int = Field(description="Matched skills that only appear in lists")
    inferred: int = Field(description="Matched skills only implied by related skills")


class CopiedTextRemoved(BaseModel):
    lines: int = Field(description="Resume lines dropped as copies of the job description")
    characters: int


class ScoreCap(BaseModel):
    applied: bool
    max_score: float
    uncapped_score: float
    reason: str


class Span(BaseModel):
    start: int = Field(description="Start offset into the document text")
    end: int = Field(description="End offset (exclusive)")
    skill: str
    category: str
    status: Literal["matched", "additional", "missing", "alternative", "negated"] = Field(
        description=(
            "Resume: matched | additional | negated. "
            "Job description: matched | missing | alternative | negated."
        )
    )


class DocumentView(BaseModel):
    text: str = Field(description="Cleaned text the analysis ran on (contact details removed)")
    spans: list[Span]


class Documents(BaseModel):
    resume: DocumentView
    job: DocumentView


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
    similarity_terms: list[SimilarityTerm] = Field(
        description="Top shared terms by contribution to the cosine similarity"
    )
    evidence_summary: EvidenceSummary
    copied_text_removed: CopiedTextRemoved
    score_cap: ScoreCap | None = Field(
        None, description="Set when the keyword-list cap lowered the overall score"
    )
    documents: Documents
    recommendations: list[Recommendation]
    scoring_method: dict
    warnings: list[str]
    input_source: dict


class HealthResponse(BaseModel):
    status: str
    version: str
    skills_in_taxonomy: int


class Band(BaseModel):
    min: int
    label: str


class Weights(BaseModel):
    tfidf: float
    skill_coverage: float


class CategoryCount(BaseModel):
    name: str
    count: int


class ConfigResponse(BaseModel):
    version: str
    weights: Weights = Field(description="Normalised scoring weights")
    bands: list[Band] = Field(description="Match-level bands, highest first")
    max_file_size_mb: int
    min_resume_chars: int
    min_resume_words: int
    min_job_description_chars: int
    min_job_description_words: int
    skills_in_taxonomy: int
    categories: list[CategoryCount]
    keyword_list_cap: float


class ErrorResponse(BaseModel):
    detail: str
