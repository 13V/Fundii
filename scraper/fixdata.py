"""
Data quality fix script for GrantMate grants table.

Fixes two issues:
1. Bad descriptions — footer/navigation text scraped instead of real descriptions
2. Overly broad industry tags — grants listing 8+ industries when they're specific

Run: python fixdata.py
"""
import os, sys, json, requests, time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ─── Known footer/garbage phrases that indicate bad descriptions ───────────────
GARBAGE_PHRASES = [
    "migration.sa.gov.au",
    "Providing pathways to living, working or establishing in South Australia",
    "Celebrating the importance of science, research and innovation",
    "Skip to main content",
    "Skip to navigation",
    "Menu Close",
    "Sign in",
    "Search this site",
    "You are here:",
    "Breadcrumb",
    "Back to top",
    "© Copyright",
    "All rights reserved",
    "Privacy policy",
    "Terms and conditions",
    "Facebook Twitter LinkedIn",
    "Share this page",
    "Was this page helpful",
    "Last updated",
    "Print this page",
    "Subscribe to our newsletter",
    "Follow us on",
    "Contact us",
    # NSW footer patterns
    "Service NSW",
    "nsw.gov.au/accessibility",
    # VIC footer patterns
    "vic.gov.au/accessibility",
    # QLD footer patterns
    "qld.gov.au/help",
    # Generic nav
    "Home About Programs Grants",
    "Home > Grants",
    "JavaScript is required",
    "Please enable JavaScript",
]

# ─── Industry normalisation map ────────────────────────────────────────────────
# If a grant's title contains these keywords, override to focused industry list
TITLE_INDUSTRY_MAP = [
    (["film", "screen", "cinema", "documentary", "television", "tv production"], ["Creative Industries", "Arts & Culture"]),
    (["music", "album", "recording", "concert", "festival"], ["Creative Industries", "Arts & Culture"]),
    (["arts", "art", "creative", "culture", "cultural", "heritage"], ["Creative Industries", "Arts & Culture"]),
    (["sport", "athlete", "athletics", "sporting", "cricket", "football", "swim"], ["Sport & Recreation"]),
    (["tech", "technology", "software", "digital", "cyber", "ai ", "artificial intelligence", "startup", "start-up"], ["Technology", "Innovation"]),
    (["research", "r&d", "innovation", "csiro", "arc ", "linkage", "crc"], ["Research & Development", "Innovation"]),
    (["farm", "agri", "agriculture", "crop", "livestock", "horticulture", "viticulture", "wine", "grain", "beef", "wool", "dairy"], ["Agriculture", "Food & Beverage"]),
    (["export", "trade", "international market", "austrade"], ["Export & Trade"]),
    (["energy", "solar", "renewable", "clean energy", "battery", "wind power", "electric vehicle"], ["Energy & Environment", "Clean Technology"]),
    (["environment", "climate", "sustainability", "carbon", "emissions", "biodiversity", "water"], ["Environment & Sustainability"]),
    (["health", "medical", "hospital", "aged care", "disability", "mental health", "mrff"], ["Health & Medical"]),
    (["education", "training", "apprenticeship", "vocational", "tafe", "scholarship"], ["Education & Training"]),
    (["tourism", "hospitality", "hotel", "accommodation", "visitor"], ["Tourism & Hospitality"]),
    (["construction", "building", "infrastructure", "housing"], ["Construction & Infrastructure"]),
    (["manufacturing", "industry 4.0", "advanced manufacturing"], ["Manufacturing"]),
    (["defence", "defense", "military", "sovereign capability"], ["Defence"]),
    (["small business", "sme", "entrepreneur", "startup grant", "business growth"], ["Small Business"]),
    (["council", "local government", "community infrastructure", "playground", "park"], ["Community & Social Services"]),
    (["women", "diversity", "inclusion", "indigenous", "aboriginal", "first nation"], ["Social Equity"]),
    (["food", "beverage", "restaurant", "cafe", "hospitality food"], ["Food & Beverage"]),
    (["regional", "rural", "remote", "outback"], ["Regional Development"]),
]

MAX_INDUSTRIES = 4  # cap — if more than this, narrow down


def fetch_all_grants():
    """Paginate through entire grants table and return all records."""
    all_grants = []
    page_size = 1000
    offset = 0

    print("Fetching all grants from Supabase...")
    while True:
        url = f"{SUPABASE_URL}/rest/v1/grants?select=id,title,description,industries,source&limit={page_size}&offset={offset}"
        r = requests.get(url, headers={**HEADERS, "Prefer": "count=exact"}, timeout=30)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        all_grants.extend(batch)
        print(f"  Fetched {len(all_grants)} grants...")
        if len(batch) < page_size:
            break
        offset += page_size
        time.sleep(0.3)

    print(f"Total grants fetched: {len(all_grants)}")
    return all_grants


def is_garbage_description(desc: str) -> bool:
    if not desc or len(desc.strip()) < 20:
        return True
    desc_lower = desc.lower()
    for phrase in GARBAGE_PHRASES:
        if phrase.lower() in desc_lower:
            return True
    return False


def is_title_only(title: str, desc: str) -> bool:
    """True if description is effectively the same as the title."""
    if not desc:
        return True
    t = title.strip().lower()
    d = desc.strip().lower()
    # Description is title or very close variant
    if d == t or d.startswith(t) and len(d) < len(t) + 10:
        return True
    # Description is extremely short (less than 30 chars)
    if len(d) < 30:
        return True
    return False


def infer_industries_from_title(title: str, current: list) -> list | None:
    """
    Return a narrowed industry list based on title keywords.
    Returns None if current list looks fine.
    """
    if len(current) <= MAX_INDUSTRIES:
        return None  # already focused enough

    title_lower = title.lower()
    for keywords, industries in TITLE_INDUSTRY_MAP:
        for kw in keywords:
            if kw in title_lower:
                return industries

    # No match found — cap at MAX_INDUSTRIES using first N (safest)
    return current[:MAX_INDUSTRIES]


def patch_grant(grant_id: str, updates: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/grants?id=eq.{grant_id}"
    r = requests.patch(url, headers=HEADERS, json=updates, timeout=15)
    return r.status_code in (200, 204)


def main():
    grants = fetch_all_grants()

    bad_desc_ids = []
    broad_industry_ids = []
    updates = {}  # grant_id → {field: value}

    print("\nAuditing grants...")
    for g in grants:
        gid = g["id"]
        title = g.get("title", "")
        desc = g.get("description", "")
        industries = g.get("industries") or []
        source = g.get("source", "")

        changes = {}

        # Check description quality
        if is_garbage_description(desc):
            bad_desc_ids.append(gid)
            changes["description"] = ""  # clear garbage — better than showing footer text
        elif is_title_only(title, desc):
            # These are title-only descriptions — leave as-is (would need re-scraping to fix properly)
            pass

        # Check industry bloat
        if len(industries) > MAX_INDUSTRIES:
            broad_industry_ids.append(gid)
            narrowed = infer_industries_from_title(title, industries)
            if narrowed and narrowed != industries:
                changes["industries"] = narrowed

        if changes:
            updates[gid] = changes

    print(f"\n--- Audit Results ---")
    print(f"Total grants:              {len(grants)}")
    print(f"Bad descriptions (garbage): {len(bad_desc_ids)}")
    print(f"Broad industry tags (8+):   {len(broad_industry_ids)}")
    print(f"Total grants to update:     {len(updates)}")

    if bad_desc_ids[:5]:
        print(f"\nSample bad desc IDs: {bad_desc_ids[:5]}")
    if broad_industry_ids[:5]:
        print(f"Sample broad industry IDs: {broad_industry_ids[:5]}")

    if not updates:
        print("\nNo fixes needed — data looks clean!")
        return

    # Show sample of what we're fixing
    sample_keys = list(updates.keys())[:3]
    print("\nSample fixes:")
    for sid in sample_keys:
        g = next(x for x in grants if x["id"] == sid)
        print(f"  [{sid}] '{g['title'][:60]}'")
        for field, val in updates[sid].items():
            old = g.get(field, "")
            if isinstance(old, list):
                print(f"    {field}: {old} → {val}")
            else:
                old_preview = str(old)[:80].replace("\n", " ")
                new_preview = str(val)[:80].replace("\n", " ")
                print(f"    {field}: '{old_preview}' → '{new_preview}'")

    if "--apply" not in sys.argv:
        print(f"\nRun with --apply to apply {len(updates)} fixes.")
        return
    print(f"\nApplying {len(updates)} fixes...")

    print("Applying fixes...")
    ok = 0
    fail = 0
    for gid, changes in updates.items():
        if patch_grant(gid, changes):
            ok += 1
        else:
            fail += 1
        if (ok + fail) % 100 == 0:
            print(f"  {ok + fail}/{len(updates)} processed...")
        time.sleep(0.05)  # be gentle on rate limits

    print(f"\nDone — {ok} fixed, {fail} failed")


if __name__ == "__main__":
    main()
