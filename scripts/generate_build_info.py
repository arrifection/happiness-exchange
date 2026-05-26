"""Write app/core/_generated_build_info.json for Docker/HF deploy verification."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app" / "core" / "_generated_build_info.json"


def main() -> int:
    commit = os.environ.get("GIT_COMMIT")
    if not commit:
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                timeout=5,
                cwd=ROOT,
                check=False,
            )
            if result.returncode == 0:
                commit = result.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            commit = None

    payload = {
        "git_commit": commit or "unknown",
        "git_commit_short": (commit or "unknown")[:12],
        "built_at": os.environ.get("BUILD_TIME") or datetime.now(timezone.utc).isoformat(),
        "environment": os.environ.get("APP_ENV") or "production",
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
