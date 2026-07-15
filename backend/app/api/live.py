from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.interview_sessions import (
    get_interview_session,
    get_timer_remaining_seconds,
    start_interview_timer,
    update_candidate_workspace,
)
from app.services.live_rooms import live_room_manager


router = APIRouter(tags=["live"])


@router.websocket("/ws/interviews/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str) -> None:
    session = get_interview_session(session_id)

    if session is None:
        await websocket.close(code=4404)
        return

    await live_room_manager.connect(session_id, websocket)

    if websocket.query_params.get("role") == "candidate":
        session = start_interview_timer(session_id) or session
        await live_room_manager.broadcast(session_id, _session_message("timer_started", session))

    await websocket.send_json(_session_message("session_snapshot", session))

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "code_update":
                updated_session = update_candidate_workspace(
                    session_id=session_id,
                    code=message.get("code"),
                    language=message.get("language"),
                    candidate_name=message.get("candidate_name"),
                )

                if updated_session is not None:
                    await live_room_manager.broadcast(
                        session_id,
                        _session_message("code_update", updated_session),
                    )
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        live_room_manager.disconnect(session_id, websocket)


def _session_message(message_type: str, session) -> dict:
    return {
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
    }
