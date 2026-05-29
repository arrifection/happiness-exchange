#!/usr/bin/env python3
"""
Safe load-test helper for Happiness Exchange API.

Defaults to localhost. Use --base-url for staging only.
Refuses production happyexchange.net / hf.space unless --i-understand-production is passed.

Examples:
  python scripts/load_test.py --users 50 --duration 30
  python scripts/load_test.py --base-url http://127.0.0.1:8000 --users 50
  LOAD_TEST_TOKEN=eyJ... python scripts/load_test.py --users 20 --auth
"""

from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import sys
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

PRODUCTION_HOST_MARKERS = (
    "happyexchange.net",
    "happiness-exchange.vercel.app",
    "hf.space",
)


@dataclass
class EndpointResult:
    name: str
    ok: int = 0
    failed: int = 0
    latencies_ms: list[float] = field(default_factory=list)

    def record(self, elapsed_ms: float, success: bool) -> None:
        self.latencies_ms.append(elapsed_ms)
        if success:
            self.ok += 1
        else:
            self.failed += 1

    def summary(self) -> str:
        if not self.latencies_ms:
            return f"{self.name}: no samples"
        return (
            f"{self.name}: ok={self.ok} failed={self.failed} "
            f"p50={statistics.median(self.latencies_ms):.0f}ms "
            f"p95={sorted(self.latencies_ms)[max(0, int(len(self.latencies_ms) * 0.95) - 1)]:.0f}ms "
            f"max={max(self.latencies_ms):.0f}ms"
        )


def _is_production_url(base_url: str) -> bool:
    host = (urlparse(base_url).hostname or "").lower()
    return any(marker in host for marker in PRODUCTION_HOST_MARKERS)


async def _hit(client: httpx.AsyncClient, method: str, path: str, *, headers: dict | None = None) -> tuple[bool, float]:
    started = time.perf_counter()
    try:
        response = await client.request(method, path, headers=headers, timeout=20.0)
        elapsed = (time.perf_counter() - started) * 1000
        return response.status_code < 500, elapsed
    except httpx.HTTPError:
        elapsed = (time.perf_counter() - started) * 1000
        return False, elapsed


async def simulate_user(
    client: httpx.AsyncClient,
    user_idx: int,
    duration: int,
    token: str | None,
    results: dict[str, EndpointResult],
) -> None:
    headers = {"Authorization": f"Bearer {token}"} if token else None
    end_at = time.time() + duration

    while time.time() < end_at:
        for name, method, path, auth_required in (
            ("status", "GET", "/api/status/", False),
            ("items", "GET", "/api/items", False),
            ("community", "GET", "/api/community/impact", False),
        ):
            if auth_required and not token:
                continue
            ok, elapsed = await _hit(client, method, path, headers=headers if auth_required else None)
            results[name].record(elapsed, ok)

        if token:
            for name, method, path in (
                ("notifications", "GET", "/api/notifications"),
                ("conversations", "GET", "/api/conversations/my"),
            ):
                ok, elapsed = await _hit(client, method, path, headers=headers)
                results[name].record(elapsed, ok)

        # Mimic frontend polling duty cycle (~15s). Short sleep keeps local tests fast.
        await asyncio.sleep(max(1.0, 15.0 / 4))


async def run_load_test(base_url: str, users: int, duration: int, token: str | None) -> int:
    results = {
        "status": EndpointResult("GET /api/status/"),
        "items": EndpointResult("GET /api/items"),
        "community": EndpointResult("GET /api/community/impact"),
        "notifications": EndpointResult("GET /api/notifications"),
        "conversations": EndpointResult("GET /api/conversations/my"),
    }

    async with httpx.AsyncClient(base_url=base_url.rstrip("/")) as client:
        tasks = [
            simulate_user(client, idx, duration, token, results)
            for idx in range(users)
        ]
        await asyncio.gather(*tasks)

    print(f"\nLoad test complete — base={base_url} users={users} duration={duration}s auth={'yes' if token else 'no'}")
    for result in results.values():
        if result.ok or result.failed:
            print(result.summary())

    total_failed = sum(result.failed for result in results.values())
    return 1 if total_failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Safe Happiness Exchange API load test")
    parser.add_argument("--base-url", default=os.environ.get("LOAD_TEST_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--users", type=int, default=50)
    parser.add_argument("--duration", type=int, default=30, help="Seconds per virtual user")
    parser.add_argument("--auth", action="store_true", help="Include authenticated polling routes")
    parser.add_argument(
        "--i-understand-production",
        action="store_true",
        help="Required to run against production/staging hosts",
    )
    args = parser.parse_args()

    if args.users > 500:
        print("Refusing >500 virtual users in one process. Run multiple batches safely.", file=sys.stderr)
        return 2

    if _is_production_url(args.base_url) and not args.i_understand_production:
        print(
            "Refusing production host without --i-understand-production. "
            "Use localhost or an isolated staging backend.",
            file=sys.stderr,
        )
        return 2

    token = os.environ.get("LOAD_TEST_TOKEN") if args.auth else None
    if args.auth and not token:
        print("Set LOAD_TEST_TOKEN when using --auth", file=sys.stderr)
        return 2

    return asyncio.run(run_load_test(args.base_url, args.users, args.duration, token))


if __name__ == "__main__":
    raise SystemExit(main())
