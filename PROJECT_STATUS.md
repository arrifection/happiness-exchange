# Happiness Exchange - Project Status

## 1. Project Overview
* **What Happiness Exchange is:** A community platform designed for neighbors to safely and anonymously exchange items and donations without exposing their personal information.
* **Core platform concept:** A safe space for giving. Givers list items, receivers request them, and a trusted courier handles the physical exchange so addresses remain private. 
* **Public app + admin panel architecture:** The platform consists of a user-facing Vite+React app for browsing/requesting items and an isolated Admin Vite+React app for moderation and courier coordination.
* **Current tech stack:**
  * **Frontend:** React, Vite, TailwindCSS (Public App)
  * **Admin Panel:** React, Vite, TailwindCSS (Admin App)
  * **Backend:** FastAPI (Python)
  * **Database:** MongoDB
  * **Hosting:** Vercel (planned for frontend), general cloud hosting for backend
  * **Image handling:** Cloudinary (for items and delivery proofs)
  * **Authentication:** JWT (JSON Web Tokens) with hashed passwords
  * **Notifications:** Polling-based HTTP endpoints storing notifications in MongoDB

## 2. Current Folder Structure
* **`src/` (Frontend):** Contains the public Vite app (React components, pages, context, and UI elements).
* **`app/` (Backend):** Contains the FastAPI backend application.
  * **`app/api/`:** REST API route definitions.
  * **`app/models/` & `app/schemas/`:** Pydantic models for MongoDB validation.
  * **`app/services/`:** Business logic and external integrations (e.g., encryption, cloudinary).
* **`admin panel/`:** Contains the completely separate Vite app for admins, moderators, and couriers.
* **`api/`:** Serverless entry points (e.g., `index.py`) for deploying FastAPI to Vercel/similar environments.

## 3. Current Transport Strategy
* **Polling:** Notifications and chat functionality currently rely on MVP HTTP polling at 10–15s intervals.
* **WebSocket Migration:** A transition to WebSockets is planned for a later phase to support true real-time events and reduce server overhead.
* **Compatibility:** The current data models and database schemas have been designed to remain compatible with future WebSocket integrations, minimizing migration friction.

## 4. Current Scale Assumption
* **Target Scale:** The current architecture and infrastructure choices are optimized for the MVP launch and early-stage user acquisition.
* **Required Upgrades:** The platform will require specific infrastructure upgrades (e.g., dedicated caching layers, WebSockets, specialized search indexing) before handling large-scale production traffic.

## 5. Systems Fully Implemented
* **Authentication:** Registration, Login, JWT generation, and basic RBAC. Works fully.
* **Email verification:** Resend API in production; local dev prints verification link to server terminal when `RESEND_API_KEY` is unset. Link-based verification with 24h token expiry and 10-minute resend cooldown. Works fully.
* **Future enhancement:** OTP/code-based email verification (6-digit code entry) is a possible future UX improvement — not implemented yet; current flow uses email link/button verification only.
* **Item listing flow:** Users can create, view, and manage items with Cloudinary image uploads. Works fully.
* **Requests system:** Users can request items, owners can approve/reject. Works fully.
* **Chat system:** Upgraded to a modern marketplace messaging experience with typing indicators, online status, image URLs, and unread counters. Works fully.
* **Notifications:** MVP HTTP polling (10-15s intervals) bell notifications with dynamic dropdown and unread counts. Works fully.
* **Reviews:** Users can review completed exchanges. Works fully.
* **Trust score & badges:** Dynamic point calculation (+10 for donations, etc.) with animated badge showcase and reputation levels. Works fully.
* **Leaderboard:** Global ranking of top 50 users. Works fully.
* **Admin panel:** Separate dashboard for managing users, listings, reports, and deliveries. Works fully.
* **Role-based access control:** Distinct roles for users, couriers, moderators, admins. Works fully.
* **Audit logging:** Basic action logging for admin moderation. Works fully.
* **Reporting/moderation:** Users and items can be flagged for review. Works fully.
* **Blocking/reporting users:** Blocked users cannot interact/chat. Works fully.
* **Responsive UI/mobile-first work:** Core components and chat are mobile optimized. Works fully.

## 6. Systems Partially Implemented / Pending
* **Courier coordination workflow & Anonymous delivery:** Core architecture and privacy model implemented; real courier operations require testing. Integration with a live logistics 3PL API is pending.
* **Production Resend setup:** Set `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` on the backend host (Hugging Face Spaces secrets).
* **WebSocket migration:** Pending (currently using MVP HTTP polling).
* **Advanced moderation:** Basic profanity filtering exists, but AI-driven content safety is pending.
* **Push notifications:** Web Push API or mobile push is pending.
* **Production analytics:** Pending.
* **Scheduled leaderboard jobs:** Currently dynamic. Background comparative calculation (e.g., "Top Donor of the Week") is pending.
* **Delivery proof verification:** Manual image uploads work, but automated verification/OCR is pending.
* **Image moderation:** Pending.
* **Rate limiting improvements:** Advanced API rate limiting and DDoS protection need configuration.
* **Placeholder logic:** Any non-detected "suspicious activity" triggers are currently just placeholders.

## 7. Production-Ready vs MVP-Only
### A. Production-Ready Systems
* Backend MongoDB schemas, relationships, and unique indexing
* JWT Authentication middleware and RBAC guards
* CRUD routes for Items, Reviews, and Requests
* Encrypted Courier Database Architecture
* Cloudinary Image Handling

### B. MVP-Only Systems
* **Chat & Notifications:** Uses MVP HTTP polling at 10–15s intervals instead of WebSockets.
* **Email Verification:** Implemented with local-development fallback.
* **Courier Dispatch:** Manual acceptance in admin panel instead of automated 3PL dispatch.
* **Moderation:** Simple regex profanity filters instead of AI safety tools.

## 8. Known Risks & Technical Debt
* **Polling limitations:** MVP HTTP polling at 10–15s intervals for notifications/chat will strain the database and network significantly as the userbase grows.
* **Missing websocket realtime:** Can cause slight race conditions or delays in fast-paced chat.
* **Trust score values needing verification:** The arbitrary values (+10, -20) need balancing in a staging environment so the economy cannot be exploited.
* **Possible API spam risks:** Missing robust rate limiting allows potential endpoint abuse.
* **Image abuse risks:** Lack of automated image moderation means explicit content relies entirely on user reporting.
* **Cloudinary scaling considerations:** Unoptimized image uploads could exceed free tier limits quickly.
* **Admin seeded account warning:** The `seed_admin.py` script now requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables to prevent accidental hardcoded credentials in production.
* **Missing automated tests:** High reliance on manual UI testing; unit/integration tests are lacking.
* **Incomplete courier implementation:** Core architecture exists, but relies entirely on trusted internal admins/couriers.
* **Hardcoded/local-only values:** Missing secure production `ENCRYPTION_KEY` if not set in env.

## 9. Current Roles & Permissions
* **user:** Normal platform user. Can list items, request items, chat, and review. CANNOT access any `/api/admin` routes.
* **courier:** Logistics partner. Can log into the Admin Panel specifically to access the Courier Dashboard. Can decrypt delivery addresses and update delivery statuses. Cannot access user moderation.
* **moderator:** Community manager. Can access Admin Panel to resolve reports, hide listings, and warn users.
* **admin:** Full system manager. Can access all Admin Panel features, including manual trust score penalties and courier oversight.
* **super_admin:** Highest level. Can access everything, assign roles, and view system analytics.

## 10. Local Development URLs
* **Public Frontend URL:** `http://localhost:5174` (or standard Vite port)
* **Admin Panel URL:** `http://localhost:5200`
* **Backend URL:** `http://localhost:8000`

## 11. Important Environment Variables
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
DB_NAME=happiness_exchange

# JWT / Auth
SECRET_KEY=your_super_secret_jwt_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# URLs
VITE_API_BASE_URL=http://localhost:8000
VITE_ADMIN_URL=http://localhost:5200

# Encryption
ENCRYPTION_KEY=fernet_base64_encoded_key_placeholder

# Media
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Email (Resend — backend only, never expose in frontend)
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Happiness Exchange <verify@happyexchange.net>
APP_BASE_URL=https://happyexchange.net
```

## 12. Recent Backend Routes Added
### Auth
* `POST /api/auth/signup`, `POST /api/auth/login`
* `GET /api/auth/verify-email?token=...` — verify email (24h token expiry, SHA-256 hashed in DB)
* `POST /api/auth/resend-verification` — resend verification email (requires auth)

### Admin
* `GET /api/admin/users`, `POST /api/admin/users/{user_id}/trust-penalty`

### Notifications
* `GET /api/notifications`, `PATCH /api/notifications/{id}/read`

### Conversations
* `GET /api/conversations/my`, `POST /api/conversations/{id}/messages`

### Reviews
* `POST /api/reviews`

### Leaderboard
* `GET /api/leaderboard`

### Moderation
* `PATCH /api/admin/reports/{id}/resolve`

### Deliveries
* `POST /api/deliveries` (Giver Address)
* `POST /api/deliveries/{id}/dropoff` (Receiver Address)
* `GET /api/admin/deliveries` (Courier Decrypted Dashboard)
* `PATCH /api/admin/deliveries/{id}/status`
* `PATCH /api/admin/deliveries/{id}/proof`

### Reputation/Trust
* `GET /api/me/reputation`

## 13. Important Manual Testing Flows
- [ ] **Signup/Login:** Register two users, verify JWT storage and redirection.
- [ ] **Email Verification:** Sign up → check terminal (local) or inbox (production) → click link → banner disappears; unverified users can browse but cannot list/request/chat/review.
- [ ] **Cross-account listing visibility:** User B should see User A's items, but User A should not see their own items in the feed.
- [ ] **Request flow:** User B requests -> User A approves -> Item status updates.
- [ ] **Chat unlock flow:** Verify chat is blocked until request is `approved`.
- [ ] **Notification flow:** Wait 15 seconds to ensure polling picks up unread badges.
- [ ] **Review flow:** Complete an item, leave 5 stars, verify User A's trust score increases.
- [ ] **Trust score updates:** Trigger a confirmed report and verify score drops.
- [ ] **Admin moderation:** Log in as admin, ban a user, verify they cannot log in.
- [ ] **Blocking/reporting:** User A blocks User B; verify messages fail to send.
- [ ] **Courier workflow:** Giver adds address -> Receiver adds address -> Courier marks `Delivered` -> Privacy maintained.
- [ ] **Mobile responsiveness:** Test Chat UI and Admin Tables on a narrow viewport.

## 14. Deployment Notes
* **Vercel setup:** The public frontend is optimized for Vercel deployment (`vite build`).
* **Backend hosting:** The FastAPI app requires a Python environment (Render, Railway, or AWS ECS). 
* **Domain/subdomain structure:** Recommended: `happyexchange.net` (Public), `admin.happyexchange.net` (Admin Panel), `api.happyexchange.net` (Backend).
* **Admin panel deployment approach:** Deploy as a separate Vercel project with strict IP/Auth restrictions.
* **Current production limitations:** Must migrate away from local disk storage (ensure Cloudinary is fully enforced) and replace mocked services.

## 15. Future Scaling Roadmap
* **WebSockets:** Replace MVP HTTP polling with Redis-backed WebSockets for true real-time chat and notifications.
* **AI moderation:** Integrate LLM APIs to automatically flag explicit images or abusive chat.
* **Live courier integrations:** Connect the `ready_for_courier` webhook to 3PL APIs (Aramex, Fetchr).
* **Mobile app conversion:** Wrap the PWA in React Native or Capacitor for iOS/Android stores.
* **Advanced analytics:** Track retention, average exchange times, and geographic density.
* **Recommendation engine:** Suggest items based on user history and location.
* **Real-time delivery tracking:** GPS live-tracking for couriers `in_transit`.
* **Production monitoring:** Integrate Sentry, Datadog, or New Relic.

## 16. Important Warnings
* **Cross-account authorization flows require full regression testing before production.**
* **Brevo/SMTP removed:** Email verification now uses Resend. Without `RESEND_API_KEY`, links print to the backend terminal only.
* **Trust score values may still need balancing:** Gamification exploits are possible until staging tests are completed.
* **Seeded admin account must be removed before production:** Hardcoded admin credentials pose a severe security risk.
* **Some systems are manually verified only:** Without automated E2E tests, UI updates risk breaking complex state flows like the Courier Address handoff.
