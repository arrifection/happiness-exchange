"""Atomic request approval with admin-mediated conversation creation."""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from app.db.mongodb import get_mongo_client_async
from app.services.auth import parse_object_id
from app.services.conversations import ensure_admin_mediated_conversations

logger = logging.getLogger(__name__)


async def _approve_in_transaction(
    *,
    requests_collection,
    items_collection,
    conversations_collection,
    users_collection,
    request_object_id,
    request: dict,
    item: dict,
    item_object_id,
    current_user: dict,
    session,
) -> dict:
    """Run approval writes; caller owns the transaction boundary."""
    existing_approved = await requests_collection.find_one(
        {
            "item_id": request["item_id"],
            "status": "approved",
            "_id": {"$ne": request_object_id},
        },
        session=session,
    )
    if existing_approved is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Another request has already been approved for this item.",
        )

    owner_name = request.get("owner_name") or item.get("owner_name") or current_user.get("name", "")
    update_fields = {"status": "approved"}
    if not request.get("owner_name") and owner_name:
        update_fields["owner_name"] = owner_name

    updated_request = await requests_collection.find_one_and_update(
        {"_id": request_object_id, "status": "pending"},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    if updated_request is None:
        current = await requests_collection.find_one(
            {"_id": request_object_id},
            session=session,
        )
        if current is not None and current.get("status") != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request already processed",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be approved.",
        )

    await requests_collection.update_many(
        {
            "item_id": request["item_id"],
            "status": "pending",
            "_id": {"$ne": request_object_id},
        },
        {"$set": {"status": "rejected"}},
        session=session,
    )
    await items_collection.update_one(
        {"_id": item_object_id},
        {"$set": {"status": "reserved"}},
        session=session,
    )

    if conversations_collection is not None and users_collection is not None:
        request_id_str = str(request_object_id)
        merged_request = {**request, **updated_request}
        await ensure_admin_mediated_conversations(
            conversations_collection,
            users_collection,
            request_id_str=request_id_str,
            request=merged_request,
            item=item,
            session=session,
        )

    return updated_request


async def approve_request_and_create_conversations(
    *,
    requests_collection,
    items_collection,
    conversations_collection,
    users_collection,
    request_object_id,
    request: dict,
    item: dict,
    item_object_id,
    current_user: dict,
) -> dict:
    """
    Approve a pending request, reserve the item, reject competing requests,
    and create admin-mediated conversations — atomically when transactions are supported.
    """
    client = await get_mongo_client_async()
    if client is not None:
        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    return await _approve_in_transaction(
                        requests_collection=requests_collection,
                        items_collection=items_collection,
                        conversations_collection=conversations_collection,
                        users_collection=users_collection,
                        request_object_id=request_object_id,
                        request=request,
                        item=item,
                        item_object_id=item_object_id,
                        current_user=current_user,
                        session=session,
                    )
        except HTTPException:
            raise
        except Exception as exc:
            message = str(exc).lower()
            if "transaction" in message or "replica set" in message:
                logger.warning(
                    "MongoDB transactions unavailable; using conditional updates without session: %s",
                    exc,
                )
            else:
                raise

    return await _approve_in_transaction(
        requests_collection=requests_collection,
        items_collection=items_collection,
        conversations_collection=conversations_collection,
        users_collection=users_collection,
        request_object_id=request_object_id,
        request=request,
        item=item,
        item_object_id=item_object_id,
        current_user=current_user,
        session=None,
    )
