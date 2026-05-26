from fastapi import APIRouter
from app.core.config import settings
from app.db.mongodb import get_db_async, get_last_connection_error

router = APIRouter()

# Bump when deploying backend fixes — visible at /api/status/
API_BUILD = "2026-05-26-map-coords-v1"


@router.get("/", summary="Backend status check")
async def health_check():
    """
    Returns the current status of the backend.

    Response example:
    {
        "status": "online",
        "project": "Happiness Exchange"
    }
    """
    database = await get_db_async()
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "api_build": API_BUILD,
        "database": "connected" if database is not None else "disconnected",
        "database_error": None if database is not None else get_last_connection_error(),
    }
