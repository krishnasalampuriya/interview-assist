from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.models.question import Question
from app.models.recommendation import DiscussionQuestion, InterviewPlan, RecommendedQuestion


class CreateInterviewRequest(BaseModel):
    resume_text: str = Field(min_length=20)
    job_description: str = Field(min_length=20)
    preferred_difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard)$")


class SelectQuestionRequest(BaseModel):
    question_id: str
    timer_duration_minutes: int | None = Field(default=None, ge=5, le=180)


class CandidateProfileRequest(BaseModel):
    candidate_name: str = Field(min_length=1, max_length=120)


class EvaluationRequest(BaseModel):
    interviewer_notes: str = ""


class InterviewEvaluation(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    recommendation: str
    summary: str
    correctness: str
    code_quality: str
    problem_solving: str
    strengths: list[str]
    concerns: list[str]
    follow_up_questions: list[str]
    generated_by: str


class InterviewSession(BaseModel):
    id: str
    resume_text: str
    job_description: str
    preferred_difficulty: str | None = None
    interview_plan: InterviewPlan
    extracted_signals: list[str]
    discussion_questions: list[DiscussionQuestion]
    recommendations: list[RecommendedQuestion]
    selected_question: Question | None = None
    candidate_link: str | None = None
    candidate_name: str | None = None
    candidate_language: str = "Python"
    candidate_code: str = ""
    interviewer_notes: str = ""
    evaluation: InterviewEvaluation | None = None
    timer_duration_seconds: int | None = None
    timer_started_at: datetime | None = None
    timer_status: str = "not_started"
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InterviewSessionResponse(BaseModel):
    session: InterviewSession
