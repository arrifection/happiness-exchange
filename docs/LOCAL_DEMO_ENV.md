# Local demo / testing sandbox

A local-only playground with two seeded users, real listings, real requests and a
real swap offer, so you can test features as two different people without any
email, OTP, or phone verification.

**Local development only.** Two independent locks keep it off production:

| Lock | Effect |
|---|---|
| `local_demo_mode_enabled()` returns `False` when `ENVIRONMENT=production`/`prod` or `SPACE_ID` is set | `/api/dev/demo/*` is never mounted, and every handler re-checks the flag |
| `LOCAL_DEMO_MODE` defaults to `false` | Nothing is enabled unless you opt in locally |
| `scripts/demo_env.py` guards | Refuses production-like processes and any non-localhost MongoDB URI |
| Frontend gating | The dev bar and dev sign-in render behind a literal `import.meta.env.DEV`, so `npm run build` drops them from the bundle entirely |

---

## 1. One-time setup

In your project-root `.env` (see `backend/.env.example`):

```env
ENVIRONMENT=development
MONGODB_URI=mongodb://localhost:27017
DB_NAME=happiness_exchange
LOCAL_DEMO_MODE=true
```

Then seed the sandbox (local MongoDB must be running):

```bash
npm run seed:demo          # or: python scripts/demo_env.py
```

## 2. Start it

```bash
npm run dev:api            # uvicorn api.index:app --reload --port 8000
npm run dev                # vite on http://localhost:5173
```

The backend logs `LOCAL_DEMO_MODE is enabled: /api/dev/demo/* is mounted` on
startup. If it does not, the flag or the environment is wrong.

## 3. Sign in and switch users

- **Login page** — a "Local demo sandbox" panel lists both accounts. One click
  signs you in. No password, no email, no OTP.
- **Dev bar** (top of every local page) — shows who you are and switches between
  demo users anywhere in the app, plus a **Reset demo data** button.

Switching is real: the backend issues an ordinary access token for that user with
the same `create_access_token` the normal login uses, so every API call runs as
that person through the usual `get_current_user` dependencies.

| Account | Name | Email | Role in the data |
|---|---|---|---|
| User A | Sarah Demo | `sarah.demo@example.com` | Owns one Give Away and one Swap Only listing |
| User B | Muaaz Demo | `muaaz.demo@example.com` | Requests Sarah's items and sent the swap offer |

Both start as **New Member** with 0 trust points. Password fallback for the
normal login form: `LocalDemo123!` (override with `LOCAL_DEMO_PASSWORD`).

## 4. Reset

```bash
npm run reset:demo         # wipe + reseed
npm run clear:demo         # wipe only
```

Or click **Reset demo data** in the dev bar. Reset also removes anything the demo
users created while testing (requests, offers, conversations, notifications,
shipments), then reseeds the exact starting state below. Demo ids are stable, so
your session survives a reset.

---

## What gets seeded

Listing photos are generated locally into `uploads/items/` and served by the
backend's existing `/api/uploads/items` mount — no Cloudinary keys and no
internet needed.

**Listings**

| Listing | Owner | Mode | Status |
|---|---|---|---|
| Blue Denim Jacket | Sarah | GIVEAWAY | available |
| Bluetooth Speaker | Sarah | EXCHANGE (Swap Only) | available |
| Wireless Earphones | Muaaz | GIVEAWAY | available |
| Study Books Bundle | Muaaz | EXCHANGE (Swap Only) | available |
| Study Desk Lamp | Muaaz | GIVEAWAY | reserved (already approved) |

**Requests**

| Item | Requester | Status | What it is for |
|---|---|---|---|
| Blue Denim Jacket | Muaaz | pending | Sarah can approve or decline a normal Give Away request |
| Bluetooth Speaker | Muaaz | pending | Swap-only request — shows the "Send Swap Offer" call to action |
| Study Desk Lamp | Sarah | approved | Approved state on a reserved listing |
| Wireless Earphones | Sarah | rejected | Testing "Delete Request" on a declined request |

**Swap offer**

Muaaz offers his *Study Books Bundle* for Sarah's *Bluetooth Speaker*, status
`PENDING`. It appears under **My Swap Offers** for Muaaz and **Incoming Offers**
for Sarah.

Notes on realism: the approved request is seeded as history only — it has no
shipment or conversation attached. To exercise the full approval side effects
(conversations, Give Away shipment, notifications), approve the pending Blue
Denim Jacket request as Sarah in the UI. The pending request on the Swap Only
listing represents a request made before the owner switched that listing to Swap
Only, which is exactly the state the swap call-to-action handles.

---

## Verification checklist

Everything below uses the real UI and real APIs.

**As Sarah (User A)**

1. `/browse` — four available listings, each with a photo. The Swap Only cards
   show **Propose Swap**, the Give Away cards show **Interested**.
2. `/requests` → My Requests — two cards, both showing the listing photo (not
   "NO PHOTO"): Study Desk Lamp *approved*, Wireless Earphones *declined*.
3. On the declined card, click **Delete Request**, confirm, and it disappears
   from the list. Reset the demo data to bring it back.
4. `/requests` → Incoming — Muaaz's two requests. The Bluetooth Speaker card is
   labelled as a swap request.
5. Approve the Blue Denim Jacket request — the listing becomes reserved and the
   normal approval flow runs.
6. `/swaps` → Incoming Offers — Muaaz's offer of the Study Books Bundle. Accept,
   decline, or counter it.
7. `/swaps` → My Swap Offers — empty, with copy explaining that this tab is for
   offers you send.
8. `/deliveries` — the **Coming Soon** page, same as production.
9. Trust badge shows **New Member** with no hover popup.

**As Muaaz (User B)** — switch with the dev bar

1. `/requests` → My Requests — two pending cards with photos. The Bluetooth
   Speaker card offers **Send Swap Offer**.
2. `/swaps` → My Swap Offers — his pending offer on Sarah's speaker.
3. `/browse` — open Sarah's Blue Denim Jacket, request it (already requested, so
   the app blocks a duplicate), and open a Swap Only listing to see the propose
   flow with the delivery-charges acknowledgement popup.
4. `/requests` → Incoming — Sarah's approved and rejected requests on his items.

**Production safety**

```bash
python -m pytest backend/tests/test_local_demo_mode.py -q
npm run build
```

The test suite asserts the demo routes 404 when the flag is off, that the flag
cannot activate in production or on a Hugging Face Space, that seeding refuses
non-local databases, and that the seeded dataset keeps its shape. After
`npm run build`, `dist/assets/*.js` contains no `api/dev/demo` string.
