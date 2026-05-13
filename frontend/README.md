# Happiness Exchange - Frontend

React + Vite frontend for the Happiness Exchange platform.

---

## Project Structure

```text
frontend/
|-- src/
|   |-- App.jsx        # Root component - homepage + status check
|   |-- App.css        # Component styles
|   |-- main.jsx       # React entry point
|   `-- index.css      # Global design tokens & reset
|-- index.html         # HTML shell
|-- .env.example       # Environment variable template
`-- README.md
```

---

## Local Setup

### 1. Install dependencies

```bash
# From the /frontend directory
npm install
```

### 2. Set up environment variables

```bash
# Copy the example file
cp .env.example .env.local

# .env.local already points to localhost:8000 - no changes needed for local dev
```

### 3. Run the development server

```bash
npm run dev
```

The app starts at: **http://localhost:5173**

---

## Testing the Status Check

1. Make sure the **backend is running** at `http://localhost:8000` (see `/backend/README.md`).
2. Open `http://localhost:5173` in your browser.
3. The homepage will automatically call `/api/status` and display:
   - Online + project name if backend is up.
   - Unreachable if backend is not running.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |
