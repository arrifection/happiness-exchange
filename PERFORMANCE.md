# Performance & Scalability Notes

Last updated: 2026-09-18

## Improvements shipped

### Status endpoint is side-effect free (2026-09-18)

`GET /api/status/` no longer schedules exchange-offer expiration. Expiration runs from the FastAPI lifespan loop in production (~every 10 minutes). Keep-alive health checks stay O(1) reads.

### Notification badge polling (2026-09-18)

Logged-in clients poll `GET /api/notifications/unread-count` every 30s (visible tabs only). Full `GET /api/notifications` loads only when the bell dropdown opens.

### Community impact TTL cache (2026-09-18)

`GET /api/community/impact` uses a 60s in-process cache with a lock + double-check. No Redis.

### Geo browse candidate cap (already documented below)

Hard cap of 1000 candidates after Mongo bounding-box prefilter; index `status_latitude_longitude` supports the geo path.

### Mongo pool sizing

`AsyncIOMotorClient(..., maxPoolSize=50)` — sized for a single uvicorn worker.

### Reputation query batching (`GET /api/items`)

**Before:** `build_reputation_lookup` called `calculate_reputation_summary` per unique owner (6+ Mongo queries each, plus per-approved-request item lookups).

**After:** `build_public_reputation_lookup` uses 2 batched queries (users by `_id` + reviews aggregation).

| Scenario | `GET /api/items` p95 (local uvicorn) | Failures |
|----------|--------------------------------------|----------|
| 50 concurrent users (before) | ~12,592 ms | ~55% |
| 50 concurrent users (after) | ~1,219 ms | 0% |
| 100 concurrent users (before) | ~12,976 ms | ~59% |
| 100 concurrent users (after) | ~4,232 ms | 0% |
| Sequential x20 (after) | ~29 ms p50 / ~48 ms p95 | 0% |

### Batched request counts (`GET /api/items/my`)

Replaced per-item `count_documents` with a single aggregation grouped by `item_id`.

### Browse pagination (`GET /api/items`)

- Query params: `page` (default 1), `limit` (default 20, max 100)
- Response shape: `{ items, page, limit, total, total_pages }`
- Frontend Browse page uses Previous / Next controls

## MongoDB indexes reviewed

| Collection | Index | Purpose |
|------------|-------|---------|
| items | `(status, created_at)` | Browse sort/filter |
| items | `(country, city, status)` | Location browse |
| items | `(owner_id, status)` | Owner listings |
| requests | `(owner_id, status, created_at)` | Incoming requests |
| requests | `(requester_id, status, created_at)` | My requests |
| requests | `(item_id, status)` | Item request lookup |
| conversations | `(request_id, chat_type)` unique | Prevent duplicate admin chats |
| conversations | `(chat_type, last_message_at)` | Admin inbox |
| conversations | `(member_id, chat_type, last_message_at)` | User inbox |
| messages | `(conversation_id, created_at)` | Thread load |

## Startup note: trust events partial index (non-fatal)

On MongoDB Atlas **M0**, index creation for `trust_events` may log:

`Expression not supported in partial index: $not reference_id $eq null`

This happens because the unique partial index uses `{ reference_id: { $exists: true, $ne: null } }`, which some Atlas tiers reject. **The app still starts and runs** — duplicate trust events are prevented in application code via `DuplicateKeyError` handling when the index exists, and via idempotent `record_trust_event` logic otherwise.

**Deployment impact:** Safe to deploy. No runtime errors from this warning. To silence it on M0, upgrade Atlas tier or change the partial filter to `{ reference_id: { $type: "string" } }` in a future migration.

## Remaining limitations

1. **Single-worker uvicorn** — concurrent requests queue on one process; HF Spaces free tier saturates under ~50–100 warm users.
2. **Atlas latency** — M0 shared cluster adds round-trip time on every query batch.
3. **Geo browse** — radius filtering still scans up to 1000 candidates in memory before paginating (acceptable for MVP scale).
4. **Browse/reputation still uncached** — community impact is TTL-cached; browse page-1 and reputation lookups are still computed fresh each request.
5. **Client-side browse filters** — search/category filters apply to the current page only; server pagination covers location/status.

## Worker / HF deployment configuration

**Current (do not change blindly):** single uvicorn worker in `Dockerfile`:

```
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
```

**Why not `--workers N` yet:**

| Concern | Detail |
|---|---|
| Rate limits | `app/core/rate_limit.py` and SlowAPI use **process-local** memory — limits would not be shared |
| Community cache | In-process TTL cache would fragment across workers |
| Expiration loop | Lifespan starts one offer-expiration task **per process** → duplicate sweeps |
| Mongo connections | Each worker opens its own pool (`maxPoolSize=50`) → N×50 against Atlas M0 |

**Recommended before multi-worker:** shared rate-limit storage (e.g. Redis), single job leader / external cron for expiration, then start with `--workers 2` on a paid always-on host and monitor Atlas connections.

Exact HF CPU/RAM SKU remains **UNKNOWN** from public Space metadata.

## Future caching opportunities

- Cache `build_public_reputation_lookup` results per owner_id (TTL 5–15 min)
- Denormalize trust level + review stats onto user documents at write time
- Redis/in-memory cache for `GET /api/items` page 1 by country/city
- CDN cache for static marketing pages

## Load testing

See `scripts/SEED_LOAD_TEST.md` for seed + load-test workflow. Run against **local MongoDB only** unless explicitly overriding safety guards.

```powershell
python scripts/seed_test_data.py --execute
uvicorn api.index:app --host 127.0.0.1 --port 8000
python scripts/load_test.py --users 50 --duration 20
```
