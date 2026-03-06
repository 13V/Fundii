"""
Regenerate Screen Australia grants with accurate data and push to Supabase.
Deletes all existing screen_au_* records, then pushes the corrected set.
"""
import os, sys, json, requests

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Import the scraper function
sys.path.insert(0, os.path.dirname(__file__))
from agencyscrapers import scrape_screen_australia

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# Generate the grants
print("Generating Screen Australia grants from updated scraper...")
grants = scrape_screen_australia()
print(f"  Generated {len(grants)} grants")
for g in grants:
    print(f"  - {g['title'][:80]}")

# Push to Supabase (upsert — merge-duplicates handles existing IDs)
print(f"\nPushing {len(grants)} grants to Supabase...")
r = requests.post(
    f"{SUPABASE_URL}/rest/v1/grants",
    headers=HEADERS,
    json=grants,
    timeout=30,
)
if r.status_code in (200, 201):
    print(f"Success — {len(grants)} Screen Australia grants upserted.")
else:
    print(f"Error {r.status_code}: {r.text[:500]}")
    # Try one by one
    ok = 0
    for g in grants:
        r2 = requests.post(f"{SUPABASE_URL}/rest/v1/grants", headers=HEADERS, json=[g], timeout=15)
        if r2.status_code in (200, 201):
            ok += 1
        else:
            print(f"  FAILED: {g['title']} — {r2.status_code}: {r2.text[:200]}")
    print(f"  {ok}/{len(grants)} pushed individually")
