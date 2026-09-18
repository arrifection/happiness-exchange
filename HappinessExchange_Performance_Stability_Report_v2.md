# Happiness Exchange — Performance & Stability Report v2

**Audit / retest date:** 2026-09-18  
**Role:** Senior Backend / Performance / DevOps  
**Live frontend:** https://www.happyexchange.net  
**Live API:** https://arrifection-happiness-exchange.hf.space  
**Local code baseline:** working tree with `api_build` label `2026-09-18-perf-stability-v2`  
**Live deploy baseline:** `api_build` **`2026-08-25-exchange-live-v1`** (confirmed **MEASURED** on 2026-09-18) — **local fixes are NOT on Hugging Face yet**

**Prior report:** `HappinessExchange_Performance_Stability_Report.md` (2026-09-09)  
**This report:** improvements implemented locally + local progressive retest + conservative production probe (≤10 VUs)

---

## Executive Summary

### Answer first

| Question | Answer | Evidence class |
|---|---|---|
| **Are the P0/P1 code fixes done locally?** | **Yes** — status side-effect removed, lifespan expiration, unread-count polling, community TTL cache, geo cap 1000, indexes/pool/worker docs | Code inspection + tests |
| **Are they live on HF?** | **No** — live still reports `2026-08-25-exchange-live-v1` | **MEASURED** |
| **Safe concurrent users (production, realistic mix)** | Still **~10–25** until infra upgrade + deploy of local fixes | **ESTIMATED** (anchored on MEASURED prod probe) |
| **Sustainable RPS (production)** | Still **~3–6 RPS** mixed public reads with multi-hundred-ms to ~2s latency | **ESTIMATED** from MEASURED probes |
| **Local single-worker after fixes** | Comfortable through **25 VU** synthetic mix; **critical at 50 VU** (overall p95 ~6.9s) | **MEASURED** |
| **Biggest remaining bottleneck** | **Single-worker HF + Atlas M0** (infra), not the health-check side effect (code, fixed locally) | Architecture + MEASURED |
| **Most important next step** | **Deploy** this tree to HF, then upgrade host/DB before campaigns | Ops |

**Confidence for exact production break point: LOW–MEDIUM** (prod only probed ≤10 VUs by design).

### Stability verdict

- **Frontend (Vercel):** fine under light load (**MEASURED** historically; not re-stressed).
- **Live API:** online + DB connected (**MEASURED**), browse still ~1.2–1.7s p95 under 5–10 VU public GETs (**MEASURED** AFTER probe).
- Soft MVP: OK. Viral spike: **not ready** without deploy + infra.

---

## Pre-Fix Findings

Confirmed before / during this pass (from code + v1 MEASURED data):

| Confirmed issue | File / location | Current behavior (pre-fix) | Expected performance impact |
|---|---|---|---|
| Health check schedules write-path work | `app/api/routes/health.py` | `asyncio.create_task(run_exchange_offer_expiration_safely())` on every `GET /api/status/` | Keep-alive and load scripts amplify DB load; status p95/p99 multi-second under local load (**MEASURED** in v1) |
| Notification badge polls full list | `src/components/NotificationContext.jsx` | Full `GET /api/notifications` on an interval (~15s historically) | Unnecessary payload + query cost ~4×/min/logged-in user |
| Community impact always hits Mongo | `app/api/routes/community.py` | `count_documents` ×2 + `distinct("owner_id")` every request | Hot public page cost; stampede under concurrency |
| Geo browse unbounded candidates | `app/api/routes/items.py` | Historical `to_list(length=None)` then in-memory filter | Memory/CPU cliff as catalog grows |
| Single uvicorn worker | `Dockerfile` CMD | No `--workers` | Hard concurrency ceiling; queueing before 5xx |
| Atlas M0 + remote RTT | Hosting / docs | Shared free tier | Dominates production p95 even at low VU |
| In-memory rate limits / caches | `rate_limit.py`, SlowAPI, community cache | Process-local | Blocks safe multi-worker without shared storage |

---

## Changes Made / Verified

### Phase 2 — Lightweight `/api/status/`

- **Removed** expiration scheduling from `app/api/routes/health.py`.
- **Moved** expiration to `api/index.py` lifespan loop (~600s) when `is_production_environment()` is true (HF `SPACE_ID` or `ENVIRONMENT=production|prod`).
- Status still does a cheap DB connectivity check via `get_db_async()` (no writes, no offer sweeps).

### Phase 3 — Notification polling

- Badge polls `GET /api/notifications/unread-count` every **30s**, only while the tab is **visible**; aborts in-flight requests on hide.
- Full list fetched only when the bell dropdown opens (`NotificationBell.jsx` → `fetchNotifications()`).
- Unread query uses indexed fields (`user_id`, `read`, `is_staff_alert`) — see `app/services/notifications.py` + index `user_read_staff_alert`.

### Phase 4 — Public endpoints (evidence-based only)

| Change | Why |
|---|---|
| Community 60s TTL cache | Distinct + counts are expensive and stable for a minute |
| Geo candidate cap 1000 + bbox prefilter | Prevents unbounded `to_list` |
| Reputation already batched on browse | Prior ship; no redundant browse cache added (invalidation risk without demonstrated need) |
| `maxPoolSize=50` | Already present for single-worker |

**Not added:** Redis, Celery, WebSockets, browse response cache, multi-worker CMD.

### Phase 5 — Community cache

- In-process TTL 60s, `asyncio.Lock`, double-checked locking, `global` assignment (avoids UnboundLocalError).

### Phase 6 — Geo caps

- `GEO_CANDIDATE_LIMIT = 1000` in `app/services/location.py`.
- Mongo partial index `status_latitude_longitude`.
- Cap-hit warning log when truncated.

### Phase 7 — Index audit (high-traffic)

| Query / path | Existing index | Problem | Proposed | Benefit |
|---|---|---|---|---|
| Browse `status` + `created_at` sort | `status_1_created_at_-1` | None material | Keep | Supports default browse |
| Location browse | `country_1_city_1_status_1` (+ category compound) | None material | Keep | Location filters |
| Geo bbox prefilter | `status_latitude_longitude` (partial numeric lat/lng) | None after geo work | Keep | Avoids collection scan for geo |
| Unread-count | `user_read_staff_alert` | None after unread work | Keep | Hot badge path |
| Offer expiration sweep | `status_expires_at` | None | Keep | Background sweep |
| Trust partial unique | partial `$ne: null` | Atlas M0 may warn | Leave / optional `$type:string` later | Non-fatal today |

**No redundant indexes added in this pass.**

### Phase 8 — Worker / HF config (documented, not blindly changed)

`Dockerfile` remains **single worker** with explicit comment why:

- Process-local rate limits (SlowAPI + custom buckets)
- Process-local community cache
- One lifespan expiration loop per process
- Mongo pool multiplies with workers (`maxPoolSize=50` each)

**Recommendation:** deploy code fixes first; only add `--workers 2+` after shared limiter + single job leader, on a paid always-on host, watching Atlas connections.

Exact HF CPU/RAM SKU: **UNKNOWN**.

### Phase 9 — Scope guardrails

No Redis / Celery / RabbitMQ / Kafka / WebSockets / CDN API cache introduced.

---

## Tests Run

| Suite | Result |
|---|---|
| `backend/tests/test_perf_status_community.py` (new) | **5 passed** |
| `backend/tests/test_notification_unread_query.py` | **passed** (part of 43) |
| `backend/tests/test_location.py` | **passed** (incl. geo cap == 1000) |
| `backend/tests/test_notification_dismiss_swap_condition_password.py` | **passed** |
| Combined related pytest | **43 passed** (+ 5 new = **48** focused) |
| `node scripts/test-notification-poll-config.mjs` | **passed** |

Nothing committed or pushed.

---

## Load Retest Results

### Caveats

- Local AFTER uses seed with **~10,000 available items** (prepare_loadtest_db refresh). v1/v2 BEFORE local runs used a much smaller active catalog (~122). **Items latency is not an apples-to-apples catalog comparison.**
- Synthetic VUs hit 5 endpoints every ~1s — far noisier than real idle users (~2 req/min after unread-count + 30s interval).
- Production AFTER probe still hits the **old** deploy; do **not** attribute prod deltas to unreleased code.

### A) Local progressive AFTER (**MEASURED**, 2026-09-18)

Artifact: `scripts/.seed/progressive_load_report_v4_retest.json`  
API: `http://127.0.0.1:8000`, `api_build=2026-09-18-perf-stability-v2`, unread-count auth **200**.

| VU | RPS | Avg | p50 | p95 | p99 | Errors | Class |
|---:|---:|---:|---:|---:|---:|---:|---|
| 5 | 15.6 | 72 ms | — | 169 ms | 584 ms | 0% | comfortable |
| 10 | 22.9 | 127 ms | — | 288 ms | 2294 ms | 0% | comfortable |
| 25 | 23.4 | 362 ms | — | 668 ms | 9726 ms | 0% | comfortable |
| 50 | 17.4 | 1091 ms | — | **6898 ms** | **22816 ms** | 0% | **critical** |

Per-endpoint highlights (AFTER):

| VU | status p95 | items p95 | community p95 | unread-count p95 |
|---:|---:|---:|---:|---:|
| 5 | 584 ms | 323 ms | 139 ms | 36 ms |
| 10 | 2294 ms | 316 ms | 57 ms | 74 ms |
| 25 | 9726 ms | 679 ms | 119 ms | 154 ms |
| 50 | 22816 ms | 1455 ms | 264 ms | 330 ms |

### B) Local BEFORE (reference, **MEASURED** 2026-09-09)

Artifact: `scripts/.seed/progressive_load_report_v2.json` (full-list notifications; status still scheduled expiration).

| VU | RPS | Avg | p95 | p99 | Errors | Class |
|---:|---:|---:|---:|---:|---:|---|
| 10 | 23.7 | 105 ms | 108 ms | 2231 ms | 0% | comfortable* |
| 25 | 13.8 | 623 ms | 364 ms | 16678 ms | 0% | warning (tail) |
| 50 | 11.4 | 1702 ms | **14843 ms** | **31329 ms** | 0% | critical |

\*Overall p95 looked fine while **status alone** had multi-second tails from expiration work.

Status-only BEFORE vs AFTER (same VU where available):

| VU | status p95 BEFORE (v2) | status p95 AFTER (v4) |
|---:|---:|---:|
| 10 | 2231 ms | 2294 ms |
| 25 | 16678 ms | **9726 ms** |
| 50 | 31329 ms | **22816 ms** |

Community-only at 50 VU: BEFORE p95 **548 ms** → AFTER **264 ms** (cache), despite larger seed.

Overall p95 at 50 VU: BEFORE **14843 ms** → AFTER **6898 ms**.

### C) Production conservative BEFORE (**MEASURED**, 2026-09-09)

Artifact: `scripts/.seed/production_conservative_probe.json`

| Load | Endpoint | Avg | p95 | Errors |
|---|---|---:|---:|---:|
| 5 VU / 10s | `/api/status/` | 2019 ms | 2826 ms | 0 |
| 5 VU / 10s | `/api/items` | 2137 ms | 2826 ms | 0 |
| 5 VU / 10s | `/api/community/impact` | 1311 ms | 1980 ms | 0 |
| 10 VU / 10s | `/api/status/` | 1143 ms | 2030 ms | 0 |
| 10 VU / 10s | `/api/items` | 1879 ms | 2724 ms | 0 |
| 10 VU / 10s | `/api/community/impact` | 1185 ms | 1522 ms | 0 |

### D) Production conservative AFTER (**MEASURED**, 2026-09-18)

Artifact: `scripts/.seed/production_conservative_probe_after.json`  
**Live `api_build` still `2026-08-25-exchange-live-v1` — fixes not deployed.**

| Load | Endpoint | Avg | p95 | Errors |
|---|---|---:|---:|---:|
| 5 VU / 10s | `/api/status/` | 539 ms | 1085 ms | 0 |
| 5 VU / 10s | `/api/items` | 1236 ms | 1410 ms | 0 |
| 5 VU / 10s | `/api/community/impact` | 943 ms | 971 ms | 0 |
| 10 VU / 10s | `/api/status/` | 569 ms | 1168 ms | 0 |
| 10 VU / 10s | `/api/items` | 1289 ms | 1683 ms | 0 |
| 10 VU / 10s | `/api/community/impact` | 949 ms | 977 ms | 0 |

**Interpretation:** Prod AFTER looks better than BEFORE on several cells, but sample sizes are small and the code path is still the old build. Treat as **environmental variance / warm state**, **not** proof of the local patch on HF. Re-run this probe after deploy before claiming production wins.

---

## Before / After Comparison Tables

### Code / behavior

| Area | Before | After (local tree) |
|---|---|---|
| `GET /api/status/` | Schedules offer expiration | Read-only status + build metadata |
| Offer expiration | Opportunistic on health checks | Lifespan loop every ~10 min in production |
| Notification badge | Full list poll | `/unread-count` every 30s (visible tab) |
| Community impact | Every request hits Mongo | 60s in-process TTL cache |
| Geo browse | Unbounded candidates (historical) | Cap 1000 + bbox index |
| Workers | 1 | 1 (unchanged; documented) |

### Local load (honest)

| Metric | Before (v2 artifact) | After (v4 artifact) | Notes |
|---|---|---|---|
| 25 VU overall p95 | 364 ms | 668 ms | Larger seed AFTER; still “comfortable” class |
| 50 VU overall p95 | 14843 ms | **6898 ms** | Improved; still critical |
| 50 VU status p95 | 31329 ms | **22816 ms** | Improved; queueing remains |
| 50 VU community p95 | 548 ms | **264 ms** | Cache benefit |
| Auth on badge path | n/a (list) | **200** unread-count | v3 invalid 401 run discarded |

### Production load

| Metric | Before | After | Deployed fix? |
|---|---|---|---|
| Browse p95 @ 10 VU | 2724 ms | 1683 ms | **No** (old `api_build`) |
| Status p95 @ 10 VU | 2030 ms | 1168 ms | **No** |
| Errors @ ≤10 VU | 0% | 0% | — |

Cells with deltas on production are **MEASURED** but **not attributed** to unreleased code.

---

## Capacity Assessment

| Metric | Value | Class |
|---|---|---|
| Safe concurrent users (prod, realistic) | **~10–25** | **ESTIMATED** |
| Sustainable mixed read RPS (prod) | **~3–6** | **ESTIMATED** from MEASURED probes |
| Warning threshold | **~25–50** concurrent **or** sustained browse p95 ≫ 2s | **ESTIMATED** |
| Critical threshold | **~50+** concurrent / polling storm | **ESTIMATED**; exact prod break **UNKNOWN** |
| Local synthetic critical (AFTER fixes) | **50 VU** (p95 ~6.9s) | **MEASURED** |
| HF vCPU / RAM | — | **UNKNOWN** |
| Atlas live connections / CPU | — | **UNKNOWN** |

### Polling math after fix (**from code**)

| Behavior | Interval | Approx req/min/user |
|---|---|---:|
| Notification badge (visible) | 30s | **2** (was ~4 on 15s full-list) |
| Hidden tab | — | **0** badge polls |
| Chat inbox open | 15s | **4** (unchanged) |
| Active conversation | 10s | **6** (unchanged) |

Idle logged-in steady RPS ≈ `users × 2/60` from notifications alone (**ESTIMATED**).

---

## Remaining Bottlenecks (ranked)

### P0

1. **Single-worker API on HF** — still the hard ceiling (**inspected** + local 50 VU **MEASURED**).
2. **Atlas M0 remote latency** — production browse still ~1–2s at low VU (**MEASURED**).
3. **Deploy lag** — local fixes not on live `api_build` (**MEASURED**).

### P1

1. Chat inbox / message HTTP polling (unchanged).
2. Unauthenticated expensive browse under scrape/spike (no SlowAPI on public GETs).
3. Community `distinct` still expensive on cache miss.

### P2

1. In-memory rate limits block multi-worker.
2. No browse/reputation TTL cache.
3. Resend / email caps under signup spikes (not re-measured).

---

## Priority Fixes (next)

| # | Fix | Status | Priority |
|---|---|---|---|
| 1 | Remove work from `/api/status/` + schedule expiration | **Done locally** — deploy | P0 |
| 2 | Unread-count badge polling | **Done locally** — deploy frontend+API together | P1 |
| 3 | Community cache + geo cap | **Done locally** — deploy | P1 |
| 4 | Move API to always-on multi-worker host (after shared limiter) | Documented, not done | P0 infra |
| 5 | Upgrade Atlas off M0 | Ops | P0 infra |
| 6 | SSE/WebSockets | Deferred | P2 |

---

## Final Verdict

Local code now addresses the audit’s top **application-level** amplifiers (health-check side effects, notification list polling, community stampede, geo unbounded fetch). Local retest shows **clear improvement at 50 VU overall p95** and **community tails**, with **50 VU still critical** on a single worker.

Production remains constrained by **HF single worker + Atlas M0**, and the live Space **does not yet include** these patches (`api_build` still `2026-08-25-exchange-live-v1`). Until deploy + infra upgrades, treat safe capacity as **~10–25 concurrent users / ~3–6 RPS** (**ESTIMATED**).

### One-line summary

**Application fixes are ready in the working tree and locally validated; production capacity is unchanged until deploy, and still not spike-ready without infrastructure upgrades.**

---

## Appendix — Evidence artifacts

```text
HappinessExchange_Performance_Stability_Report.md          # v1 (2026-09-09)
HappinessExchange_Performance_Stability_Report_v2.md       # this file
scripts/.seed/progressive_load_report_v2.json              # local BEFORE
scripts/.seed/progressive_load_report_v4_retest.json       # local AFTER
scripts/.seed/production_conservative_probe.json           # prod BEFORE
scripts/.seed/production_conservative_probe_after.json     # prod AFTER (old deploy)
scripts/.seed/run_load_v4_retest.py
scripts/.seed/prod_probe_after.py
PERFORMANCE.md                                             # worker + fix notes
Dockerfile                                                 # single-worker rationale
```

**Git:** no commit / no push performed for this work.
