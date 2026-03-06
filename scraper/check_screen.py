import os, sys, requests, json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

# Fetch all screen_au_ grants
url = f"{SUPABASE_URL}/rest/v1/grants?select=id,title,description,source_url&id=like.screen_au_*&limit=200"
r = requests.get(url, headers=HEADERS, timeout=15)
data = r.json()
print(f"Total screen_au grants: {len(data)}\n")
for g in data:
    print(f"  [{g['id']}]")
    print(f"    title: {g['title']}")
    print(f"    url:   {g['source_url']}")
    desc = (g.get('description') or '').strip()
    print(f"    desc:  {desc[:100] if desc else '(empty)'}")
    print()
