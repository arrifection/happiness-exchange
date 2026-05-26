# Happiness Exchange — Live QA Tester Brief

**Purpose:** Give this document to an AI or human tester before they review the **production/live** deployment. They should behave like a skeptical first-time user, a malicious user, and a mobile user — then report everything broken, confusing, ugly, or unsafe.

**Your job as tester:** Do NOT be polite. Assume the founder thinks the app is “done.” Prove otherwise with evidence (URL, steps, screenshot description, console error, expected vs actual).

---

## 1. Live URLs (verify these first)

| Surface | Expected URL | Notes |
|---------|--------------|-------|
| **Public app** | `https://www.happyexchange.net` | Vite React SPA on Vercel |
| **Backend API** | `https://arrifection-happiness-exchange.hf.space` | FastAPI on Hugging Face Spaces |
| **API health** | `GET {API}/api/status/` | Should return OK, not timeout |
| **Admin panel** | Separate deploy (often `admin.*` subdomain or local `:5200`) | Ask owner for live admin URL if not public |

**Sanity check before testing:**
```text
GET https://arrifection-happiness-exchange.hf.space/api/status/
GET https://arrifection-happiness-exchange.hf.space/api/items
```
If the frontend loads but API calls fail → entire product is broken regardless of UI polish.

**Frontend API wiring:** Production build defaults to HF backend (`src/lib/api.js`). Vercel must NOT rely on same-origin `/api` for main flows (can timeout).

---

## 2. What this product is

**Happiness Exchange** is a community item-giving platform (Pakistan + Saudi Arabia MVP):

- **Givers** list free items with photos (Cloudinary).
- **Receivers** request items; owners approve/reject.
- **Chat** unlocks after approval (HTTP polling, not WebSockets).
- **Courier/delivery** flow keeps addresses encrypted; couriers use admin panel.
- **Trust score, badges, reviews, leaderboard** gamify good behavior.
- **Community Needs board** (`/needs`) — users post what they’re looking for.
- **Location:** country/city filters, optional lat/lng, browse map (Leaflet/OSM).
- **Food category** with optional safety fields (expiry, sealed, storage).

**Privacy promise:** Users should NOT see each other’s home addresses in public listings. Location is city/area level + approximate map pins.

---

## 3. Architecture (for debugging)

| Layer | Stack |
|-------|--------|
| Public UI | React 19, Vite, Tailwind, React Router |
| Admin UI | Separate Vite app in `admin panel/` |
| Backend | FastAPI + MongoDB (Atlas) |
| Auth | JWT in `localStorage` key `happiness_exchange_token` |
| Images | Cloudinary |
| Email verify | Resend (link-based, 24h token) |

**Unverified users:** Can browse. Cannot list, request, chat, or review (banner at top + flash messages).

---

## 4. Public app routes (must all load without white screen)

| Route | Purpose |
|-------|---------|
| `/` | Marketing home (logged out) or app home (logged in) |
| `/login`, `/signup` | Auth |
| `/check-email`, `/verify-email` | Email verification flow |
| `/browse` | Item feed + filters + map |
| `/give` | Create listing |
| `/items/:id` | Item detail |
| `/item-listed-success` | Post-create confirmation |
| `/needs`, `/requests-board` | Community needs board (alias) |
| `/requests` | Incoming item requests (owner activity) |
| `/messages`, `/messages/:id` | Chat |
| `/dashboard` | User dashboard |
| `/profile`, `/settings` | Profile (settings redirects to profile) |
| `/reputation` | Reputation view |
| `/leaderboard` | Top donors |
| `/deliveries/:id` | Delivery tracking |

**Mobile:** Bottom tab bar (Home, Browse, Give, Messages, Profile). **Needs** is in desktop nav + Dashboard/Activity links — verify mobile discoverability.

---

## 5. Admin panel routes (role-gated)

| Route | Min role |
|-------|----------|
| `/dashboard` | courier+ |
| `/listings`, `/requests`, `/reviews`, `/reports` | moderator+ |
| `/users`, `/analytics` | admin+ |
| `/team` | super_admin |
| `/courier` | courier+ |

**Test:** Log in as each role and confirm sidebar only shows allowed pages (no “Access Denied” traps).

---

## 6. Critical user journeys (test end-to-end on LIVE)

Use **two real email accounts** (or temp mail). Do not skip verification.

### A. Auth & trust
- [ ] Signup → receive verification email (or document if Resend broken)
- [ ] Unverified: browse works; give/request/chat blocked with clear message
- [ ] Verify email → banner disappears
- [ ] Login → refresh page → still logged in
- [ ] Logout → protected routes redirect
- [ ] Resend verification → 429 cooldown respected (no spam)

### B. Listings
- [ ] Create item: title, description, category, condition, image upload, location (Pakistan + city)
- [ ] **Food category:** safety note + optional expiry/sealed/storage fields save and display
- [ ] **Map picker on Give:** tap map sets pin; “Use current location” works AND denied path is friendly
- [ ] Item appears on Browse for **other** user, not own feed
- [ ] Image click → lightbox opens/closes (Esc, outside click, mobile)
- [ ] Delete / mark complete (owner actions menu)

### C. Location & browse
- [ ] Filter Pakistan vs Saudi Arabia — listings scoped correctly
- [ ] City filter works
- [ ] Map centers correct country; markers only for items with lat/lng
- [ ] “No listings found in this area” when no geo markers
- [ ] Legacy items without country still appear (Pakistan default)

### D. Requests & chat
- [ ] User B requests User A’s item
- [ ] User A sees request on `/requests` / dashboard
- [ ] Approve → item status `reserved`; chat unlocks
- [ ] Reject → request declined; no chat
- [ ] Send text + image in chat
- [ ] Unread badge updates (~15s polling — document delay)
- [ ] Block user → cannot message
- [ ] Report chat → flash confirmation (not silent fail)

### E. Needs board
- [ ] Browse open needs at `/needs`
- [ ] Verified user posts need (title, description, category, location, urgency)
- [ ] Unverified user blocked from posting
- [ ] Close / mark fulfilled own need
- [ ] “I have this item” → redirects to `/give` with prefilled title/category

### F. Reviews & reputation
- [ ] After completed exchange, leave review
- [ ] Trust score / badge updates on profile & reputation page
- [ ] Leaderboard loads real data (not empty/error)

### G. Delivery (if testable)
- [ ] Approved request → arrange delivery addresses
- [ ] Tracking page loads
- [ ] Confirm delivery — errors show inline (not alert)

### H. Admin (if credentials provided)
- [ ] Dashboard shows live counts (not mock/demo data)
- [ ] Moderator: listings, reports, reviews
- [ ] Ban user → banned user cannot use app
- [ ] Courier: delivery list, status updates, proof upload

---

## 7. Harsh judging criteria (score each 1–10)

| Category | What to attack |
|----------|----------------|
| **First 10 seconds** | Does value prop land? Is signup obvious? Any layout shift? |
| **Trust & safety** | Would you give your email? Would you meet a stranger from this app? |
| **Clarity** | Can a non-technical user list an item without help? |
| **Mobile** | Thumb reach, overflow, double scrollbars, map collapsible |
| **Dark mode** | Toggle in profile — readable text? Muddy greys? Broken cards? |
| **Performance** | Slow API, huge JS bundle (Leaflet), spinner stuck forever |
| **Error handling** | Network off → friendly message or blank page? |
| **Accessibility** | Contrast, focus rings, keyboard close on modals |
| **Brand** | Logo: gold `#F9C826` + purple `#8C57F5` SVG — not wrong yellow tint |
| **Polish** | Dead buttons, `href="#"`, placeholder copy, lorem ipsum |

**Overall launch readiness:** Ready / Soft launch / Not ready — justify in one paragraph.

---

## 8. Known gaps (do NOT ignore — confirm still true on live)

These were documented at last commit (`372cb9b` pre-launch polish). **Verify each on production:**

| Issue | Where to look |
|-------|----------------|
| Marketing footer links dead | Home page: Privacy, Terms, Contact → `#` |
| Needs “I have this item” no notification to requester | `/needs` — no bell notification |
| Marketing home mock phone items | Static demo content on landing (not real API) |
| Chat/notifications 10–15s polling lag | Send message — other user delay |
| No WebSockets | Real-time feel is weak |
| Admin uses `alert()` for some errors | Listings/Users/Reviews/Courier admin pages |
| Rate limiting weak | Try rapid signup/API spam (carefully) |
| No automated image moderation | Upload inappropriate image — does anything flag it? |
| Item edit flow | May be limited — check if users can PATCH listings |
| HF backend cold start | First request after idle may be slow/fail |

---

## 9. Security & abuse checks (document findings)

- [ ] JWT not exposed in URLs
- [ ] Cannot request own item
- [ ] Cannot access `/api/admin/*` with user token
- [ ] Cannot read other users’ private data via ID guessing
- [ ] XSS in chat messages (try `<script>alert(1)</script>`)
- [ ] CORS: frontend domain can call API; random domain cannot
- [ ] `.env` secrets not in frontend bundle (view source / network tab)
- [ ] Email verification bypass attempts
- [ ] Blocked user bypass via direct API

**Do not perform destructive attacks on production without owner permission.** Document theoretical risks only if blocked.

---

## 10. Browser & device matrix

Minimum:
- Chrome desktop (1440px)
- Chrome mobile emulation (390×844)
- One real phone if possible
- Dark mode ON for half the tests

Optional:
- Safari iOS (often breaks date inputs, file upload, geolocation)

---

## 11. Console & network checklist

On every major page, open DevTools:

- [ ] **Console:** zero red errors (yellow warnings OK if explained)
- [ ] **Network:** failed red requests? 503 from HF? CORS errors?
- [ ] **404** on assets (old CSS hash = stale deploy?)
- [ ] **Mixed content** if any HTTP calls on HTTPS site

Common failure signatures:
- `Failed to fetch` → API down or CORS
- `503 Database connection` → MongoDB Atlas / HF secrets
- Old CSS filename in HTML → Vercel not redeployed after push

---

## 12. API smoke list (optional curl/Postman)

```http
GET  /api/status/
GET  /api/items?country=Pakistan
GET  /api/items?country=Saudi%20Arabia&city=Riyadh
GET  /api/need-requests?status=open
GET  /api/leaderboard
POST /api/auth/signup        # test account only
POST /api/items              # requires verified JWT
POST /api/need-requests      # requires verified JWT
```

---

## 13. Brand reference (logo regression test)

Correct mark matches `public/favicon.svg` and marketing home `SmileGlyph`:

- Gold rectangle: `#F9C826` (not neon `#FFC430` canvas blob)
- Purple accents: `#8C57F5` / `#8b4cf6`
- Navbar: SVG logo + “Happiness Exchange” purple text
- Dark mode: logo readable, text `#c4b5fd` range

**Fail if:** logo is solid wrong yellow square, stretched, or text unreadable in dark mode.

---

## 14. Report format (required output from tester)

Deliver a structured report:

```markdown
# Happiness Exchange Live QA Report
**Date:** YYYY-MM-DD
**Tester:** [name/model]
**Environment:** Production URLs tested

## Executive verdict
[Ready / Soft launch / Not ready] — 2–3 sentences, harsh but fair.

## Blockers (P0) — must fix before real users
1. ...

## Major issues (P1)
1. ...

## Minor / polish (P2)
1. ...

## What actually works well (be specific)
- ...

## Journey results
| Journey | Pass/Fail | Notes |
|---------|-----------|-------|

## Screenshots / evidence
[List URLs + what you saw]

## Console errors collected
[Paste or summarize]

## Recommended fix order
1. ...
```

---

## 15. Instructions specifically for AI testers (Claude, etc.)

1. **Browse the live site** using browser tools if available — do not assume repo docs are accurate.
2. **Test as 2 users** minimum for request/chat flows.
3. **Compare** behavior to sections 6–8 above; flag anything that regressed.
4. **Be harsh on UX copy** — confusing labels, developer-facing errors, “Untitled item”, raw API `detail` strings shown to users.
5. **Do not mark “pass”** if you only read code — you must hit live URLs.
6. **Note deploy lag:** GitHub `main` at `372cb9b+` may not match Vercel if auto-deploy failed — check asset hashes and API version behavior.
7. **Separate scores** for public app vs admin panel.

---

## 16. Repo context (for code-level follow-up)

- Monorepo: public `src/`, backend `app/` + `api/index.py`, admin `admin panel/`
- Latest feature commits include: location filters, needs board, food category, map UI, image preview modal, pre-launch polish
- Automated tests exist but limited (`backend/tests/`) — live testing still mandatory
- `PROJECT_STATUS.md` in repo has fuller system inventory

---

## 17. Owner checklist after tester report

- [ ] Fix all P0 blockers
- [ ] Redeploy Vercel (frontend) + HF (backend) after fixes
- [ ] Confirm Resend email works on production backend
- [ ] Add Privacy/Terms pages or remove footer links
- [ ] Run through section 6 again on mobile
- [ ] Only then invite real humans

---

*Generated for Happiness Exchange pre-launch live QA. Update URLs and commit hash when redeploying.*
