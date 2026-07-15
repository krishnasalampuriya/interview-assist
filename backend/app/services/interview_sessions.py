from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import settings
from app.models.interview import CreateInterviewRequest, InterviewEvaluation, InterviewSession
from app.models.question import Question
from app.services.evaluation import evaluate_interview_session
from app.services.recommendation import recommend_questions


_SESSIONS: dict[str, InterviewSession] = {}


def create_interview_session(request: CreateInterviewRequest) -> InterviewSession:
    recommendations, signals, plan, discussion_questions = recommend_questions(
        resume_text=request.resume_text,
        job_description=request.job_description,
        preferred_difficulty=request.preferred_difficulty,
    )
    session_id = uuid4().hex[:12]

    session = InterviewSession(
        id=session_id,
        resume_text=request.resume_text,
        job_description=request.job_description,
        preferred_difficulty=request.preferred_difficulty,
        interview_plan=plan,
        extracted_signals=signals,
        discussion_questions=discussion_questions,
        recommendations=recommendations,
    )
    _SESSIONS[session.id] = session
    return session


def get_interview_session(session_id: str) -> InterviewSession | None:
    return _SESSIONS.get(session_id)


def select_interview_question(
    session_id: str,
    question_id: str,
    timer_duration_minutes: int | None = None,
) -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    selected = _find_question(session, question_id)

    if selected is None:
        return None

    session.selected_question = selected
    session.candidate_link = f"{settings.frontend_base_url.rstrip('/')}/candidate/{session.id}"
    selected_duration_minutes = timer_duration_minutes or selected.time_limit_minutes
    session.timer_duration_seconds = selected_duration_minutes * 60
    session.timer_started_at = None
    session.timer_status = "not_started"
    session.status = "question_selected"
    session.updated_at = datetime.now(timezone.utc)
    _SESSIONS[session.id] = session
    return session


def update_candidate_profile(session_id: str, candidate_name: str) -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    session.candidate_name = candidate_name.strip()
    session.updated_at = datetime.now(timezone.utc)
    _SESSIONS[session.id] = session
    return session


def end_interview_session(session_id: str) -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    if session.timer_status == "running":
        session.timer_status = "stopped"

    session.status = "ended"
    session.updated_at = datetime.now(timezone.utc)
    _SESSIONS[session.id] = session
    return session


def start_interview_timer(session_id: str) -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    if session.selected_question is None:
        return session

    if session.timer_duration_seconds is None:
        session.timer_duration_seconds = session.selected_question.time_limit_minutes * 60

    if session.timer_started_at is None:
        session.timer_started_at = datetime.now(timezone.utc)
        session.timer_status = "running"
        session.status = "in_progress"
        session.updated_at = datetime.now(timezone.utc)
        _SESSIONS[session.id] = session

    return session


def get_timer_remaining_seconds(session: InterviewSession) -> int | None:
    if session.timer_duration_seconds is None:
        return None

    if session.timer_started_at is None:
        return session.timer_duration_seconds

    elapsed_seconds = int((datetime.now(timezone.utc) - session.timer_started_at).total_seconds())
    remaining = max(session.timer_duration_seconds - elapsed_seconds, 0)

    if remaining == 0 and session.timer_status != "expired":
        session.timer_status = "expired"
        session.status = "time_expired"
        session.updated_at = datetime.now(timezone.utc)
        _SESSIONS[session.id] = session

    return remaining


def update_candidate_workspace(
    session_id: str,
    code: str | None = None,
    language: str | None = None,
    candidate_name: str | None = None,
) -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    if code is not None:
        session.candidate_code = code

    if language is not None:
        session.candidate_language = language

    if candidate_name is not None:
        session.candidate_name = candidate_name

    if session.status == "question_selected":
        session.status = "in_progress"

    session.updated_at = datetime.now(timezone.utc)
    _SESSIONS[session.id] = session
    return session


def evaluate_session(session_id: str, interviewer_notes: str = "") -> InterviewSession | None:
    session = get_interview_session(session_id)

    if session is None:
        return None

    evaluation: InterviewEvaluation = evaluate_interview_session(session, interviewer_notes)
    session.interviewer_notes = interviewer_notes
    session.evaluation = evaluation
    session.status = "evaluated"
    session.updated_at = datetime.now(timezone.utc)
    _SESSIONS[session.id] = session
    return session


def _find_question(session: InterviewSession, question_id: str) -> Question | None:
    for recommendation in session.recommendations:
        if recommendation.question.id == question_id:
            return recommendation.question

    return None
