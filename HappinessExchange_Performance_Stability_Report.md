# Happiness Exchange — Performance & Stability Report

**Audit date:** 2026-09-09  
**Auditor role:** Senior Performance / Load Testing / Backend Architecture / QA  
**Live frontend:** https://www.happyexchange.net  
**Live API:** https://arrifection-happiness-exchange.hf.space  
**Code baseline:** repository at audit time (`api_build` on live API: `2026-08-25-exchange-live-v1`)

---

## Executive Summary

### Answer first

| Question | Answer | Evidence class |
|---|---|---|
| **Safe concurrent users (production, realistic mix)** | **~10–25** logged-in / browsing users before UX degrades | **ESTIMATED** (anchored on MEASURED prod latency) |
| **Sustainable requests/sec (production)** | **~3–6 RPS** mixed public/API reads with acceptable-but-elevated latency | **ESTIMATED** from MEASURED prod probe (~2–6 RPS observed) |
| **Warning threshold** | **~25–50** concurrent active users **or** sustained **>~6–10 RPS** with p95 browse already multi-second | **ESTIMATED** |
| **Critical threshold** | **~50–100+** concurrent active users / aggressive polling storms; local single-worker showed **p95 ~15s at 50 VUs** | **ESTIMATED** (local MEASURED + architecture); **production exact break point UNKNOWN** (not stress-tested) |
| **Biggest bottleneck** | **Single-worker FastAPI on Hugging Face Spaces + MongoDB Atlas M0 latency**, amplified by **HTTP polling** | MEASURED + code inspection |
| **Biggest risk** | Viral traffic / polling storm saturates the one API container; frontend stays up while API becomes multi-second or times out | Architecture |
| **Most important fix** | Move API off free HF single-container to multi-worker / always-on host **and** stop doing work on `/api/status/` keep-alive | Code + infra |

**Confidence overall for exact capacity numbers: LOW–MEDIUM.**  
We have strong architecture evidence and limited live measurements. We intentionally **did not** run an aggressive production stress test.

### How stable is the website right now?

- **Frontend (Vercel):** appears stable under light load (**MEASURED** HTTP 200).
- **Backend (HF Space):** online and DB-connected (**MEASURED**), but already **~1.0–2.8 s** for common public API reads under tiny concurrency (**MEASURED**).
- **Stability verdict:** fine for a **soft / community MVP**, **not** ready for a viral spike or paid-ad campaign without infrastructure upgrades.

---

## Architecture Summary

### Runtime topology (inspected)

| Layer | Technology | Hosting | Notes |
|---|---|---|---|
| Public SPA | React 19 + Vite 6 + React Router | **Vercel** (`vercel.json`, `x-vercel-id` observed) | Static `dist`; SPA rewrites |
| Admin panel | Separate Vite app | Vercel (admin) | Out of primary traffic path |
| API | **FastAPI** (`api/index.py`) | **Hugging Face Spaces** Docker | `CMD uvicorn api.index:app --host 0.0.0.0 --port 7860` — **single worker** |
| Database | **MongoDB** via **Motor** async driver | **MongoDB Atlas** cluster `happiness-exchange.*.mongodb.net` | Docs + env confirm **M0 free tier** for production DB name `happiness_exchange` |
| Images | Cloudinary | Cloudinary | Upload path rate-limited |
| Email | Resend | Resend | Signup verification |
| Keep-warm | GitHub Actions cron every 10 min + optional UptimeRobot | Hits `/api/status/` | Reduces cold starts; does **not** add capacity |

### Workers / concurrency model

- **Backend workers:** **1** uvicorn process (**MEASURED** from `Dockerfile` CMD; no `--workers`, no Gunicorn).
- **Async model:** FastAPI + Motor are async, but **one event loop / one process** still serializes CPU-bound work and queues under overload.
- **WebSockets:** **None**. Chat/notifications use **HTTP polling** (15s notifications, 15s inbox, 10s active thread) — confirmed in `src/components/NotificationContext.jsx`, `src/pages/ChatLayout.jsx`.
- **Background jobs / cron in-app:** No dedicated worker queue. Expiration work is triggered opportunistically (notably from **`GET /api/status/`** via `run_exchange_offer_expiration_safely()` in `app/api/routes/health.py`).
- **Caching:** No Redis / CDN API cache / response cache for browse or reputation (**inspected**).
- **Connection pooling:** Motor/`AsyncIOMotorClient` created **without** explicit `maxPoolSize` (**inspected** `app/db/mongodb.py`) → pymongo default (**typically 100**) — **exact live pool usage UNKNOWN** (no Atlas metrics access in this audit).
- **Reverse proxy / CDN:** Vercel for static frontend. API is direct to `*.hf.space` (no Cloudflare observed on API path in this audit).

### Production vs development

| Setting | Production | Local load-test env used here |
|---|---|---|
| API host | HF Space | `127.0.0.1:8000` uvicorn |
| MongoDB | Atlas M0 (`happiness_exchange`) | Local Mongo `happiness_exchange_dev` |
| Cold starts | Possible after idle (mitigated by keep-alive) | N/A |
| Network RTT to DB | Material (Atlas remote) | Negligible (localhost) |

### CPU / RAM limits

| Resource | Status |
|---|---|
| HF Space CPU/RAM exact SKU | **UNKNOWN** from public Space page (shows Running; hardware tier not exposed in `/api/status/`) |
| Atlas M0 | Shared tier; docs in-repo cite ~500 connections cluster-wide and limited IOPS (**documented**, not re-measured in Atlas UI) |
| Local test machine | Used only as architectural proxy for single-worker behavior — **not** production capacity |

---

## Critical User Flows & Likely Bottlenecks

### Public traffic

| Flow | Endpoint / page | Risk |
|---|---|---|
| Homepage | Vercel static + bootstrap API calls | Frontend OK; API wake/latency risk |
| Browse / listings | `GET /api/items` | **Primary public bottleneck** |
| Search/filter | Mostly client-side on current page + server country/city/status | Incomplete server-side search |
| Geo browse | `GET /api/items?near_lat&near_lng` | **Unbounded** `to_list(length=None)` then in-memory filter |
| Community impact | `GET /api/community/impact` | `count_documents` + **`distinct("owner_id")`** |
| Auth | `POST /api/auth/login|signup` | SlowAPI 5/min; Resend cap on signup |

### Authenticated / write flows

| Flow | Endpoint | Notes |
|---|---|---|
| Notifications poll | `GET /api/notifications` every 15s | Full list (limit 20), not unread-count |
| Messages poll | `GET /api/conversations/my` + messages | Steady read load |
| Create listing | `POST /api/items` + image upload | Upload rate limits; Cloudinary |
| Give-away request | `POST /api/requests` | User rate limit 60/hour |
| Exchange/swap | `/api/exchange-offers*` | Write + notifications |
| Dashboard | Multiple parallel `/api/*` | Burst on login |

### Database-heavy operations (code audit)

1. **`GET /api/items` geo path** — loads **all** matching docs into memory (`items.py`).
2. **`GET /api/community/impact`** — `distinct` over owners (`community.py`).
3. **`calculate_reputation_summary`** — still multi-query per user for full reputation (detail/dashboard); public browse uses batched `build_public_reputation_lookup` (**improved**).
4. **Polling fan-out** — many small indexed reads, but volume dominates.
5. **`GET /api/status/`** — schedules offer expiration work on **every** health check (**surprising load amplifier** under testing and keep-alive).

---

## Database Scalability Audit

### Indexes

Indexes are created at startup in `app/db/mongodb.py` for users, items, requests, reviews, conversations, messages, notifications, deliveries, need_requests, trust_events, exchange_* collections.

**Local seed DB index check (MEASURED):** items indexes include `status_1_created_at_-1`, `country_1_city_1_status_1`, `country_city_category_status`, `owner_id_1_status_1`, etc.

**Partial unique index on `trust_events`:** startup warning on both local and Atlas-compatible tiers when `$ne: null` partial filter unsupported. App continues; duplicates handled in code. **Non-fatal.**

### Serious issues

#### 1) Geo browse unbounded fetch  
**Problem →** `find(...).to_list(length=None)` when `near_lat`/`near_lng` set.  
**Why it matters →** Memory + query cost grow with collection size.  
**Expected impact →** Browse latency cliffs as listings grow; easy abuse vector.  
**Fix →** Cap candidates (e.g. 500–1000), use geo index / `$geoNear`, or require country/city prefilter always.

#### 2) Community `distinct`  
**Problem →** `items_col.distinct("owner_id", ...)` on every impact page hit.  
**Why it matters →** Distinct scans grow with data; unauthenticated.  
**Expected impact →** Extra Atlas load; shows up under concurrency.  
**Fix →** Counter document updated on write, or cache 5–15 minutes.

#### 3) No explicit pool / timeout tuning beyond connect timeouts  
**Problem →** Only `serverSelectionTimeoutMS=8000`, `connectTimeoutMS=8000`; no `maxPoolSize`, no socket timeout overrides.  
**Why it matters →** Defaults may open many sockets toward M0 (~500 cap shared).  
**Expected impact →** Connection pressure under many concurrent requests.  
**Fix →** Set `maxPoolSize` intentionally (e.g. 20–50 for single instance), monitor Atlas.

#### 4) No caching of hot read paths  
**Problem →** Every browse recomputes reputation batch + counts.  
**Impact →** Multiplies Atlas ops under polling + refresh.  
**Fix →** Short TTL cache for page-1 browse / community stats; denormalize trust onto user docs.

#### 5) Offset pagination still available  
**Problem →** `skip` path remains when cursor omitted.  
**Impact →** Deep pages degrade (`skip` cost).  
**Fix →** Prefer cursor-only for public clients (frontend already can use `next_cursor`).

#### 6) Full reputation path still N+1 for non-batched callers  
**Problem →** `build_reputation_lookup` loops `calculate_reputation_summary`.  
**Impact →** Dashboard/profile heavy paths remain expensive.  
**Fix →** Extend batching / denormalization everywhere.

### What looks healthy

- Compound indexes for browse, requests, notifications, messages.
- Public items reputation batching (2 queries) for list endpoint.
- My-items request counts via aggregation (not per-item `count_documents`).
- Notification list is limited (`le=50`).
- Auth / upload write rate limits present.

---

## Test Methodology

### What was tested

1. **Code/infra inspection** of frontend, FastAPI, Dockerfile, Mongo indexes, rate limits, polling, env examples, prior performance docs.
2. **Production sequential baseline** (5 samples each, no concurrency hammering).
3. **Production conservative concurrent probe** — **5 then 10** virtual users, **10s** each, **public GET only** (`/api/status/`, `/api/items?limit=20`, `/api/community/impact`). No auth, no writes, no aggressive escalation.
4. **Local progressive load test** against **local Mongo seed DB** + single uvicorn worker (architecture proxy):
   - Seed: 100 users, 200 items (122 available after expiry refresh), 500 requests, 100 conversations, 1000 messages, etc.
   - Levels: **10 → 15 → 20 → 25 → 50** concurrent VUs, **15s** each.
   - Endpoints: status, items, community, notifications, conversations.
   - Stopped at critical (p95 ≥ 5s).

### What was deliberately NOT done

- No production stress above 10 concurrent VUs.
- No write floods, signup floods, or destructive tests.
- No Atlas UI metrics pull (credentials/UI not used for metrics export).
- No claim that local RPS equals production RPS.

### Evidence artifacts

| Artifact | Path |
|---|---|
| Local progressive results | `scripts/.seed/progressive_load_report_v2.json` |
| Earlier local run (client-pool issues) | `scripts/.seed/progressive_load_report.json` |
| Production probe | `scripts/.seed/production_conservative_probe.json` |
| Prior historical local suite | `scripts/.seed/load_test_report.json` (older; pre/post reputation notes in `PERFORMANCE.md`) |
| Helpers used | `scripts/.seed/prepare_loadtest_db.py`, `scripts/.seed/run_load_v2.py`, `scripts/.seed/prod_probe.py` |

### Limitations

- Production probe sample sizes are small.
- Local Mongo latency is much lower than Atlas → local overstates production headroom on DB-bound routes.
- VU scripts are **more aggressive** than real users (multiple endpoints ~every 1s vs 15s polls).
- HF CPU/RAM, Atlas opcounters, connection charts: **UNKNOWN** in this audit.
- Server CPU/RAM during local tests: process monitoring unreliable on Windows PID tracking; treat as **UNKNOWN**.

---

## Results

### A) Production sequential baseline (**MEASURED**, 2026-09-09)

| Target | Samples (ms) | Avg | p50 | Max | Codes |
|---|---|---:|---:|---:|---|
| `GET /api/status/` | 2382, 1594, 264, 330, 278 | **970** | 330 | 2382 | 200×5 |
| `GET /api/items?limit=20` | 1205–1214 | **1175** | 1167 | 1214 | 200×5 |
| `GET /api/community/impact` | 939–1038 | **984** | 963 | 1038 | 200×5 |
| `GET https://www.happyexchange.net/` | 2715, 304, 227, 632, 222 | **820** | 304 | 2715 | 200×5 |

Interpretation: After warm-up, status is hundreds of ms; **browse is already ~1.2 s at concurrency 1**. First samples show cold/queue spikes.

### B) Production conservative concurrency (**MEASURED**)

| Load | Endpoint | RPS (approx) | Avg | p95 | p99 | Errors |
|---:|---|---:|---:|---:|---:|---:|
| 5 VU / 10s | `/api/status/` | ~1.0 | 2019 ms | 2826 ms | 2826 ms | **0** |
| 5 VU / 10s | `/api/items` | ~1.0 | 2137 ms | 2826 ms | 2826 ms | **0** |
| 5 VU / 10s | `/api/community/impact` | ~1.0 | 1311 ms | 1980 ms | 1980 ms | **0** |
| 10 VU / 10s | `/api/status/` | ~2.0 | 1143 ms | 2030 ms | 2030 ms | **0** |
| 10 VU / 10s | `/api/items` | ~2.0 | 1879 ms | 2724 ms | 2724 ms | **0** |
| 10 VU / 10s | `/api/community/impact` | ~2.0 | 1185 ms | 1522 ms | 1522 ms | **0** |

**Approx aggregate production probe throughput:** ~**2–6 RPS** total across endpoints with **multi-second p95**, **0% errors**.

CPU / memory / DB connections on HF/Atlas during probe: **UNKNOWN**.

### C) Local single-worker progressive test (**MEASURED**, not production)

Environment: local Mongo `happiness_exchange_dev`, uvicorn 1 worker, seed data refreshed so listings are active.

| Load (VU) | RPS | Avg | p50 | p95 | p99 | Errors | Status |
|---:|---:|---:|---:|---:|---:|---:|---|
| 10 | 23.7 | 105 ms | 53 ms | 108 ms | 2231 ms | 0% | 🟢 Comfortable* |
| 15 | 26.6 | 154 ms | 44 ms | 146 ms | 4489 ms | 0% | 🟢 Comfortable* |
| 20 | 20.2 | 332 ms | 90 ms | 302 ms | 9109 ms | 0% | 🟢→🟡 (p99) |
| 25 | 13.8 | 623 ms | 90 ms | 364 ms | 16678 ms | 0% | 🟡 Warning (tail) |
| 50 | 11.4 | 1702 ms | — | **14843 ms** | **31329 ms** | 0% | 🔴 Critical |

\*Overall p95 looks fine at 10–25, but **`/api/status/` alone** had p95/p99 in **seconds to tens of seconds** because each call schedules expiration work — see bottlenecks.

At 50 VUs the system mostly **queued** (still HTTP 200) rather than returning 5xx — classic single-worker overload.

---

## Capacity Assessment

| Metric | Current capacity | Confidence | Class |
|---|---:|---|---|
| Safe concurrent users (realistic prod) | **10–25** | Medium | ESTIMATED |
| Sustainable RPS (prod, mixed reads) | **3–6** | Medium | ESTIMATED from MEASURED probe |
| Warning threshold | **25–50** users **or** p95 browse staying >2s | Medium | ESTIMATED |
| Critical threshold | **50–100+** users / polling storm | Low–Medium | ESTIMATED; exact prod break **UNKNOWN** |
| Local single-worker critical (synthetic) | **~50 VU** (p95 ~15s) | High for that lab setup | MEASURED |

### Values intentionally left blank / unknown

- Exact HF vCPU/RAM entitlement
- Atlas live connections / opcounters / CPU
- Production break point above 10 concurrent VUs
- CDN/edge cache hit rates for API (API is not CDN-cached)

**Do not treat local 25 VU “comfortable overall p95” as production capacity.** Production already shows ~2–3 s p95 browse at **5–10 VU**.

---

## Translate Concurrent Users Into Realistic Traffic

### Frontend polling math (**from code**, confirmed)

| Behavior | Interval | Approx req/min/user |
|---|---|---:|
| Notifications (logged in) | 15s | **4** |
| Chat inbox open | 15s | **4** |
| Active conversation | 10s | **6** |
| Typing/status | 30s | **2** |
| Idle logged-in (notifications only) | — | **~4** |
| Active chatter | — | **~16** |

### Assumptions for daily estimates

- “Concurrent active users” = users generating API traffic in the same minute (not MAU).
- Anonymous browsers generate bursty traffic without 15s polls; logged-in users dominate steady RPS.
- 1 request/min ≈ 1/60 RPS.

### Example translations (**ESTIMATED**)

| Concurrent profile | Steady RPS (approx) | Req/hour |
|---|---:|---:|
| 25 idle logged-in | 25 × 4/60 ≈ **1.7 RPS** | ~6k |
| 50 idle logged-in | ≈ **3.3 RPS** | ~12k |
| 50 with 10 active chatters | 40×4 + 10×16 / 60 ≈ **5.3 RPS** | ~19k |
| 100 idle logged-in | ≈ **6.7 RPS** | ~24k |

**Daily users:** cannot be derived from concurrency alone without session length / visit frequency.  
If average visit is 10 minutes and peak concurrent is 25, a rough order-of-magnitude peak-hour unique visitors might be hundreds — **illustrative only, not measured**.

**Important:** Load-test VUs hitting 5 endpoints every ~1s are **~20–70×** noisier than a typical idle logged-in user. Compare RPS, not raw VU counts, when mapping lab → production.

---

## Traffic Spike Scenarios

| Scenario | What happens (expected) | First failure component |
|---|---|---|
| **Normal** (handful of users) | Site usable; browse ~1–2 s | Atlas RTT + single worker |
| **Growth** (tens concurrent) | Latency rises; polls stack | HF API queue + Atlas |
| **Viral spike** (hundreds hit homepage) | **Frontend likely remains available** (Vercel static); API browse/community slow or time out; signup emails may hit Resend caps | **API / Mongo**, not Vercel HTML |
| **Extreme spike** (minutes) | Request queueing on single uvicorn; possible 502/503 from HF; connection pressure on M0; recovery after load drops is likely **automatic** if process stays up, but cold restart possible | HF container saturation |

**Recovery:** No sticky poison observed in code; after traffic falls, single worker should drain. Keep-alive helps avoid sleep but **does not** add capacity. Expiration work on status checks can slow recovery if health checks continue under load.

---

## Bottlenecks (ranked)

### P0 — Critical

| Item | Location | Evidence | Impact | Fix |
|---|---|---|---|---|
| Single-worker API on free HF | `Dockerfile` CMD | 1 process; local p95 explosion at 50 VU; prod multi-second at 5–10 VU | Hard ceiling on concurrency | Paid always-on host + multiple workers/replicas |
| Atlas M0 + remote latency | `docs/ATLAS_UPGRADE_PLAN.md`, prod ~1.2s browse | Shared IOPS/CPU | Every query pays tax | Upgrade M10+ before campaigns |
| Health check does write-path work | `app/api/routes/health.py` | Local status p95/p99 multi-second under load | Keep-alive **adds DB load** | Move expiration to dedicated scheduler; keep `/status` O(1) |

### P1 — High

| Item | Location | Evidence | Impact | Fix |
|---|---|---|---|---|
| HTTP polling architecture | `NotificationContext.jsx`, `ChatLayout.jsx` | 4–16 req/min/user | Linear RPS growth with online users | SSE/WebSocket + unread-count poll |
| Unauthenticated expensive reads | `/api/items`, `/api/community/impact` | No SlowAPI on these GETs | Abuse / scrape amplification | Cache, rate-limit, cheaper aggregations |
| Geo unbounded load | `items.py` geo branch | `to_list(length=None)` | Memory/CPU cliff | Cap + geo index |

### P2 — Medium

| Item | Location | Evidence | Impact | Fix |
|---|---|---|---|---|
| Community `distinct` | `community.py` | Code inspection | Hot page cost | Materialized counters |
| In-memory rate limits only | `rate_limit.py`, SlowAPI memory | Not shared across instances | Weak when multi-instance | Redis limiter |
| Full reputation N+1 path still exists | `reputation.py` | Code | Dashboard/profile cost | Denormalize / batch everywhere |
| Resend free tier | prior launch docs | Not re-measured today | Signup failures under spike | Paid email plan |

### P3 — Low

| Item | Notes |
|---|---|
| Offset pagination fallback | Prefer cursor-only |
| Trust events partial index warning | Non-fatal |
| Cloudinary free limits | Relevant mainly on upload spikes |

---

## Security + Abuse Considerations (availability)

| Risk | Status | Availability impact |
|---|---|---|
| Missing rate limit on public browse/community | **Confirmed** | Attackers can amplify Atlas/HF load cheaply |
| Login/signup SlowAPI 5/min | Present | Helps credential stuffing / signup flood somewhat |
| Upload limits | Present (SlowAPI + user buckets) | Helps |
| Pagination `limit` max 100 | Present | Reduces some abuse; geo path bypasses pagination cost |
| Notification full-list polling | Client polls list not `/unread-count` | Unnecessary DB/payload cost |
| In-process limiter | Per instance only | Bypass if multiple replicas later |
| Large image payloads | 5 MB cap | Partial protection |

No destructive abuse testing was performed.

---

## Scaling Recommendations

### Quick wins (remove needless load)

1. **Make `/api/status/` side-effect free** — move offer expiration to a scheduled job / separate internal route.  
   *Removes:* keep-alive amplification & status latency spikes.
2. **Poll `/api/notifications/unread-count`** for the badge; fetch full list on open only.  
   *Removes:* steady-state read amplification.
3. **Cache `community/impact` for 60–300s** in memory.  
   *Removes:* repeated `distinct`/counts.
4. **Cap geo candidate fetch** (hard limit).  
   *Removes:* unbounded memory scans.

### Backend improvements

- Prefer cursor pagination only for public browse.
- Extend reputation denormalization to user documents.
- Add request timeouts / circuit breaking to external calls (Cloudinary/Resend).
- Reduce dashboard fan-out (combine endpoints where safe).

### Database improvements

- Upgrade Atlas **before** marketing pushes (M10 recommended in-repo).
- Set explicit `maxPoolSize` appropriate to one API instance.
- Add geo index if geo browse remains a product feature.
- Monitor slow query log after upgrade.

### Infrastructure improvements

- Move API to Railway/Fly/Render/AWS with **≥2 workers** and autoscale.
- Put API behind a reverse proxy with timeouts and rate limits.
- Keep Vercel for static; optionally CDN-cache truly public GETs if made cache-safe.
- Retain external uptime pings, but only to a cheap health endpoint.

### Architecture improvements

- Redis for cache + distributed rate limits.
- SSE/WebSockets for chat/notifications.
- Background worker for expiration, emails, heavy aggregations.
- Read replicas only after primary vertical scale (later stage).

---

## Capacity Roadmap

### Stage 1 — Current (today)

**Safe for:** soft launch community traffic on the order of **tens of concurrent users**, accepting **~1–3 s** API latency.  
**Not safe for:** viral posts, ads, campus-wide launches.

### Stage 2 — ~2× traffic

**Must change:**

- Side-effect-free health checks + unread-count polling + community cache (quick wins).
- Atlas upgrade off M0 (or confirm metrics headroom).
- HF paid CPU **or** migrate API host.

### Stage 3 — ~5× traffic

**Required:**

- Multi-worker / multi-instance API.
- Redis cache for browse page 1 + rate limits.
- Replace chat/notification polling with push (SSE/WS).
- Paid Resend/Cloudinary as needed.

### Stage 4 — ~10× traffic

**Required:**

- Horizontal API autoscaling.
- MongoDB dedicated tier with monitoring/alerting (connections, opcounters, p95).
- Possibly separate read-optimized browse service or precomputed feeds.
- Formal load tests in staging that mirror production Atlas region/size.

Simply adding RAM to one free HF container **will not** solve polling + M0 + single-worker queueing.

---

## Priority Fixes

| # | Fix | Why | Expected impact | Difficulty | Priority |
|---|---|---|---|---|---|
| 1 | Remove work from `GET /api/status/` | Keep-alive currently triggers DB writes/scans | Immediate latency & Atlas relief | Low | P0 |
| 2 | Move API to multi-worker always-on host | Single HF worker is hard ceiling | Large concurrency gain | Medium | P0 |
| 3 | Upgrade MongoDB Atlas off M0 | Shared tier latency/IOPS | Lower p95 on all DB routes | Low (ops) | P0 |
| 4 | Switch badge polling to unread-count | 4 full-list fetches/min/user | Large steady RPS drop | Low | P1 |
| 5 | Cache community impact + cap geo fetch | Expensive public GETs | Abuse + spike resilience | Low–Medium | P1 |
| 6 | SSE/WebSockets + Redis | Polling architecture | Enables 5–10× online users | High | P2 |

---

## Failure Scenarios (when capacity is exceeded)

1. **Latency first:** browse/community/notifications climb to multi-second (already starting in production MEASURED data).
2. **Queueing:** single uvicorn event loop delays requests; clients see timeouts.
3. **Frontend still serves HTML/JS** from Vercel while API fails → users see spinners/errors/wakeup banners.
4. **Atlas:** possible connection/op throttling (not directly observed in this audit).
5. **Email:** signup bursts fail independently of web RPS (Resend caps).
6. **After load drops:** usually recovers if process alive; cold start may still cost 15–60s if Space slept (**documented** platform behavior).

---

## Final Verdict

> Capacity cannot currently be established with **high** confidence for an exact single breaking number because production was only probed conservatively (≤10 concurrent VUs), HF/Atlas resource metrics were not available, and local tests use a faster database than Atlas.

Evidence-based range:

> If Happiness Exchange suddenly receives approximately **10–25 active concurrent users** / about **3–6 requests per second** of mixed API traffic, the current system is **expected to remain available**, but **browse and related API calls are already often ~1–3 seconds** and should be treated as **near the warning zone**.  
> At approximately **50+ concurrent active users** with notification/chat polling (or a viral anonymous browse spike), the current **single-worker HF + Atlas M0** architecture is **expected to degrade severely** (multi-second to tens-of-seconds latency), while the **Vercel frontend may still load**.

### One-line stability summary

**Stable enough for a soft MVP; not scalable for a traffic spike without P0 infrastructure and health-check/polling fixes.**

---

## Appendix — Evidence Commands (representative)

```text
# Production sequential baselines (PowerShell Invoke-WebRequest loops)
# Production conservative probe: scripts/.seed/prod_probe.py
# Local API:
#   MONGODB_URI=mongodb://127.0.0.1:27017 DB_NAME=happiness_exchange_dev
#   uvicorn api.index:app --host 127.0.0.1 --port 8000
# Local progressive:
#   python scripts/.seed/prepare_loadtest_db.py
#   python scripts/.seed/run_load_v2.py
```

Live status sample (**MEASURED**):

```json
{"status":"online","database":"connected","api_build":"2026-08-25-exchange-live-v1","git_commit_short":"9984f9d6daa4"}
```

Dockerfile entrypoint (**inspected**):

```dockerfile
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
```
