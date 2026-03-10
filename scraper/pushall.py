"""
Push all scraped grant JSON files to Supabase.
Reads existing *_data.json files and upserts them in batches.
"""
import os, sys, json, requests, glob, re

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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
ENDPOINT = f"{SUPABASE_URL}/rest/v1/grants"
BATCH = 50

VALID_STATUSES = {"open", "closed", "ongoing", "upcoming", "unknown"}
VALID_TYPES    = {"grant", "loan", "rebate", "tax_incentive", "voucher", "subsidy", "scholarship"}
MAX_INT        = 2_000_000_000

# ── Junk-record filter ──────────────────────────────────────────────────────────
# Titles that are clearly nav items, HR pages, or policy docs — not grants
_JUNK_TITLE_RE = re.compile(
    r"^(skip to (main )?content"
    r"|find out more about\b"
    r"|programs?,?\s+services?\s+and\s+policies?"
    r"|entry[ -]level programs?"
    r"|graduate programs?"
    r"|program policies\b"
    r"|client service charter"
    r"|gender equality"
    r"|agency grants?:\s*(minchin|pratt)\s+motion"
    r"|about (us|arc|austrade|the program)"
    r"|careers?\s+at\s+"
    r"|contact us"
    r"|home$"
    r"|news(room)?$"
    r"|publications?$"
    r"|resources?$"
    r"|support$"
    r"|\bfaq(s)?\b"
    r"|tools and insights\b"
    r"|current grant opportunity view\b"
    r"|funding approvals?\s*\d"
    r"|in the archive\b"
    r"|document library\b"
    r"|partner countries?\b"
    r"|sales agents? and distributors?\b"
    r"|narrative content market\b"
    r"|special initiatives?\s*$"
    r"|international initiatives?\s*$"
    r"|sales and distribution support\s*$"
    r"|industry development funding deadlines?\s*$"
    r")",
    re.IGNORECASE,
)

# URL path patterns that indicate non-grant pages
_JUNK_URL_RE = re.compile(
    r"/(careers?|jobs|about|contact|news|media|publications?|policies?|governance|"
    r"annual[-_]report|strategic[-_]plan|gender|privacy|sitemap|accessibility|disclaimer)(/|$)",
    re.IGNORECASE,
)

MIN_TITLE_LEN = 12      # "Grant" alone isn't useful
MAX_TITLE_LEN = 200     # titles longer than this are likely garbled (heading + body text)
MIN_DESC_LEN  = 20      # description must say something meaningful


def is_valid_grant(g: dict) -> bool:
    title = (g.get("title") or "").strip()
    desc  = (g.get("description") or "").strip()
    url   = (g.get("url") or g.get("source_url") or "").strip()

    if len(title) < MIN_TITLE_LEN:
        return False
    if len(title) > MAX_TITLE_LEN:
        return False
    if _JUNK_TITLE_RE.match(title):
        return False
    if url and _JUNK_URL_RE.search(url):
        return False
    # Require at least a minimal description (allows grants with short descs through)
    if len(desc) < MIN_DESC_LEN:
        return False
    # Reject records where description is clearly scraped navigation text
    if desc.lower().startswith(("skip to content", "skip to main content", "search input", "navigation")):
        return False
    return True

def coerce(g: dict) -> dict:
    """Ensure fields match the Supabase schema."""
    def arr(v):
        if isinstance(v, list):  return v or ["General"]
        if isinstance(v, str):   return [x.strip() for x in v.split(",") if x.strip()] or ["General"]
        return ["General"]

    def cap(v, n):
        return (v or "")[:n]

    def safe_int(v):
        if v is None: return None
        try:
            i = int(v)
            return min(i, MAX_INT)
        except Exception:
            return None

    return {
        "id":             cap(g.get("id", ""), 100),
        "title":          cap(g.get("title", ""), 500),
        "source":         cap(g.get("source", ""), 200),
        "source_url":     cap(g.get("source_url") or g.get("url", ""), 1000),
        "url":            cap(g.get("url") or g.get("source_url", ""), 1000),
        "amount_min":     safe_int(g.get("amount_min")),
        "amount_max":     safe_int(g.get("amount_max")),
        "amount_text":    cap(g.get("amount_text", ""), 500),
        "states":         arr(g.get("states", ["National"])),
        "industries":     arr(g.get("industries", ["General"])),
        "business_sizes": arr(g.get("business_sizes") or g.get("businessSizes", ["All"])),
        "status":         g.get("status", "open") if g.get("status") in VALID_STATUSES else "open",
        "close_date":     cap(g.get("close_date") or g.get("closeDate", ""), 100) or None,
        "description":    cap(g.get("description", ""), 2000),
        "eligibility":    cap(g.get("eligibility") or g.get("eligibility_summary", ""), 1500),
        "grant_type":     g.get("grant_type", "grant") if g.get("grant_type") in VALID_TYPES else "grant",
        "category":       cap(g.get("category", "federal"), 100),
    }

def push_one(grant: dict) -> bool:
    try:
        r = requests.post(ENDPOINT, headers=HEADERS, json=[grant], timeout=15)
        r.raise_for_status()
        return True
    except Exception:
        return False


def push_batch(grants):
    pushed = 0
    skipped = 0
    filtered = 0
    for i in range(0, len(grants), BATCH):
        raw_batch = grants[i:i+BATCH]
        valid = [g for g in raw_batch if is_valid_grant(g)]
        filtered += len(raw_batch) - len(valid)
        batch = [coerce(g) for g in valid]
        batch = [g for g in batch if g["id"] and g["title"]]
        if not batch:
            continue
        try:
            r = requests.post(ENDPOINT, headers=HEADERS, json=batch, timeout=30)
            r.raise_for_status()
            pushed += len(batch)
        except Exception:
            # Fall back: push one at a time to skip bad records
            for g in batch:
                if push_one(g):
                    pushed += 1
                else:
                    skipped += 1
    if filtered:
        print(f"  Filtered {filtered} junk/empty records")
    if skipped:
        print(f"  Skipped {skipped} records with schema errors")
    return pushed

def main():
    # Find all JSON data files in this directory
    files = sorted(glob.glob("*_data.json"))
    if not files:
        print("No *_data.json files found. Run scrapers first.")
        sys.exit(1)

    print(f"\nFound {len(files)} data files:")
    for f in files:
        print(f"  {f}")

    total_loaded = 0
    total_pushed = 0

    for fname in files:
        print(f"\nLoading {fname}...")
        try:
            with open(fname, encoding="utf-8") as f:
                grants = json.load(f)
        except Exception as e:
            print(f"  ERROR reading {fname}: {e}")
            continue

        print(f"  {len(grants)} grants — pushing to Supabase...")
        pushed = push_batch(grants)
        print(f"  Pushed {pushed}/{len(grants)}")
        total_loaded += len(grants)
        total_pushed += pushed

    print(f"\n{'='*50}")
    print(f"DONE — pushed {total_pushed}/{total_loaded} total grants")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
