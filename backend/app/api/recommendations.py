from fastapi import APIRouter

from app.models.recommendation import RecommendationRequest, RecommendationResponse
from app.services.recommendation import recommend_questions


router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.post("/questions", response_model=RecommendationResponse)
async def recommend_interview_questions(request: RecommendationRequest) -> RecommendationResponse:
    recommendations, signals, plan, discussion_questions = recommend_questions(
        resume_text=request.resume_text,
        job_description=request.job_description,
        preferred_difficulty=request.preferred_difficulty,
    )

    return RecommendationResponse(
        recommendations=recommendations,
        extracted_signals=signals,
        interview_plan=plan,
        discussion_questions=discussion_questions,
    )
