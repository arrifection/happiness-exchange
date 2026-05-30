# Performance & Scalability Notes

Last updated: 2026-05-30

## Improvements shipped

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
4. **No response caching** — reputation and browse responses are computed fresh each request.
5. **Client-side browse filters** — search/category filters apply to the current page only; server pagination covers location/status.

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
