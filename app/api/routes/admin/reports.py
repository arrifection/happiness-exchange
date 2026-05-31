"""
Admin reports management routes.

GET   /api/admin/reports         — list all reports
POST  /api/admin/reports         — create a report (flag)
PATCH /api/admin/reports/{id}/resolve  — resolve a report
PATCH /api/admin/reports/{id}/dismiss  — dismiss a report

Reports are stored in the `admin_reports` collection.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo import DESCENDING

from app.api.deps.admin import require_permission
from app.core.admin_permissions import PERMISSION_REPORTS
from app.db.mongodb import get_db_async
from app.services.audit import AuditAction, write_audit_log
from app.services.auth import parse_object_id
from app.services.notifications import notify_moderators, create_notification
from app.services.trust import admin_deduct_points

router = APIRouter()

REPORTS_COLLECTION = "admin_reports"


class ReportCreateRequest(BaseModel):
    type: str
    target_type: str       # "item" | "user" | "review" | "request"
    target_id: str
    description: str = ""


async def _get_reports_collection():
    db = await get_db_async()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db[REPORTS_COLLECTION]


@router.get("")
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str = Query("", alias="status"),
    admin: dict = Depends(require_permission(PERMISSION_REPORTS)),
):
    """List platform reports. Moderator+ required."""
    col = await _get_reports_collection()

    query: dict = {}
    if status_filter:
        query["status"] = status_filter

    total = await col.count_documents(query)
    cursor = col.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
    reports = await cursor.to_list(length=limit)

    def serialize(r):
        r["id"] = str(r.pop("_id"))
        return r

    return {"total": total, "skip": skip, "limit": limit, "reports": [serialize(r) for r in reports]}


@router.post("", status_code=201)
async def create_report(
    payload: ReportCreateRequest,
    admin: dict = Depends(require_permission(PERMISSION_REPORTS)),
):
    """Create a new flag/report. Moderator+ required."""
    col = await _get_reports_collection()
    now = datetime.now(timezone.utc)

    doc = {
        "type":          payload.type,
        "target_type":   payload.target_type,
        "target_id":     payload.target_id,
        "description":   payload.description,
        "status":        "open",
        "created_by":    admin["id"],
        "created_at":    now,
        "updated_at":    now,
    }
    result = await col.insert_one(doc)
    
    # Notify other moderators about the new report
    import asyncio
    asyncio.create_task(
        notify_moderators(
            title="New Report Filed",
            message=f"A new report was filed against {payload.target_type} {payload.target_id}.",
            type_=f"{payload.target_type}_reported",
            action_url=f"/reports"
        )
    )

    return {"id": str(result.inserted_id), "status": "open"}


@router.patch("/{report_id}/resolve", status_code=200)
async def resolve_report(
    report_id: str,
    admin: dict = Depends(require_permission(PERMISSION_REPORTS)),
):
    """Mark a report as resolved. Moderator+ required. Audit logged."""
    col = await _get_reports_collection()
    oid = parse_object_id(report_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid report ID.")

    report = await col.find_one({"_id": oid})
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    await col.update_one(
        {"_id": oid},
        {"$set": {
            "status":      "resolved",
            "resolved_by": admin["id"],
            "resolved_at": datetime.now(timezone.utc),
            "updated_at":  datetime.now(timezone.utc),
        }},
    )

    await write_audit_log(
        action=AuditAction.REPORT_RESOLVED,
        admin_user=admin,
        target_type="report",
        target_id=report_id,
        detail={"report_type": report.get("type"), "target_id": report.get("target_id")},
    )

    # Deduct points if the target is a user or we can resolve the item's owner
    target_type = report.get("target_type")
    target_id = report.get("target_id")
    penalty_user_id = None
    
    if target_type == "user":
        penalty_user_id = target_id
    elif target_type == "item":
        # fetch item to get owner
        db = await get_db_async()
        if db is not None:
            oid_target = parse_object_id(target_id)
            if oid_target:
                item_doc = await db["items"].find_one({"_id": oid_target})
                if item_doc:
                    penalty_user_id = item_doc.get("owner_id")

    if penalty_user_id:
        await admin_deduct_points(
            user_id=penalty_user_id,
            admin_id=admin["id"],
            amount=20,
            reason=f"Confirmed report {report_id}",
            reference_id=report_id
        )

    # Notify the user who created the report
    if "created_by" in report and report["created_by"] != admin["id"]:
        import asyncio
        asyncio.create_task(
            create_notification(
                user_id=report["created_by"],
                title="Report Resolved",
                message=f"Your report against {report.get('target_type')} was resolved.",
                type_="report_resolved",
                action_url="/reports"
            )
        )

    return {"message": "Report resolved.", "report_id": report_id}


@router.patch("/{report_id}/dismiss", status_code=200)
async def dismiss_report(
    report_id: str,
    admin: dict = Depends(require_permission(PERMISSION_REPORTS)),
):
    """Dismiss a report (no action taken). Moderator+ required. Audit logged."""
    col = await _get_reports_collection()
    oid = parse_object_id(report_id)
    if oid is None:
        raise HTTPException(status_code=400, detail="Invalid report ID.")

    report = await col.find_one({"_id": oid})
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    await col.update_one(
        {"_id": oid},
        {"$set": {
            "status":       "dismissed",
            "dismissed_by": admin["id"],
            "dismissed_at": datetime.now(timezone.utc),
            "updated_at":   datetime.now(timezone.utc),
        }},
    )

    await write_audit_log(
        action=AuditAction.REPORT_DISMISSED,
        admin_user=admin,
        target_type="report",
        target_id=report_id,
        detail={"report_type": report.get("type")},
    )

    return {"message": "Report dismissed.", "report_id": report_id}
