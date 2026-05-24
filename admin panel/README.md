# Happiness Exchange — Admin Panel

Production admin dashboard for the Happiness Exchange platform. Connects exclusively to the live FastAPI backend and MongoDB — no demo or static data.

---

## Production URLs

| Service | URL |
|---------|-----|
| **Admin panel** | https://admin.happyexchange.net |
| **Public app** | https://happyexchange.net |
| **Backend API** | https://arrifection-happiness-exchange.hf.space |

---

## Environment Variables

| Variable | Production value |
|----------|------------------|
| `VITE_API_BASE_URL` | `https://arrifection-happiness-exchange.hf.space` |
| `VITE_APP_NAME` | `Happiness Exchange Admin` |

Copy `.env.example` to `.env` for local development.

---

## Create Your super_admin Account (Safe)

Credentials are **never** stored in the repo. Use environment variables only:

```bash
# From project root, with Python venv active and MONGODB_URI set to production:
ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='YourSecurePassword!' python scripts/seed_admin.py
```

This creates (or promotes) a `super_admin` account with `is_seed_account=True` so it is protected from demo cleanup scripts.

To remove later:

```bash
ADMIN_EMAIL=you@yourdomain.com python scripts/seed_admin.py --remove
```

After login, use **Team → Invite Member** to assign roles (`moderator`, `admin`, `courier`, `super_admin`) to existing platform users.

---

## Vercel Deployment (Admin Subdomain)

Deploy as a **separate Vercel project** from the monorepo:

| Setting | Value |
|---------|-------|
| Root Directory | `admin panel` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### Required Vercel environment variables

```
VITE_APP_NAME=Happiness Exchange Admin
VITE_API_BASE_URL=https://arrifection-happiness-exchange.hf.space
```

### Custom domain

1. In the admin Vercel project → **Settings → Domains**
2. Add `admin.happyexchange.net`
3. Add the DNS CNAME record Vercel provides at your DNS host
4. Keep the public app on `happyexchange.net` (separate Vercel project, root `src/`)

---

## Backend CORS

The backend must allow the admin origin. Set on Hugging Face Spaces (or your backend host):

```
ALLOWED_ORIGINS=http://localhost:5200,https://admin.happyexchange.net,https://happyexchange.net,https://www.happyexchange.net
```

Vercel preview URLs are matched via regex in `api/index.py`.

---

## Demo Data Cleanup

Preview deletions (dry run):

```bash
python scripts/clear_demo_data.py
```

Execute cleanup:

```bash
python scripts/clear_demo_data.py --execute
```

Removes only documents tagged or matching demo/test patterns. **Never** deletes `is_seed_account` users or real `super_admin` accounts.

---

## Local Development

```bash
cd "admin panel"
npm install
cp .env.example .env
npm run dev
```

Admin panel: http://localhost:5200

---

## API Integration

All data flows through `src/lib/api.js` using `VITE_API_BASE_URL`. If the backend is unreachable, pages show: **Unable to connect to backend.** No fake data is shown.

---

## Role-Based Access

| Role | Access |
|------|--------|
| `super_admin` | Full access + Team management |
| `admin` | All pages except super_admin-only actions |
| `moderator` | Reports, Reviews, Listings, Requests, Users |
| `courier` | Courier coordination only |
