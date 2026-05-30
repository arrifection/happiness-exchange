# Run once manually after deployment. Safe to re-run (idempotent).
"""Legacy entrypoint — delegates to scripts/backfill_completed_donation_trust.py."""

from __future__ import annotations

import runpy
from pathlib import Path

if __name__ == "__main__":
    target = Path(__file__).with_name("backfill_completed_donation_trust.py")
    runpy.run_path(str(target), run_name="__main__")
