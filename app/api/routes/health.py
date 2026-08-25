from fastapi import APIRouter
import asyncio
import logging

from app.core.build_info import get_build_metadata
from app.core.config import settings
from app.db.mongodb import get_db_async, get_last_connection_error
from app.services.exchange_offer_expiration import run_exchange_offer_expiration_safely

router = APIRouter()
logger = logging.getLogger(__name__)

# Human-readable deploy label — bump on meaningful backend releases
API_BUILD = "2026-08-25-exchange-live-v1"


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
    build = get_build_metadata()
    try:
        asyncio.create_task(run_exchange_offer_expiration_safely())
    except Exception:
        logger.exception("Could not schedule exchange offer expiration.")
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "api_build": API_BUILD,
        "git_commit": build["git_commit"],
        "git_commit_short": build["git_commit_short"],
        "built_at": build["built_at"],
        "environment": build["environment"],
        "database": "connected" if database is not None else "disconnected",
        "database_error": None if database is not None else get_last_connection_error(),
    }
