# Local email testing and verification bypass

This is for **local development only**. Production email verification is unchanged.

## What you get

1. **Mailpit** captures outbound verification emails on your machine. You do not need a real inbox.
2. An optional **dev-only** flag so dummy accounts can skip clicking the verification link.
3. A local seed script for User A, User B, and a local admin account.

Production never enables the bypass automatically. If `ENVIRONMENT=production` (or `prod`) or the process is a Hugging Face Space (`SPACE_ID`), `DEV_BYPASS_EMAIL_VERIFICATION` is **ignored** even if it is set to `true`.

---

## 1. Start the local mail inbox (Mailpit)

From the repo root, prefer Mailpit if Docker is installed:

```bash
docker compose -f docker-compose.dev.yml up -d
```

If Docker is not installed, use the stdlib sink (same ports):

```bash
python scripts/dev_mail_sink.py
```

| Service | URL / port |
|---|---|
| Inbox UI | http://localhost:8025 |
| SMTP sink | `127.0.0.1:1025` |

Stop Mailpit with:

```bash
docker compose -f docker-compose.dev.yml down
```

Stop the Python sink with Ctrl+C.

If neither inbox is running, leave `SMTP_HOST` empty. The backend prints the verification link in the terminal instead. That still does **not** send mail to real users as long as the process is not production (local/development never uses Resend).

---

## 2. Backend connection

In your local `.env` (see `backend/.env.example`):

```env
ENVIRONMENT=development
DEV_BYPASS_EMAIL_VERIFICATION=false
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
RESEND_API_KEY=
APP_BASE_URL=http://localhost:5173
```

Leave **`RESEND_API_KEY` empty** locally. The backend then delivers mail to Mailpit over SMTP instead of Resend. Local/development never uses Resend, so dummy addresses such as `user-a@example.com` never hit a real mailbox.

How a verification email appears:

1. Sign up (or request a resend) with bypass **disabled**.
2. Open http://localhost:8025
3. Open the message **Verify your Happiness Exchange account**
4. Click the link (it uses `APP_BASE_URL`, so `http://localhost:5173/verify-email?token=...`)

---

## 3. Local verification bypass

```env
DEV_BYPASS_EMAIL_VERIFICATION=true
```

Default is **`false`**. Restart the backend after changing it.

When enabled **and** the process is not production:

- New signups are stored as `is_verified=true`
- `/api/me` and login payloads report verified
- Protected actions (`get_verified_user`) succeed without clicking the email link
- Password login, JWT, roles, and bans still apply

The normal `/verify-email` and `/resend-verification` endpoints remain available. Turn the flag **off** to exercise Mailpit.

Production:

```env
ENVIRONMENT=production
DEV_BYPASS_EMAIL_VERIFICATION=false
```

If someone accidentally sets the bypass in production, the backend logs an error and **does not** skip verification.

---

## 4. Dummy users

From the repo root, with local MongoDB running:

```bash
python scripts/seed_local_users.py
```

The script refuses production databases and production environments.

Documented local credentials (override with env vars; do not use these in production):

| Account | Email | Password | Role |
|---|---|---|---|
| User A | `user-a@example.com` | `LocalTest123!` | user |
| User B | `user-b@example.com` | `LocalTest123!` | user |
| Local admin | `admin-local@example.com` | `LocalAdmin123!` | super_admin |

WhatsApp numbers are pre-filled so Exchange listing / offer flows can run.

Optional env overrides: `LOCAL_USER_A_EMAIL`, `LOCAL_USER_A_PASSWORD`, `LOCAL_USER_B_EMAIL`, `LOCAL_USER_B_PASSWORD`, `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`.

---

## 5. Exact local setup commands

```bash
# 1. Local inbox (Mailpit if Docker exists, otherwise the Python sink)
docker compose -f docker-compose.dev.yml up -d
# or:
python scripts/dev_mail_sink.py

# 2. Local env (once)
#    Copy backend/.env.example values into the project-root .env used by uvicorn.
#    Keep RESEND_API_KEY empty. Set APP_BASE_URL=http://localhost:5173
#    SMTP_HOST=127.0.0.1
#    SMTP_PORT=1025

# 3. Dummy users (local MongoDB)
python scripts/seed_local_users.py

# 4. Backend
uvicorn api.index:app --reload --port 8000

# 5. Frontend
npm run dev
```

Log in as User A and User B with the table above.

### Exchange smoke path (existing product, unchanged)

1. User A: create an Exchange listing.
2. User B: open the listing, select a city, propose a swap (existing listing or custom item), submit.
3. User A: open Exchange offers, see User B’s city, accept / decline / counter.
4. Continue the existing shipping flow. Do not use real payment.

---

## 6. Production protection

| Setting | Production | Local with bypass |
|---|---|---|
| `ENVIRONMENT` | `production` | `development` |
| `DEV_BYPASS_EMAIL_VERIFICATION` | `false` (ignored if true) | `true` only when you set it |
| Email delivery | Resend | Mailpit SMTP (or terminal if SMTP is unset) |

Hugging Face Spaces set `SPACE_ID`, which is also treated as production for this bypass.
