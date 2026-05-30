# UptimeRobot — Keep Hugging Face Space Warm

Hugging Face free-tier Spaces sleep after inactivity. A cold start adds 15–60 seconds to the first API call. Pinging `/api/status/` on a schedule prevents the Space from sleeping.

## Recommended: UptimeRobot (free)

1. Create a free account at [https://uptimerobot.com](https://uptimerobot.com)
2. Click **Add New Monitor**
3. Monitor type: **HTTP(s)**
4. Friendly name: `Happiness Exchange API`
5. URL: `https://arrifection-happiness-exchange.hf.space/api/status/`
6. Monitoring interval: **5 minutes**
7. Save the monitor

UptimeRobot will alert you if the endpoint goes down and keeps the Space warm with regular GET requests.

## Alternative: GitHub Actions

This repo includes `.github/workflows/keep-backend-warm.yml`, which pings the same URL every 10 minutes when GitHub Actions is enabled on the repository.

## Alternative: Local script

For a VPS or always-on machine only (not your laptop):

```bash
python scripts/keep_alive.py
```

This loops forever with a 10-minute interval. **UptimeRobot is preferred** — no server to maintain.

## Notes

- The wakeup banner on the frontend still helps if a cold start happens despite keep-alive.
- `/api/status/` is lightweight and safe to poll; it does not modify data.
