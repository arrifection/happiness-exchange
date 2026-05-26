# ── Happiness Exchange – Hugging Face Spaces Dockerfile ──────────────────────
# This file MUST live at the repo root (not in backend/).
# HF Spaces uses port 7860. The app entry point is api/index.py::app.
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Prevents .pyc files and enables real-time stdout logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /code

# Install Python dependencies first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project
COPY . .

# Git is required to record commit hash for /api/status/ (HF Spaces omits .git hooks without it)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && python scripts/generate_build_info.py \
    && apt-get purge -y git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces requires port 7860
EXPOSE 7860

# Entry point: api/index.py exports `app`
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
