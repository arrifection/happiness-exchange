# Seed data & load testing (development only)

Safe tooling for pre-launch load testing. **Never targets production MongoDB by default.**

## Safety guarantees

| Rule | Implementation |
|------|----------------|
| No auto-run | Scripts exit after dry-run unless `--execute` is passed |
| Production DB blocked | `seed_helpers.assert_seed_database_allowed()` refuses non-local `MONGODB_URI` |
| Tagged records | Every seeded document has `is_test_data: true` and `seed_batch_id` |
| Safe cleanup | `clear_seed_data.py` deletes **only** `is_test_data: true` (never `is_seed_account` admins) |
| Load tests | `load_test_suite.py` blocks `happyexchange.net` / `hf.space` unless `--i-understand-production` |

Your workspace `.env` currently points at **MongoDB Atlas (production cluster)**. The seed script correctly **refuses** that URI. Use a local or dedicated staging database instead.

---

## 1. Local MongoDB setup

Install MongoDB Community locally, or run a staging instance you control.

```powershell
# Windows — override Atlas URI for this shell only
$env:MONGODB_URI = "mongodb://127.0.0.1:27017"
$env:DB_NAME = "happiness_exchange_dev"

# Start API (separate terminal)
uvicorn api.index:app --host 127.0.0.1 --port 8000
```

---

## 2. Seed test data

```powershell
# Dry run (default — no writes)
python scripts/seed_test_data.py

# Insert data
python scripts/seed_test_data.py --execute
```

### Targets created

| Collection | Count |
|------------|------:|
| users | 100 |
| items | 200 |
| requests | 500 |
| conversations | 100 |
| messages | 1,000 |
| reviews | 50 |
| notifications | 200 |

### Data characteristics

- **Cities:** Pakistan (Karachi, Lahore, Islamabad, …) and Saudi Arabia (Riyadh, Jeddah, Makkah, …)
- **Categories:** Furniture, Books, Clothes, Food, Kitchen, Family Items, Kids Goods, Home
- **Item statuses:** ~60% available, ~25% reserved, ~15% completed
- **Timestamps:** random within the last 90 days
- **Images:** `https://placehold.co/640x480/...` placeholders only
- **Trust scores:** 0–280; review ratings 1–5

### Test login

After seeding:

- **Email:** `loadtest.user001@seed.happyexchange.local`
- **Password:** `LoadTest123!`

Tokens for load tests are written to `scripts/.seed/load_test_tokens.json` (gitignored).

### Expected database size

Approximate document overhead used by the seed report:

| Collection | Est. bytes/doc | Total |
|------------|----------------:|------:|
| users | 900 | ~88 KB |
| items | 1,200 | ~234 KB |
| requests | 500 | ~244 KB |
| conversations | 700 | ~68 KB |
| messages | 350 | ~342 KB |
| reviews | 450 | ~22 KB |
| notifications | 300 | ~59 KB |
| **Total** | | **~1.0 MB** |

Plus MongoDB index overhead (~200–400 KB). Safe for local dev or a dedicated staging cluster.

---

## 3. Cleanup

```powershell
# Dry run
python scripts/clear_seed_data.py

# Delete all is_test_data records
python scripts/clear_seed_data.py --execute
```

---

## 4. Load test suite

Uses seeded JWT tokens and simulates realistic read patterns (status, items browse, community stats, notifications, conversations).

```powershell
python scripts/load_test_suite.py --base-url http://127.0.0.1:8000 --duration 20
```

Scenarios run in order: **50 → 100 → 250 → 500** concurrent virtual users.

Report written to `scripts/.seed/load_test_report.json`.

### Metrics reported per scenario

- Average response time (all endpoints)
- Slowest endpoint (by p95 latency)
- Failed requests and failure rate
- Estimated production capacity (heuristic)

---

## 5. Expected capacity (from launch audit)

Based on `LAUNCH_READINESS_REPORT.md` and HF Spaces + Atlas M0 architecture:

| Concurrent users | Expected behaviour |
|-----------------:|--------------------|
| **50** | Comfortable for soft MVP if HF container is warm; watch notification polling |
| **100** | Near capacity on free HF CPU; p95 on `GET /api/items` likely rises |
| **250** | Over free-tier comfort zone; timeouts and 503s probable |
| **500** | Exceeds current architecture; HF queue + Atlas M0 op limits |

**First endpoints to degrade:** `GET /api/items` (reputation N+1), `GET /api/notifications` (polling), `GET /api/conversations/my`.

**Before heavy promotion:** upgrade HF to paid CPU, Atlas M10+, consider WebSockets or longer poll intervals.

---

## 7. Sample run (local dev, 2026-05-29)

Environment: `mongodb://127.0.0.1:27017` / `happiness_exchange_dev`, uvicorn on port 8000, seed batch `loadtest-batch-20260529-161157`.

### Seed totals

| Collection | Created |
|------------|--------:|
| users | 100 |
| items | 200 |
| requests | 500 |
| conversations | 100 |
| messages | 1,000 |
| reviews | 50 |
| notifications | 200 |

Estimated storage: **~1.03 MB**. Index counts verified (users 3, items 10, requests 8, conversations 8, messages 5, notifications 7, reviews 6).

### Load test results (20s per scenario)

| Concurrent users | Avg response | Slowest endpoint (p95) | Failed | Capacity estimate |
|----------------:|-------------:|------------------------|-------:|-------------------|
| 50 | 3,287 ms | items (12,592 ms) | 150 / 270 (55.6%) | Over capacity |
| 100 | 4,488 ms | items (12,976 ms) | 287 / 487 (58.9%) | Over capacity |
| 250 | 15,185 ms | items (24,085 ms) | 250 / 500 (50.0%) | Over capacity |
| 500 | 22,259 ms | status (36,258 ms) | 639 / 639 (100%) | Over capacity |

**Notes from this run:**

- `GET /api/items` was the slowest endpoint under load (reputation lookup + browse).
- Auth endpoints (`/api/notifications`, `/api/conversations/my`) returned 5xx under concurrency — likely DB connection saturation on a single local uvicorn worker.
- At 500 users the API stopped responding reliably; even `/api/status/` began timing out.

Full JSON: `scripts/.seed/load_test_report.json`.

**Production estimate:** Local single-worker uvicorn degrades earlier than HF Spaces, but the pattern matches the launch audit — **`GET /api/items` and polling endpoints fail first**. Plan for **~50 warm concurrent users** on current free-tier HF + Atlas M0; upgrade before marketing pushes beyond 100 concurrent.

---

## 6. Staging override (optional)

Only if you have a **dedicated non-production** database:

```powershell
$env:SEED_STAGING_CONFIRM = "1"
$env:MONGODB_URI = "mongodb+srv://...@staging-cluster..."
$env:DB_NAME = "happiness_exchange_staging"
python scripts/seed_test_data.py --execute --allow-staging
```

Never set `SEED_STAGING_CONFIRM=1` against the live production cluster.
