# Production Build Security Audit

Last verified: 2026-05-30 (commit workflow — re-run after frontend config changes).

---

## Vite source maps (main public app)

**Config:** `vite.config.js`

```js
build: {
  sourcemap: false,
  // ...
}
```

**Verification:**

```bash
npm run build
# Confirm no files matching dist/assets/*.map
```

Source maps expose full source in DevTools. They are **disabled** for production.

---

## Admin panel (separate deploy)

**Config:** `admin panel/vite.config.js`

- `build.sourcemap` is **not explicitly set** (Vite default = false).
- Explicit `sourcemap: false` added for clarity and audit consistency.

Admin panel is **not** bundled with `www.happyexchange.net`.

---

## `VITE_` environment variable audit

Only variables prefixed with `VITE_` are embedded in the frontend bundle.

| Variable | Location | Classification |
|---|---|---|
| `VITE_API_BASE_URL` | `.env.example`, `src/lib/api.js` | **Safe** — public backend URL |
| `VITE_API_BASE_URL` | `admin panel/.env.example` | **Safe** — public backend URL |
| `VITE_APP_NAME` | `admin panel/.env.example` | **Safe** — display name only |

**No secrets found** in `VITE_` variables (no JWT secrets, API keys, admin tokens, or passwords).

**Rule:** Never prefix secrets with `VITE_`. Backend-only env vars: `MONGODB_URI`, `JWT_SECRET_KEY`, `RESEND_API_KEY`, `CLOUDINARY_*`, etc.

---

## How to re-verify before launch

1. `npm run build` — success, no `.map` in `dist/assets/`
2. `rg "VITE_" .env* admin\ panel/.env* .env.example` — review each hit
3. `rg "sourcemap" vite.config.js admin\ panel/vite.config.js` — confirm `false` or unset (default false)
