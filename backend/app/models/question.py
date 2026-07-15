from pydantic import BaseModel, Field


class QuestionSource(BaseModel):
    platform: str
    problem_id: str
    title_slug: str
    url: str
    fetched_at: str
    acceptance_rate: float = Field(ge=0, le=1)
    paid_only: bool


class Question(BaseModel):
    id: str
    source: QuestionSource
    title: str
    difficulty: str
    target_levels: list[str]
    role_tags: list[str]
    skills: list[str]
    time_limit_minutes: int = Field(gt=0)
    summary: str
    sample_test_cases: list[dict[str, str]]
    expected_approach: str
    evaluation_rubric: list[str]
