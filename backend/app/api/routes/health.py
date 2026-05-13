from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


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
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
    }
