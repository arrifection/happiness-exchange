# Happiness Exchange — Launch Readiness Report

**Date:** 2026-05-29  
**Commit audit baseline:** post `launch-readiness` hardening  
**Stack:** Vercel (frontend) · Hugging Face Spaces (FastAPI) · MongoDB Atlas · Cloudinary · Resend

---

## Executive summary

The app is **safe for a soft MVP launch (~50 concurrent users)** if you monitor HF + Atlas closely. **Heavy promotion (500+ concurrent)** will stress HTTP polling, Hugging Face CPU, and MongoDB M0 before Vercel or Cloudinary become the primary failure.

Code changes in this audit add **indexes**, **IP/user rate limits**, **request timing logs**, **startup warnings**, and a **safe load-test script**.

---

## 1. What breaks first at ~50 concurrent users?

| Order | Bottleneck | Why |
|------|------------|-----|
| **1** | **Hugging Face Spaces CPU + cold starts** | Single container; 15s notification polling + 10s chat polling creates steady read load. Cold start after idle adds 5–30s latency spikes. |
| **2** | **MongoDB Atlas M0 op limits** | `GET /api/items` builds reputation for up to 100 items × unique owners (`build_reputation_lookup` = multiple queries per owner). Browse spikes become expensive. |
| **3** | **Chat + notification polling storm** | ~4 notification req/min/user + up to ~12 chat req/min/active chatter. 50 logged-in users ≈ **200–800 req/min** to HF. |
| **4** | **Resend email throughput** | Signup bursts hit Resend free tier (100 emails/day on free). Verification emails fail with 503 after account creation. |

**Unlikely at 50:** Vercel bandwidth, Cloudinary storage, domain.pk DNS.

---

## 2. What breaks first at ~500 concurrent users?

| Order | Bottleneck | Why |
|------|------------|-----|
| **1** | **HF Spaces hard limits** | CPU saturation, request queueing, timeouts on `/api/items`, `/api/notifications`, chat routes. |
| **2** | **MongoDB M0** | Connection count + sustained read/write; index helps but reputation N+1 still multiplies load. |
| **3** | **HTTP polling architecture** | 500 users × 4 notif/min = **2,000 req/min** minimum; active chat users add **6–12 req/min** each. |
| **4** | **Cloudinary upload concurrency** | Promotion + listing photos; free tier transform/bandwidth caps. |
| **5** | **In-memory rate limits** | Current limiter is **per HF instance, not shared** — still helps abuse, not cluster-wide. |

---

## 3. Risky free-tier services for launch

| Service | Risk | Notes |
|---------|------|-------|
| **Hugging Face Spaces (free CPU)** | **HIGH** | Primary API; no autoscale; sleeps on idle |
| **MongoDB Atlas M0** | **HIGH** | ~500 connections, limited IOPS |
| **Resend free** | **MEDIUM–HIGH** | Daily send cap; signup spikes |
| **Cloudinary free** | **MEDIUM** | Storage + bandwidth + transform limits |
| **Vercel Hobby** | **LOW–MEDIUM** | Static SPA; bandwidth usually fine for MVP |
| **domain.pk DNS** | **LOW** | Monitor TTL/propagation only |

---

## 4. Must upgrade before heavy promotion

| Priority | Service | Recommendation |
|----------|---------|----------------|
| **P0** | **Hugging Face Spaces** | Paid CPU upgrade or move API to Railway/Fly/Render with autoscaling |
| **P0** | **MongoDB Atlas** | **M10+** (or M2/M5 minimum for first promo wave) |
| **P1** | **Resend** | Paid plan matching expected signups/day |
| **P1** | **Cloudinary** | Paid if expecting many image uploads |
| **P2** | **Architecture** | Replace 10–15s HTTP polling with SSE/WebSockets + Redis (see PROJECT_STATUS.md) |

---

## 5. Safe to stay free for MVP (soft launch)

- **Vercel** frontend hosting (monitor bandwidth)
- **Cloudinary** if < ~500 uploads/month and modest traffic
- **Resend** if < ~100 verification emails/day
- **GitHub** CI/source
- **domain.pk** DNS (already paid domain)

---

## 6. Polling — API requests per minute (per active user)

| Source | Interval | Endpoint(s) | Req/min |
|--------|----------|-------------|---------|
| Notification bell | 15s | `GET /api/notifications` | **4.0** |
| Chat inbox list | 15s | `GET /api/conversations/my` | **4.0** |
| Active conversation | 10s | `GET /api/conversations/{id}/messages` | **6.0** |
| Typing/online status | 30s | `GET /api/users/{id}/status` | **2.0** |
| Dashboard | On mount only | multiple `/api/*` | burst, not steady |

**Typical logged-in user (not in chat):** ~**4 req/min**  
**User actively chatting:** ~**16 req/min** (4 + 4 + 6 + 2)

**50 concurrent (worst case all chatting):** ~**800 req/min**  
**500 concurrent (all polling notifications only):** ~**2,000 req/min**  
**500 concurrent (100 active chatters):** ~**2,000 + 1,600 ≈ 3,600 req/min**

---

## 7. N+1 queries & repeated API calls

### Backend N+1 (confirmed)

- **`build_reputation_lookup`** → calls `calculate_reputation_summary` per owner on **`GET /api/items`** (up to ~100 items, many owners). Each summary runs multiple finds + **per-request item lookups** for approved requests.
- **`list_my_items`** → `count_documents` per item for request_count.
- **Chat send** → 2× `users_col.find_one` for block checks (acceptable).

### Frontend repeated calls

- **`loadRequestData`** on login: 3 parallel calls (my requests, incoming, deliveries).
- **`loadItems`** on mount + again when `currentUser` changes.
- **ChatLayout** polls conversations even when viewing one thread (duplicate with App-level conversation load on login).

**Recommendation (post-launch):** Cache reputation on user document; paginate `/api/items`; switch notifications to `/api/notifications/unread-count` for polling (lighter than full list).

---

## 8–9. MongoDB indexes

### Before this audit
Partial coverage; missing compound indexes for browse filters and notification unread counts.

### Applied in `app/db/mongodb.py`

| Collection | Indexes added/verified |
|------------|------------------------|
| **items** | `status`, `created_at`, `owner_id`, `category`, `country`, `city`, `(status, created_at)`, `(country, city, status)`, `(owner_id, status)` |
| **requests** | `item_id`, `requester_id`, `owner_id`, `status`, `(item_id, requester_id)` unique, `(owner_id, status, created_at)`, `(requester_id, status, created_at)` |
| **conversations** | `item_id`, `giver_id`, `receiver_id`, `last_message_at`, `(giver_id, last_message_at)`, `(receiver_id, last_message_at)` |
| **messages** | `conversation_id`, `created_at`, `(conversation_id, created_at)`, `(sender_id, created_at)` |
| **notifications** | `user_id`, `read`, `created_at`, `(user_id, created_at)`, `(user_id, read)`, `(user_id, read, created_at)` |
| **reviews** | `reviewed_user_id`, `reviewer_id`, `created_at`, `(reviewed_user_id, created_at)` |
| **need_requests** | Already indexed: `status`, `created_at`, `created_by`, `(country, city)` |

Indexes sync on backend startup (new deploy required).

---

## 10. Image upload safety

| Check | Status |
|-------|--------|
| Max size 5 MB | ✅ `MAX_IMAGE_SIZE_BYTES` |
| MIME `image/*` check | ✅ content-type prefix |
| Explicit allowlist (jpeg/png/webp) | ⚠️ prefix only — recommend tightening later |
| Server-side resize/compression | ❌ **Not implemented** — full-size uploaded to Cloudinary |
| Cloudinary folder | ✅ `CLOUDINARY_FOLDER=happiness-exchange/items` |
| Graceful Cloudinary failure | ✅ 502/503 with user-safe messages; local fallback dev-only |
| Magic-byte validation | ❌ not implemented |

---

## 11. Rate limiting

| Route | Before | After (this audit) |
|-------|--------|---------------------|
| Signup | none | **8 / hour / IP** |
| Login | none | **20 / 15 min / IP** |
| Resend verification | 10 min/user DB cooldown | + **12 / hour / IP** |
| Create item | none | **30 / hour / user** |
| Upload image | none | **40 / hour / user** |
| Create request | none | **60 / hour / user** |
| Send message | 5 msg / 10s / user | ✅ existing spam check |

**Note:** In-memory limiter resets on HF redeploy; not multi-instance safe.

---

## 12. Backend reliability

| Check | Status |
|-------|--------|
| Health endpoint | ✅ `GET /api/status/` with DB ping, git commit, build time |
| Startup env logging | ✅ `settings.log_startup_info()` |
| Production warnings | ✅ **Added** `log_production_warnings()` |
| Email failure on signup | ⚠️ Account created then 503 if Resend fails (no rollback) |
| Cloudinary failure | ✅ Graceful 502/503 |
| JWT default secret warning | ✅ logged at startup |

---

## 13. Observability added

- **`RequestLoggingMiddleware`** — logs `request_id`, method, path, status, `duration_ms` (logger: `happiness.api`)
- **`/api/status/`** — already exposes `git_commit`, `git_commit_short`, `built_at`, `api_build`
- **`api_build`** bumped to `2026-05-29-launch-readiness-v1`

**Still missing for scale:** Sentry/Datadog, MongoDB slow-query alerts, HF metrics dashboard.

---

## 14. Load test script

```bash
# Local backend (safe default)
python scripts/load_test.py --users 50 --duration 30

# With auth polling simulation
LOAD_TEST_TOKEN=<jwt> python scripts/load_test.py --users 50 --duration 30 --auth

# 500 users (local only, short duration)
python scripts/load_test.py --users 500 --duration 15
```

Production hosts are **blocked** unless `--i-understand-production` is passed.

---

## Must-buy now (before big promo)

1. **HF Spaces CPU upgrade** (~$5–20/mo) — **or** migrate API  
2. **MongoDB Atlas M10** (~$57/mo) — M2/M5 for smaller promo  
3. **Resend paid** (~$20/mo) if expecting >100 signups/day  

## Optional later

- Cloudinary Plus  
- Vercel Pro (team previews, analytics)  
- Redis + WebSockets service  
- Sentry  

## Expected monthly cost (launch-ready)

| Tier | Estimate |
|------|----------|
| **Soft MVP (50 concurrent)** | **$0–15/mo** (stay free, accept risk) |
| **Promo-ready** | **~$80–120/mo** (HF paid + Atlas M10 + Resend) |
| **Scale-ready** | **~$200–400/mo** (+ Cloudinary, monitoring, Redis) |

---

## Realistic launch capacity estimate

| Scenario | Capacity | Confidence |
|----------|----------|------------|
| Free tier, current polling | **30–50 concurrent** | Medium |
| Free tier, peak bursts | **100+ brief spikes** with degraded latency | Low |
| HF paid + M10 + polling | **150–300 concurrent** | Medium |
| + WebSockets + cached reputation | **500+ concurrent** | High (with load test proof) |

---

## Monitor during launch

- `GET /api/status/` — `database`, `git_commit`, response time  
- HF Space CPU / memory / restart count  
- Atlas connections, opcounters, slow queries  
- Resend bounce/error rate  
- Cloudinary upload errors  
- Vercel 5xx (edge)  
- Rate-limit 429 rate on `/api/auth/*`  

---

## Rollback plan (traffic spike)

1. **Frontend:** Vercel → instant rollback to previous deployment  
2. **Backend:** HF Space → rollback to previous git commit on `hf` remote  
3. **Emergency levers:**  
   - Increase notification poll interval in `NotificationContext.jsx` (15s → 60s) and redeploy frontend only  
   - Temporarily disable signup (maintenance flag) if abuse/signup flood  
   - Pause promotion links  
4. **Database:** Do not rollback Mongo; indexes are backward-compatible  

---

## Code changes in this audit

| File | Change |
|------|--------|
| `app/db/mongodb.py` | Production indexes |
| `app/core/rate_limit.py` | IP/user rate limiting |
| `app/core/middleware.py` | Request timing logs |
| `app/core/startup_checks.py` | Startup warnings |
| `app/api/routes/auth.py` | Auth rate limits |
| `app/api/routes/items.py` | Create/upload limits |
| `app/api/routes/requests.py` | Request create limit |
| `app/api/routes/health.py` | Build label bump |
| `api/index.py` | Middleware + startup checks |
| `scripts/load_test.py` | Safe load test |

---

## Testing commands

```bash
# Backend import check
python -c "from api.index import app; print('ok', app.title)"

# Frontend build
npm run build

# Live status
python scripts/verify_live_deploy.py

# Load test (local)
python scripts/load_test.py --users 50 --duration 30
```

---

## Remaining recommended work (no code in this pass)

1. Poll **`/api/notifications/unread-count`** instead of full list  
2. Cache or denormalize owner reputation on browse  
3. Add Cloudinary `c_limit,w_1200,q_auto` transformation on upload  
4. Externalize rate limits to Redis before multi-instance API  
5. WebSockets for chat/notifications before 500+ concurrent target  
