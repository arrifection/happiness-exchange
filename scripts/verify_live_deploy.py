"""Poll live /api/status/ until git commit or api_build matches expectations."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

DEFAULT_URL = "https://arrifection-happiness-exchange.hf.space/api/status/"


def fetch_status(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify live backend deploy metadata.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--commit", help="Expected full or short git commit hash")
    parser.add_argument("--api-build", help="Expected api_build string")
    parser.add_argument("--timeout", type=int, default=900, help="Max seconds to wait")
    parser.add_argument("--interval", type=int, default=15, help="Poll interval seconds")
    args = parser.parse_args()

    deadline = time.time() + args.timeout
    last: dict | None = None
    while time.time() < deadline:
        try:
            last = fetch_status(args.url)
            print(json.dumps(last, indent=2))
            commit_ok = True
            build_ok = True
            if args.commit:
                live = str(last.get("git_commit") or "")
                short = str(last.get("git_commit_short") or "")
                commit_ok = live.startswith(args.commit) or short.startswith(args.commit)
            if args.api_build:
                build_ok = last.get("api_build") == args.api_build
            if commit_ok and build_ok:
                print("Deploy verification passed.")
                return 0
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            print(f"Poll failed: {exc}")
        time.sleep(args.interval)

    print("Deploy verification timed out.", file=sys.stderr)
    if last:
        print(json.dumps(last, indent=2), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
