"""Runtime build metadata for /api/status/ deploy verification."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_GENERATED_FILE = Path(__file__).resolve().parent / "_generated_build_info.json"


def _read_git_commit() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=3,
            cwd=_REPO_ROOT,
            check=False,
        )
        if result.returncode == 0:
            commit = result.stdout.strip()
            return commit or None
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def _read_git_commit_short() -> str | None:
    commit = _read_git_commit()
    return commit[:12] if commit else None


@lru_cache(maxsize=1)
def get_build_metadata() -> dict[str, str | None]:
    """Return git commit, build time, and environment for status checks."""
    generated: dict[str, str] = {}
    if _GENERATED_FILE.is_file():
        try:
            generated = json.loads(_GENERATED_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            generated = {}

    git_commit = (
        os.environ.get("GIT_COMMIT")
        or os.environ.get("HF_HUB_COMMIT_SHA")
        or generated.get("git_commit")
        or _read_git_commit()
        or "unknown"
    )
    git_commit_short = (
        os.environ.get("GIT_COMMIT_SHORT")
        or generated.get("git_commit_short")
        or (git_commit[:12] if git_commit != "unknown" else "unknown")
    )
    built_at = (
        os.environ.get("BUILD_TIME")
        or os.environ.get("SPACE_DEPLOY_TIME")
        or generated.get("built_at")
        or datetime.now(timezone.utc).isoformat()
    )
    environment = (
        os.environ.get("APP_ENV")
        or os.environ.get("SPACE_ID")
        or generated.get("environment")
        or "production"
    )
    return {
        "git_commit": git_commit,
        "git_commit_short": git_commit_short,
        "built_at": built_at,
        "environment": environment,
    }
