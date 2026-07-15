from fastapi import APIRouter, Query

from app.models.question import Question
from app.services.question_bank import list_questions


router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("", response_model=list[Question])
async def get_questions(difficulty: str | None = Query(default=None, pattern="^(easy|medium|hard)$")) -> list[Question]:
    return list_questions(difficulty=difficulty)
