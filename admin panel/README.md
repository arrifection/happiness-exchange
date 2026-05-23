# Happiness Exchange — Admin Panel

A standalone React + Vite admin dashboard for the Happiness Exchange platform.

---

## Tech Stack

| Layer     | Technology               |
|-----------|--------------------------|
| Framework | React 18 + Vite 5        |
| Styling   | TailwindCSS 3 (dark UI)  |
| Routing   | React Router v6          |
| HTTP      | Axios                    |
| Icons     | Lucide React             |

---

## Quick Start

```bash
# From this directory: c:\happiness exchange\admin panel

npm install
npm run dev
```

The admin panel runs at: **http://localhost:5200**

The backend API must be running at: **http://localhost:8000**

---

## Admin Account Model

- The admin panel has **no public signup**. Only accounts created by a **super_admin** or via the team‑invite API can log in.
- Normal public users **cannot** log in to the admin panel.
- The admin panel uses the **same backend and MongoDB** as the public app, so all real app data appears automatically.

### Local Test Admin

1. Create a test super admin locally by setting environment variables and running the seed script:
   ```bash
   ADMIN_EMAIL=admin@localhost.com ADMIN_PASSWORD=StrongPass! npm run dev
   # Or use the existing seed script:
   ADMIN_EMAIL=admin@localhost.com ADMIN_PASSWORD=StrongPass! python scripts/seed_admin.py
   ```
2. To remove the test admin later:
   ```bash
   ADMIN_EMAIL=admin@localhost.com python scripts/seed_admin.py --remove
   ```
> **⚠️ Warning:** Never use weak or default passwords in production. Always provide strong, unique credentials via environment variables.

---

## Login Page Note

The admin login page now displays a small notice:

> **Admin access only. Accounts are created by the Happiness Exchange team.**

---

## Folder Structure

```
admin panel/
├── public/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ProtectedRoute.jsx   # Role-based route guard
│   │   ├── Sidebar.jsx          # Collapsible sidebar nav
│   │   ├── TopBar.jsx           # Header with status + search
│   │   ├── StatCard.jsx         # KPI metric cards
│   │   └── States.jsx           # Loading/Error/Empty states
│   ├── contexts/
│   │   └── AuthContext.jsx      # Auth state + RBAC hooks
│   ├── layouts/
│   │   └── AdminLayout.jsx      # Shell layout (sidebar + topbar + outlet)
│   ├── lib/
│   │   └── api.js               # Axios client + all endpoint helpers
│   ├── pages/
│   │   ├── Login.jsx            # Admin login
│   │   ├── Dashboard.jsx        # Home overview with live KPIs
│   │   ├── Listings.jsx         # Item listings management
│   │   ├── Users.jsx            # User management + ban
│   │   ├── Requests.jsx         # Exchange requests view
│   │   ├── Reports.jsx          # Reports & flags moderation
│   │   ├── Reviews.jsx          # Reviews management
│   │   ├── Team.jsx             # Admin team members
│   │   ├── Courier.jsx          # Courier coordination
│   │   └── Analytics.jsx        # Platform analytics
│   ├── App.jsx                  # Router + route tree
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles + Tailwind
├── .env                         # API base URL config
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js               # Dev proxy → :8000
```

---

## How it Connects to the Backend

- **Vite dev proxy** (`vite.config.js`) forwards `/api/*` → `http://localhost:8000`
- **`src/lib/api.js`** exports typed Axios helpers for every backend route:
  - `/api/auth/login` — admin login
  - `/api/auth/me`    — token verification on load
  - `/api/users`      — user management
  - `/api/items`      — listings management
  - `/api/requests`   — exchange requests
  - `/api/reviews`    — reviews
  - `/api/conversations` — conversations
  - `/api/status`     — live API health check (shown in TopBar)

JWT is stored in `localStorage` under `admin_token`.

---

## Role-Based Access

| Role          | Level | Access                                      |
|---------------|-------|---------------------------------------------|
| `super_admin` | 4     | Full access including Team management        |
| `admin`       | 3     | All pages except super_admin-only actions    |
| `moderator`   | 2     | Reports, Reviews, Listings, Requests, Users  |
| `courier`     | 1     | Courier coordination only                    |

`ProtectedRoute` component enforces access. Login is blocked for users without an admin role.

---

## Environment Variables

| Variable           | Default                  | Description                |
|--------------------|--------------------------|----------------------------|
| `VITE_API_BASE_URL` | `http://localhost:8000`  | FastAPI backend base URL   |
| `VITE_APP_NAME`     | `Happiness Exchange Admin` | App display name          |
