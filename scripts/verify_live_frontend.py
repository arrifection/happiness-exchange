"""Check the live frontend bundle no longer ships listing-expiry UI copy.

NOTE: This script contacts production. Do not run it during local-only work.
"""
import re
import urllib.request

html = urllib.request.urlopen("https://www.happyexchange.net/", timeout=30).read().decode("utf-8", "replace")
match = re.search(r"/assets/main-[^\"']+\.js", html)
print("bundle", match.group(0) if match else "none")
if match:
    js_url = "https://www.happyexchange.net" + match.group(0)
    js = urllib.request.urlopen(js_url, timeout=60).read().decode("utf-8", "replace")
    # Expiry UI should be gone from the bundle after deploy.
    for needle in ["Renew for 14 days", "Expires in"]:
        print("absent", needle, needle not in js)
    for needle in ["happiness_exchange_theme", "isListingExpired"]:
        print("present", needle, needle in js)
