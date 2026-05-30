# keep_alive.py — Run this on any always-on server or use UptimeRobot
# Pings /api/status/ every 10 minutes to prevent HF Space cold starts
import time
import urllib.request

URL = "https://arrifection-happiness-exchange.hf.space/api/status/"
INTERVAL = 600  # 10 minutes

while True:
    try:
        with urllib.request.urlopen(URL, timeout=15) as r:
            print(f"[OK] {r.status} — {time.strftime('%H:%M:%S')}")
    except Exception as e:
        print(f"[FAIL] {e} — {time.strftime('%H:%M:%S')}")
    time.sleep(INTERVAL)
