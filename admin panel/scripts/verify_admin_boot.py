"""Quick admin panel boot/network smoke check."""
import re
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://admin-panel-happy-exchange.vercel.app").rstrip("/")
ROUTES = ["/login", "/dashboard", "/team", "/messages", "/accept-invite"]


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as res:
        return res.status, res.read()


print(f"Admin panel check: {BASE}\n")
status, html_bytes = fetch(f"{BASE}/login")
print(f"GET /login -> {status}")
html = html_bytes.decode("utf-8", "ignore")
match = re.search(r"/assets/index-[^\"']+\.js", html)
if not match:
    raise SystemExit("FAIL: login HTML missing JS bundle")
asset = match.group(0)
status, _ = fetch(f"{BASE}{asset}")
print(f"GET {asset} -> {status}")
for route in ROUTES:
    status, _ = fetch(f"{BASE}{route}")
    print(f"GET {route} -> {status}")
print("\nNetwork checks passed.")
