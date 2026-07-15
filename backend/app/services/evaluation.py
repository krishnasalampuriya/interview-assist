import json

from app.core.config import settings
from app.models.interview import InterviewEvaluation, InterviewSession
from app.services.gemini import generate_gemini_json


def evaluate_interview_session(session: InterviewSession, interviewer_notes: str = "") -> InterviewEvaluation:
    if not session.selected_question:
        raise ValueError("Cannot evaluate an interview before a question is selected.")

    if settings.gemini_api_key:
        try:
            return _evaluate_with_gemini(session, interviewer_notes)
        except Exception:
            return _fallback_evaluation(session, interviewer_notes, generated_by="fallback_after_gemini_error")

    return _fallback_evaluation(session, interviewer_notes, generated_by="fallback_no_api_key")


def _evaluate_with_gemini(session: InterviewSession, interviewer_notes: str) -> InterviewEvaluation:
    prompt = _build_evaluation_prompt(session, interviewer_notes)
    payload = generate_gemini_json(prompt)
    payload = _normalize_evaluation_payload(payload)
    payload["generated_by"] = f"gemini:{settings.gemini_model}"
    return InterviewEvaluation.model_validate(payload)


def _fallback_evaluation(
    session: InterviewSession,
    interviewer_notes: str,
    generated_by: str,
) -> InterviewEvaluation:
    code = session.candidate_code.strip()
    question = session.selected_question
    rubric = question.evaluation_rubric if question else []

    score = 35
    strengths: list[str] = []
    concerns: list[str] = []

    if code:
        score += 20
        strengths.append("Candidate produced a written solution during the session.")
    else:
        concerns.append("No candidate code was captured during the session.")

    if len(code.splitlines()) >= 5:
        score += 10
        strengths.append("Solution has enough structure to review implementation intent.")

    if any(term in code.lower() for term in ["for ", "while ", "return", "if "]):
        score += 10
        strengths.append("Code shows basic control flow and executable reasoning.")
    else:
        concerns.append("The captured solution does not show much algorithmic control flow.")

    if interviewer_notes.strip():
        score += 5
        strengths.append("Interviewer notes were included in the evaluation context.")

    if rubric:
        concerns.append(f"Review against rubric items: {', '.join(rubric[:3])}.")

    score = max(0, min(score, 100))

    return InterviewEvaluation(
        overall_score=score,
        recommendation=_recommendation_label(score),
        summary="Fallback evaluation generated without Gemini. Add GEMINI_API_KEY to enable a richer AI review.",
        correctness="Not executed in v1. Correctness is estimated from the captured code and question rubric.",
        code_quality=_quality_summary(code),
        problem_solving=_problem_solving_summary(code, interviewer_notes),
        strengths=strengths or ["Candidate participated in the coding exercise."],
        concerns=concerns or ["No major concerns detected by fallback evaluator."],
        follow_up_questions=[
            "Can you explain the time and space complexity of your solution?",
            "Which edge case would you test first and why?",
            "How would you simplify or refactor this solution after the interview?",
        ],
        generated_by=generated_by,
    )


def _build_evaluation_prompt(session: InterviewSession, interviewer_notes: str) -> str:
    question = session.selected_question

    return f"""
You are an expert coding interview evaluator. Evaluate the candidate based on the selected interview question, expected approach, rubric, captured code, language, timer state, and interviewer notes.

Return ONLY valid JSON with exactly these fields:
{{
  "overall_score": 0,
  "recommendation": "strong_yes | yes | maybe | no",
  "summary": "short overall summary",
  "correctness": "correctness assessment",
  "code_quality": "code quality assessment",
  "problem_solving": "problem-solving assessment",
  "strengths": ["..."],
  "concerns": ["..."],
  "follow_up_questions": ["..."]
}}

The overall_score must be an integer from 0 to 100, where 90+ is exceptional, 70-89 is hire/yes, 50-69 is mixed/maybe, and below 50 is no.

Question title: {question.title if question else ""}
Question difficulty: {question.difficulty if question else ""}
Question summary: {question.summary if question else ""}
Expected approach: {question.expected_approach if question else ""}
Evaluation rubric: {json.dumps(question.evaluation_rubric if question else [])}

Candidate language: {session.candidate_language}
Candidate code:
```text
{session.candidate_code}
```

Timer status: {session.timer_status}
Session status: {session.status}
Interviewer notes:
```text
{interviewer_notes}
```
""".strip()


def _normalize_evaluation_payload(payload: dict) -> dict:
    score = payload.get("overall_score")

    if isinstance(score, (int, float)) and 0 <= score <= 5:
        payload["overall_score"] = round(score * 20)
    elif isinstance(score, (int, float)) and 0 <= score <= 10:
        payload["overall_score"] = round(score * 10)

    normalized_score = payload.get("overall_score")
    if isinstance(normalized_score, int):
        payload["recommendation"] = _recommendation_label(normalized_score)

    return payload


def _recommendation_label(score: int) -> str:
    if score >= 85:
        return "strong_yes"
    if score >= 70:
        return "yes"
    if score >= 50:
        return "maybe"
    return "no"


def _quality_summary(code: str) -> str:
    if not code.strip():
        return "No code was captured, so code quality cannot be assessed."

    if len(code.splitlines()) < 5:
        return "Solution is short; interviewer should probe whether the approach is complete."

    return "Solution has enough structure for review; assess naming, decomposition, edge cases, and clarity."


def _problem_solving_summary(code: str, interviewer_notes: str) -> str:
    if interviewer_notes.strip():
        return "Problem-solving assessment includes interviewer notes plus captured code."

    if code.strip():
        return "Problem-solving assessment is based on code only; add notes for a stronger report."

    return "Insufficient captured work to assess problem solving."
