# Happiness Exchange - Backend

FastAPI backend for the Happiness Exchange platform.

---

## Project Structure

```text
backend/
|-- app/
|   |-- main.py              # FastAPI app entry point
|   |-- core/
|   |   `-- config.py        # Environment-based config (Pydantic Settings)
|   |-- db/
|   |   `-- mongodb.py       # MongoDB async connection (Motor)
|   `-- api/
|       `-- routes/
|           `-- health.py    # GET /api/status endpoint
|-- requirements.txt         # Python dependencies
|-- .env.example             # Environment variable template
`-- README.md
```

---

## Local Setup

### 1. Create and activate a virtual environment

```bash
# From the /backend directory
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set up environment variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your MongoDB URI
# For local MongoDB:  MONGODB_URI=mongodb://localhost:27017
# For Atlas:          MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/
```

### 4. Run the development server

```bash
uvicorn app.main:app --reload --port 8000
```

The server starts at: **http://localhost:8000**

---

## Testing the /api/status Endpoint

### Option A - Browser
Open: [http://localhost:8000/api/status](http://localhost:8000/api/status)

### Option B - curl

```bash
curl http://localhost:8000/api/status
```

### Option C - Swagger UI (auto-generated docs)
Open: [http://localhost:8000/docs](http://localhost:8000/docs)

Expected response:

```json
{
  "status": "online",
  "project": "Happiness Exchange"
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `happiness_exchange` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:5173` |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `DEV_BYPASS_EMAIL_VERIFICATION` | Local-only verification shortcut | `false` |
| `SMTP_HOST` | Local Mailpit SMTP host | empty |

Local Mailpit inbox, dummy users, and the verification bypass are documented in [docs/LOCAL_EMAIL.md](../docs/LOCAL_EMAIL.md).

