import json
from functools import lru_cache
from pathlib import Path

from app.models.question import Question


QUESTION_BANK_PATH = Path(__file__).resolve().parents[2] / "data" / "questions.json"


@lru_cache
def load_questions() -> list[Question]:
    raw_questions = json.loads(QUESTION_BANK_PATH.read_text(encoding="utf-8"))
    return [Question.model_validate(question) for question in raw_questions]


def list_questions(difficulty: str | None = None) -> list[Question]:
    questions = load_questions()

    if difficulty is None:
        return questions

    normalized = difficulty.strip().lower()
    return [question for question in questions if question.difficulty == normalized]
