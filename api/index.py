import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.slowapi_limiter import limiter

from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.health import router as health_router
from app.api.routes.items import router as items_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.reviews import router as reviews_router
from app.api.routes.requests import router as requests_router
from app.api.routes.users import router as users_router
from app.api.routes.leaderboard import router as leaderboard_router
from app.api.routes.community import router as community_router
from app.api.routes.deliveries import router as deliveries_router
from app.api.routes.need_requests import router as need_requests_router
# ── Admin routes ──────────────────────────────────────────────────────────────
from app.api.routes.admin.auth      import router as admin_auth_router
from app.api.routes.admin.users     import router as admin_users_router
from app.api.routes.admin.items     import router as admin_items_router
from app.api.routes.admin.reviews   import router as admin_reviews_router
from app.api.routes.admin.reports   import router as admin_reports_router
from app.api.routes.admin.requests  import router as admin_requests_router
from app.api.routes.admin.analytics import router as admin_analytics_router
from app.api.routes.admin.team      import router as admin_team_router
from app.api.routes.admin.deliveries import router as admin_deliveries_router
from app.api.routes.admin.conversations import router as admin_conversations_router
from app.core.config import settings
from app.core.middleware import RequestLoggingMiddleware
from app.core.startup_checks import log_production_warnings
from app.db.mongodb import (
    close_mongo_connection,
    connect_to_mongo,
    get_last_connection_error,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    settings.log_startup_info()
    log_production_warnings()
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Happiness Exchange - a free item donation and exchange platform.",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS + [
        # Admin panel (local dev)
        "http://localhost:5200",
        "http://127.0.0.1:5200",
    ],
    allow_origin_regex=r"https://(happiness-exchange.*|arrifection-happiness-exchange.*|.*-admin.*)\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(health_router, prefix="/api/status", tags=["Status"])
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(users_router, prefix="/api", tags=["Users"])
app.include_router(items_router, prefix="/api", tags=["Items"])
app.include_router(requests_router, prefix="/api", tags=["Requests"])
app.include_router(reviews_router, prefix="/api", tags=["Reviews"])
app.include_router(conversations_router, prefix="/api", tags=["Conversations"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(leaderboard_router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(community_router, prefix="/api/community", tags=["Community"])
app.include_router(deliveries_router, prefix="/api", tags=["Deliveries"])
app.include_router(need_requests_router, prefix="/api", tags=["Need Requests"])

# ── Admin API ─────────────────────────────────────────────────────────────────
app.include_router(admin_auth_router,      prefix="/api/admin/auth",      tags=["Admin · Auth"])
app.include_router(admin_users_router,     prefix="/api/admin/users",     tags=["Admin · Users"])
app.include_router(admin_items_router,     prefix="/api/admin/items",     tags=["Admin · Items"])
app.include_router(admin_reviews_router,   prefix="/api/admin/reviews",   tags=["Admin · Reviews"])
app.include_router(admin_reports_router,   prefix="/api/admin/reports",   tags=["Admin · Reports"])
app.include_router(admin_requests_router,  prefix="/api/admin/requests",  tags=["Admin · Requests"])
app.include_router(admin_analytics_router, prefix="/api/admin/analytics", tags=["Admin · Analytics"])
app.include_router(admin_team_router,      prefix="/api/admin/team",      tags=["Admin · Team"])
app.include_router(admin_deliveries_router, prefix="/api/admin",          tags=["Admin · Deliveries"])
app.include_router(admin_conversations_router, prefix="/api/admin/conversations", tags=["Admin · Conversations"])

# ── Diagnostic endpoint ───────────────────────────────────────────────────────
# SAFE: never returns MONGODB_URI, password, or any secret value.
# Remove or restrict this before public launch.
debug_router = APIRouter()


@debug_router.get("/api/debug/db", tags=["Debug"])
async def debug_db():
    """
    Safe database diagnostic endpoint.
    Returns connection status without exposing any secrets.
    """
    uri_raw = os.environ.get("MONGODB_URI", "")
    uri_present = bool(uri_raw)

    # Check if it is still the localhost default
    uri_is_local = uri_raw.startswith("mongodb://localhost") or uri_raw.startswith("mongodb://127.0.0.1")

    mongo_ping = "not_attempted"
    error_type = None
    message = None

    try:
        from app.db.mongodb import get_db_async
        database = await get_db_async()
        if database is not None:
            await database.client.admin.command("ping")
            mongo_ping = "ok"
        else:
            mongo_ping = "failed"
            last_error = get_last_connection_error()
            if last_error:
                # Strip URI/passwords from error string before returning
                safe_error = last_error.split("@")[-1] if "@" in last_error else last_error
                error_type = type(last_error).__name__
                message = safe_error[:200]  # truncate
    except Exception as exc:
        mongo_ping = "failed"
        error_type = type(exc).__name__
        raw = str(exc)
        message = (raw.split("@")[-1] if "@" in raw else raw)[:200]

    return {
        "env_mongodb_uri_present": uri_present,
        "env_mongodb_uri_is_local_default": uri_is_local,
        "db_name": settings.DB_NAME,
        "mongo_ping": mongo_ping,
        "error_type": error_type,
        "message": message,
    }


app.include_router(debug_router)

uploads_items_dir = Path(__file__).resolve().parents[1] / "uploads" / "items"
uploads_items_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/uploads/items",
    StaticFiles(directory=str(uploads_items_dir)),
    name="local-item-uploads",
)
