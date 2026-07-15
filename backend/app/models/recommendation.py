from pydantic import BaseModel, Field

from app.models.question import Question


class InterviewPlan(BaseModel):
    candidate_level: str | None = None
    target_difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard)$")
    role_type: str | None = None
    primary_skills: list[str] = Field(default_factory=list)
    secondary_skills: list[str] = Field(default_factory=list)
    avoid_topics: list[str] = Field(default_factory=list)
    coding_question_focus: list[str] = Field(default_factory=list)
    discussion_question_focus: list[str] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    resume_text: str = Field(min_length=20)
    job_description: str = Field(min_length=20)
    preferred_difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard)$")


class DiscussionQuestion(BaseModel):
    question: str
    reason: str
    signal: str


class RecommendedQuestion(BaseModel):
    question: Question
    match_score: float = Field(ge=0)
    fit_reasons: list[str]


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendedQuestion]
    extracted_signals: list[str]
    interview_plan: InterviewPlan
    discussion_questions: list[DiscussionQuestion]
