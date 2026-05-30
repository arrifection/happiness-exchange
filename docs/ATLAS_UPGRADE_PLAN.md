# MongoDB Atlas M10 Upgrade Readiness Plan

Happiness Exchange currently runs on **MongoDB Atlas M0 (free shared tier)** in production. This document defines when to upgrade, how to do it, and how to roll back.

---

## Current tier

| Item | Detail |
|---|---|
| **Tier** | Atlas M0 (free) |
| **Deployment** | Hugging Face Spaces backend → `mongodb+srv://` Atlas cluster |
| **Database name** | `happiness_exchange` (production) |
| **Test database** | `happiness_exchange_test` (integration tests only) |

---

## Current limitations (M0)

- **~500 concurrent connections** cluster-wide (shared with other M0 workloads on the same cluster).
- **Limited IOPS and CPU** — browse queries with reputation lookups and chat polling can spike opcounters.
- **No multi-document transactions on standalone** — some Atlas M0 clusters are replica sets (transactions work); if not, approval uses conditional updates + repair (see `request_approval.py`).
- **Index constraints** — one partial unique index on `trust_events` may fail to sync on M0 (`$ne: null` in partial filter); app handles duplicates in code. Logged at startup, non-fatal.
- **No dedicated RAM** — cold cache after idle periods; latency spikes under load.

These limits are acceptable for **soft launch (~50 concurrent users)** with monitoring. They become painful before **200–500 MAU** or during marketing pushes.

---

## Upgrade trigger thresholds

Upgrade when **any** of the following occur:

| Trigger | Signal |
|---|---|
| **User growth** | **200–500 MAU** sustained for 2+ weeks |
| **Connection pressure** | Atlas alerts or app logs: `TooManyConnections`, connection pool timeouts |
| **Performance** | p95 API latency > 2s on browse/messages during normal traffic; sustained slow query log entries |
| **Operational pain** | Frequent M0 op limit throttling; HF Space warm but API still slow on DB-bound routes |
| **Feature need** | Require guaranteed transactions, higher connection headroom, or backup/restore SLAs |

**Suggested first upgrade:** **M10** (~$57/mo) — dedicated cluster, replica set, transactions, better IOPS.

Intermediate option: **M2/M5** for a smaller promo wave if budget is tight.

---

## Upgrade procedure (M0 → M10)

1. **Schedule a maintenance window** (see downtime below) — off-peak for Pakistan/Saudi Arabia users (e.g. 03:00–05:00 PKT).
2. **Atlas console** → Cluster → **Edit configuration** → select **M10** (same region as today, e.g. `AWS Mumbai` or nearest to users).
3. **Apply change** — Atlas performs a rolling upgrade on replica set members (typically **15–30 minutes** for tier change).
4. **Verify connection string** — `MONGODB_URI` on Hugging Face Space secrets usually **unchanged** (same cluster hostname).
5. **Post-upgrade checks:**
   - `GET https://arrifection-happiness-exchange.hf.space/api/status/` → `"database": "connected"`
   - Run integration test: `pytest -m integration`
   - Smoke test: signup, browse, request, approve, messages
6. **Re-run index sync** — restart HF Space once; confirm startup logs no longer show trust_events index warning (optional: fix partial filter to `{ reference_id: { $type: "string" } }` in a future migration).
7. **Monitor 24h** — Atlas metrics: connections, opcounters, slow queries, CPU.

---

## Rollback procedure

1. If issues appear within **24 hours** of upgrade, Atlas console → **Edit configuration** → downgrade to previous tier (M0/M2/M5).
2. Rolling downgrade takes **~15–30 minutes** similar to upgrade.
3. **No application code rollback required** if only tier changed.
4. If data corruption suspected (rare on tier change), restore from **Atlas continuous backup** (M10+) snapshot — not available on M0; another reason to upgrade before heavy traffic.

---

## Expected downtime

| Scenario | Downtime |
|---|---|
| **Tier change (M0 → M10)** | **Zero to minimal** for app if connection string unchanged; brief reconnects possible during primary step-down |
| **Worst case** | **5–15 minutes** of intermittent 503s if HF Space connection pool holds stale sockets — **restart HF Space** after Atlas upgrade completes |
| **Planned maintenance message** | Optional: show frontend banner during window |

---

## Pre-upgrade checklist

- [ ] Export Atlas metrics baseline (connections, opcounters, query times)
- [ ] Confirm HF `MONGODB_URI` and `DB_NAME` in Space secrets
- [ ] Run `pytest -m "not integration"` and `pytest -m integration` on staging/test DB
- [ ] Notify team of maintenance window
- [ ] After upgrade: verify `/api/status/` and run live smoke test

---

## Related docs

- Keep-alive / cold start: `docs/UPTIME_SETUP.md`
- Load test notes: `scripts/SEED_LOAD_TEST.md`
- Launch readiness audit: `LAUNCH_READINESS_REPORT.md`
