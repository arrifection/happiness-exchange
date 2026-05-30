"""Plan and apply completed_donation trust event backfill."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError

from app.services.trust import recalculate_user_trust_score

COMPLETED_DONATION_TYPE = "completed_donation"
COMPLETED_DONATION_POINTS = 10
COMPLETED_DONATION_DESCRIPTION = "Successfully completed a donation exchange."


@dataclass
class TrustBackfillReport:
    completed_exchanges_scanned: int = 0
    missing_trust_events: int = 0
    users_needing_backfill: int = 0
    users_already_correct: int = 0
    events_inserted: int = 0
    users_scores_updated: int = 0
    planned_events: list[dict] = field(default_factory=list)


async def trust_event_exists(trust_events, *, user_id: str, item_id: str) -> bool:
    existing = await trust_events.find_one(
        {
            "user_id": user_id,
            "event_type": COMPLETED_DONATION_TYPE,
            "reference_id": item_id,
        }
    )
    return existing is not None


async def plan_completed_donation_backfill(db) -> TrustBackfillReport:
    """Scan completed items and return missing trust events (dry-run plan)."""
    items = db["items"]
    trust_events = db["trust_events"]

    completed_items = await items.find({"status": "completed"}).to_list(length=None)
    report = TrustBackfillReport(completed_exchanges_scanned=len(completed_items))
    users_needing: set[str] = set()
    users_skipped: set[str] = set()

    for item in completed_items:
        owner_id = str(item.get("owner_id") or "")
        item_id = str(item["_id"])
        if not owner_id:
            continue

        if await trust_event_exists(trust_events, user_id=owner_id, item_id=item_id):
            users_skipped.add(owner_id)
            continue

        users_needing.add(owner_id)
        report.planned_events.append(
            {
                "user_id": owner_id,
                "event_type": COMPLETED_DONATION_TYPE,
                "points_change": COMPLETED_DONATION_POINTS,
                "reference_id": item_id,
                "description": COMPLETED_DONATION_DESCRIPTION,
                "created_at": item.get("updated_at") or item.get("created_at") or datetime.now(timezone.utc),
                "_item_title": item.get("title", ""),
            }
        )

    report.missing_trust_events = len(report.planned_events)
    report.users_needing_backfill = len(users_needing)
    report.users_already_correct = len(users_skipped)
    return report


async def apply_completed_donation_backfill(db, report: TrustBackfillReport) -> TrustBackfillReport:
    """Insert planned trust events and recalculate affected user scores (idempotent)."""
    trust_events = db["trust_events"]
    users = db["users"]
    affected_users: set[str] = set()
    users_skipped = report.users_already_correct

    for event in report.planned_events:
        doc = {key: value for key, value in event.items() if not key.startswith("_")}
        try:
            await trust_events.insert_one(doc)
            report.events_inserted += 1
            affected_users.add(event["user_id"])
        except DuplicateKeyError:
            users_skipped += 1
            continue

    for user_id in affected_users:
        await recalculate_user_trust_score(
            user_id,
            users_collection=users,
            trust_events_collection=trust_events,
        )
        report.users_scores_updated += 1

    report.users_already_correct = users_skipped
    return report
