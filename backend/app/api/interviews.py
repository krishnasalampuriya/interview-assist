from fastapi import APIRouter, HTTPException

from app.models.interview import (
    CandidateProfileRequest,
    CreateInterviewRequest,
    EvaluationRequest,
    InterviewSessionResponse,
    SelectQuestionRequest,
)
from app.services.interview_sessions import (
    create_interview_session,
    end_interview_session,
    evaluate_session,
    get_interview_session,
    get_timer_remaining_seconds,
    select_interview_question,
    update_candidate_profile,
)
from app.services.live_rooms import live_room_manager


router = APIRouter(prefix="/api/interviews", tags=["interviews"])


@router.post("", response_model=InterviewSessionResponse)
async def create_interview(request: CreateInterviewRequest) -> InterviewSessionResponse:
    return InterviewSessionResponse(session=create_interview_session(request))


@router.get("/{session_id}", response_model=InterviewSessionResponse)
async def get_interview(session_id: str) -> InterviewSessionResponse:
    session = get_interview_session(session_id)

    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    return InterviewSessionResponse(session=session)


@router.post("/{session_id}/select-question", response_model=InterviewSessionResponse)
async def select_question(session_id: str, request: SelectQuestionRequest) -> InterviewSessionResponse:
    session = select_interview_question(
        session_id=session_id,
        question_id=request.question_id,
        timer_duration_minutes=request.timer_duration_minutes,
    )

    if session is None:
        raise HTTPException(status_code=404, detail="Interview session or question not found.")

    return InterviewSessionResponse(session=session)


@router.post("/{session_id}/candidate", response_model=InterviewSessionResponse)
async def save_candidate_profile(
    session_id: str,
    request: CandidateProfileRequest,
) -> InterviewSessionResponse:
    session = update_candidate_profile(session_id, request.candidate_name)

    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    await _broadcast_session_state("candidate_profile_updated", session)
    return InterviewSessionResponse(session=session)


@router.post("/{session_id}/end", response_model=InterviewSessionResponse)
async def end_interview(session_id: str) -> InterviewSessionResponse:
    session = end_interview_session(session_id)

    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    await _broadcast_session_state("session_ended", session)
    return InterviewSessionResponse(session=session)


@router.post("/{session_id}/evaluate", response_model=InterviewSessionResponse)
async def evaluate_interview(session_id: str, request: EvaluationRequest) -> InterviewSessionResponse:
    session = evaluate_session(session_id, request.interviewer_notes)

    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    return InterviewSessionResponse(session=session)


async def _broadcast_session_state(message_type: str, session) -> None:
    await live_room_manager.broadcast(
        session.id,
        {
            "type": message_type,
            "session_id": session.id,
            "candidate_code": session.candidate_code,
            "candidate_language": session.candidate_language,
            "candidate_name": session.candidate_name,
            "timer_duration_seconds": session.timer_duration_seconds,
            "timer_started_at": session.timer_started_at.isoformat() if session.timer_started_at else None,
            "timer_remaining_seconds": get_timer_remaining_seconds(session),
            "timer_status": session.timer_status,
            "status": session.status,
            "updated_at": session.updated_at.isoformat(),
        },
    )
