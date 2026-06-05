# Admin panel deployment

The admin panel is a **separate Vercel project** from the public site. It talks to the same FastAPI backend on Hugging Face Spaces.

| Service | URL |
|---------|-----|
| Admin panel | https://admin.happyexchange.net |
| Backend API | https://arrifection-happiness-exchange.hf.space |
| Public app | https://happyexchange.net |

## Required Vercel environment variables

Set these on the **admin panel** Vercel project (Settings → Environment Variables):

```env
VITE_API_BASE_URL=https://arrifection-happiness-exchange.hf.space
VITE_APP_NAME=Happiness Exchange Admin
```

Apply to **Production**, **Preview**, and **Development** environments on Vercel.

## Do not use localhost in production

Never deploy the admin panel with:

```env
VITE_API_BASE_URL=http://localhost:8000
```

That breaks `/messages` and other pages on Vercel because there is no API on localhost in the browser.

The build also ships `admin panel/.env.production.example` with the HF URL. Copy to `.env.production` for local production builds, or rely on Vercel env vars.

## Vercel project settings

| Setting | Value |
|---------|-------|
| Root Directory | `admin panel` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

## Local development

```bash
cd "admin panel"
npm install
cp .env.example .env
npm run dev
```

Default `.env.example` points at the HF backend so you can develop without running FastAPI locally.

To use a local backend instead, set in `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the API from the repo root (`uvicorn` / your usual command) before opening the admin panel.

## API base resolution (`src/lib/env.js`)

1. If `VITE_API_URL` or `VITE_API_BASE_URL` is set → use it (unless deployed host + localhost URL → HF fallback).
2. Else if running on a deployed host or production build → HF backend.
3. Else local dev → `http://localhost:8000`.

In development, the chosen base is logged: `Admin API base: ...`

## Backend CORS

Ensure the backend allows the admin origin:

```env
ALLOWED_ORIGINS=...,https://admin.happyexchange.net,...
```

See `admin panel/README.md` for the full CORS list.
