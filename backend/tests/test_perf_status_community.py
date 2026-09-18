"""Regression tests for status side-effect removal and community TTL cache."""

from __future__ import annotations

import inspect
import time
from unittest.mock import AsyncMock, patch

import pytest

from app.api.routes import community as community_mod
from app.api.routes import health as health_mod


def test_health_module_does_not_schedule_offer_expiration():
    source = inspect.getsource(health_mod)
    assert "run_exchange_offer_expiration" not in source
    assert "create_task" not in source


@pytest.mark.asyncio
async def test_health_check_returns_status_without_expiration_side_effects():
    with (
        patch.object(health_mod, "get_db_async", new=AsyncMock(return_value=object())),
        patch.object(
            health_mod,
            "get_build_metadata",
            return_value={
                "git_commit": "abc",
                "git_commit_short": "abc",
                "built_at": "now",
                "environment": "test",
            },
        ),
        patch("asyncio.create_task") as create_task,
    ):
        payload = await health_mod.health_check()

    assert payload["status"] == "online"
    assert payload["database"] == "connected"
    create_task.assert_not_called()


@pytest.mark.asyncio
async def test_community_impact_uses_ttl_cache():
    # Reset module cache between tests.
    community_mod._cache_value = None
    community_mod._cache_at = None

    items_col = AsyncMock()
    needs_col = AsyncMock()
    items_col.count_documents = AsyncMock(return_value=3)
    needs_col.count_documents = AsyncMock(return_value=2)
    items_col.distinct = AsyncMock(return_value=["u1", "u2"])

    with (
        patch.object(community_mod, "get_items_collection_async", new=AsyncMock(return_value=items_col)),
        patch.object(community_mod, "get_need_requests_collection_async", new=AsyncMock(return_value=needs_col)),
    ):
        first = await community_mod.community_impact()
        second = await community_mod.community_impact()

    assert first == second
    assert first["items_shared"] == 3
    assert first["needs_fulfilled"] == 2
    assert first["active_givers"] == 2
    assert first["community_exchanges"] == 3
    assert items_col.count_documents.await_count == 1
    assert needs_col.count_documents.await_count == 1
    assert items_col.distinct.await_count == 1


@pytest.mark.asyncio
async def test_community_impact_cache_expires_after_ttl():
    community_mod._cache_value = {"items_shared": 1, "needs_fulfilled": 1, "active_givers": 1, "community_exchanges": 1}
    community_mod._cache_at = time.time() - (community_mod._CACHE_TTL_SECONDS + 1)

    items_col = AsyncMock()
    needs_col = AsyncMock()
    items_col.count_documents = AsyncMock(return_value=9)
    needs_col.count_documents = AsyncMock(return_value=4)
    items_col.distinct = AsyncMock(return_value=["a", "b", "c"])

    with (
        patch.object(community_mod, "get_items_collection_async", new=AsyncMock(return_value=items_col)),
        patch.object(community_mod, "get_need_requests_collection_async", new=AsyncMock(return_value=needs_col)),
    ):
        refreshed = await community_mod.community_impact()

    assert refreshed["items_shared"] == 9
    assert items_col.count_documents.await_count == 1


def test_lifespan_schedules_expiration_outside_request_path():
    source = inspect.getsource(__import__("api.index", fromlist=["lifespan"]).lifespan)
    assert "run_exchange_offer_expiration_safely" in source
    assert "_offer_expiration_loop" in source
