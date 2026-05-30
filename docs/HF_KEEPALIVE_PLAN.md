# Hugging Face Keep-Alive Plan

Operational plan for reducing cold starts on the Happiness Exchange backend (Hugging Face Space).

## Current deployment

| Component | URL |
|---|---|
| Backend API (HF Space) | `https://arrifection-happiness-exchange.hf.space` |
| Frontend (Vercel) | `https://www.happyexchange.net` |
| Health endpoint | `https://arrifection-happiness-exchange.hf.space/api/status/` |

The frontend calls the HF Space directly in production (`src/lib/api.js`). The Space hosts the FastAPI backend only; static assets are on Vercel.

## HF sleep behavior

On Hugging Face **free-tier Spaces**, the app sleeps after a period of inactivity (typically ~48 hours without requests, but can vary). When asleep:

1. The first request triggers a cold start (container spin-up + dependency load).
2. Cold starts commonly take **15–60 seconds** before `/api/status/` responds.
3. Users hitting the site during wake-up may see slow loads until the backend is ready.

This is expected platform behavior, not a bug in the app.

## Cold-start impact

| Area | Impact |
|---|---|
| First API call after sleep | 15–60 s latency |
| Logged-in bootstrap (`/api/me`, items, needs) | Delayed until backend responds |
| User experience | Mitigated by frontend wakeup banner + bootstrap retries (see item #7) |

Keep-alive reduces how often cold starts happen; it does **not** eliminate them entirely (Space can still restart, deploy, or sleep if pings stop).

## Recommended monitoring & keep-alive

### Option A: UptimeRobot (recommended)

**Why:** Free, no server to maintain, built-in downtime alerts, policy-compliant HTTP GET monitoring.

| Setting | Value |
|---|---|
| Monitor type | HTTP(s) |
| URL | `https://arrifection-happiness-exchange.hf.space/api/status/` |
| Interval | **5 minutes** |
| Expected benefit | Space stays warm; fewer cold starts |
| Limitation | Does not guarantee 100% uptime; HF may still restart |

Setup steps are in [`UPTIME_SETUP.md`](./UPTIME_SETUP.md).

### Option B: GitHub Actions cron ping

**Why:** Already in repo; no external account required if Actions is enabled.

| Setting | Value |
|---|---|
| Workflow | `.github/workflows/keep-backend-warm.yml` |
| Schedule | Every **10 minutes** |
| Endpoint | Same `/api/status/` URL |
| Expected benefit | Reduces sleep frequency when repo Actions run |
| Limitation | Disabled or delayed if Actions credits/pauses; not a substitute for external monitoring alerts |

### Option C: Self-hosted cron / VPS script

**Why:** Useful only if you already run an always-on server.

| Setting | Value |
|---|---|
| Script | `scripts/keep_alive.py` |
| Interval | **10 minutes** (600 s) |
| Expected benefit | Same as above |
| Limitation | Requires reliable host; **do not run from a laptop** |

## Endpoint to ping

```
GET https://arrifection-happiness-exchange.hf.space/api/status/
```

- **Safe:** Read-only health check; no auth; no data mutation.
- **Success:** HTTP 200 with JSON status payload.
- **Do not use:** Heavy endpoints, auth flows, or synthetic load tests as keep-alive (violates good citizenship and may trigger rate limits).

## Platform policy notes

- Use normal HTTP health checks at reasonable intervals (5–10 minutes).
- Do **not** hammer the Space with sub-minute polling or parallel load generators.
- Do **not** bypass HF terms with fake traffic or credential scraping.
- UptimeRobot / cron GET pings are standard practice and align with HF acceptable use.

## Frontend fallback (always on)

Even with keep-alive configured:

1. `index.html` shows a branded loader before React hydrates (no blank page).
2. `BackendWakeupBanner` appears if bootstrap fetches exceed 4 seconds.
3. `fetchWithBootstrapRetry` retries bootstrap calls with backoff.
4. Failed bootstrap calls auto-retry every 8 seconds until the backend responds.

## Checklist before soft launch

- [ ] UptimeRobot monitor created (5 min interval)
- [ ] GitHub Actions workflow enabled on `main` (optional backup)
- [ ] Confirm `/api/status/` returns 200 from external network
- [ ] Manually verify wakeup banner after simulating slow backend (dev tools → network offline → reload)

## Related docs

- [`UPTIME_SETUP.md`](./UPTIME_SETUP.md) — step-by-step UptimeRobot setup
- [`PRODUCTION_BUILD_SECURITY.md`](./PRODUCTION_BUILD_SECURITY.md) — frontend build hardening
