from fastapi import APIRouter

from app.api.documents import router as documents_router
from app.api.interviews import router as interviews_router
from app.api.live import router as live_router
from app.api.questions import router as questions_router
from app.api.recommendations import router as recommendations_router
from app.core.config import settings
from app.models.health import HealthResponse


router = APIRouter()
router.include_router(documents_router)
router.include_router(interviews_router)
router.include_router(live_router)
router.include_router(questions_router)
router.include_router(recommendations_router)


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
    )
