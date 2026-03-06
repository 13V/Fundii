"""
fix_descriptions.py — Re-scrape descriptions for grants that have empty/null descriptions.

Strategy (per grant):
  1. Try <meta name="description"> or <meta property="og:description">
  2. Fall back to first meaningful paragraph in main content area
  3. Skip if page is unreachable / not useful

Usage:
    python fix_descriptions.py              # dry run — shows what would be fixed
    python fix_descriptions.py --apply      # apply fixes to Supabase
    python fix_descriptions.py --apply --limit 100   # apply first 100 only

Env vars required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import os, sys, time, random, re, argparse
import requests
from bs4 import BeautifulSoup

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
})

# URLs containing these patterns are unlikely to have useful grant descriptions
SKIP_URL_PATTERNS = [
    "have-question-or-want-report",
    "contact-us",
    "feedback",
    "login",
    "sign-in",
    "privacy",
    "terms",
    "sitemap",
    "accessibility",
    "/search",
    "javascript:",
    "mailto:",
]

# Selectors to look for main content (tried in order)
CONTENT_SELECTORS = [
    "main",
    "article",
    '[class*="content"]',
    '[class*="description"]',
    '[class*="summary"]',
    '[class*="intro"]',
    ".grant-detail",
    ".program-detail",
    "#content",
    ".body-content",
]

MIN_DESC_LENGTH = 40
MAX_DESC_LENGTH = 500


def fetch_grants_missing_descriptions(limit: int = None):
    """Fetch grants with empty/null descriptions from Supabase."""
    all_grants = []
    page_size = 1000
    offset = 0

    print("Fetching grants with missing descriptions...")
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/grants"
            f"?select=id,title,source_url"
            f"&or=(description.is.null,description.eq.)"
            f"&limit={page_size}&offset={offset}"
        )
        r = requests.get(url, headers=SB_HEADERS, timeout=30)
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        all_grants.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
        time.sleep(0.2)

    print(f"Found {len(all_grants)} grants missing descriptions")
    if limit:
        all_grants = all_grants[:limit]
        print(f"Processing first {limit}")
    return all_grants


def should_skip_url(url: str) -> bool:
    if not url:
        return True
    url_lower = url.lower()
    return any(p in url_lower for p in SKIP_URL_PATTERNS)


def clean_text(text: str) -> str:
    """Clean and normalise scraped text."""
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove common nav/footer artifacts
    bad_starts = ["skip to", "menu", "home >", "breadcrumb", "you are here"]
    for b in bad_starts:
        if text.lower().startswith(b):
            return ""
    return text


def extract_description(url: str) -> str | None:
    """Fetch a URL and extract the best available description."""
    try:
        resp = SESSION.get(url, timeout=15, allow_redirects=True)
        if resp.status_code != 200:
            return None
        if "text/html" not in resp.headers.get("Content-Type", ""):
            return None
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # 1. Try meta description (best quality, already written for humans)
    for attr in [
        {"name": "description"},
        {"property": "og:description"},
        {"name": "twitter:description"},
    ]:
        tag = soup.find("meta", attrs=attr)
        if tag:
            content = clean_text(tag.get("content", ""))
            if len(content) >= MIN_DESC_LENGTH:
                return content[:MAX_DESC_LENGTH]

    # 2. Try main content selectors — find first meaningful paragraph
    for selector in CONTENT_SELECTORS:
        container = soup.select_one(selector)
        if not container:
            continue
        for p in container.find_all("p"):
            text = clean_text(p.get_text())
            if len(text) >= MIN_DESC_LENGTH:
                return text[:MAX_DESC_LENGTH]

    # 3. Last resort — any paragraph on the page
    for p in soup.find_all("p"):
        text = clean_text(p.get_text())
        if len(text) >= MIN_DESC_LENGTH:
            return text[:MAX_DESC_LENGTH]

    return None


def patch_description(grant_id: str, description: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/grants?id=eq.{grant_id}"
    r = requests.patch(url, headers=SB_HEADERS, json={"description": description}, timeout=15)
    return r.status_code in (200, 204)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply fixes to Supabase")
    parser.add_argument("--limit", type=int, default=None, help="Max grants to process")
    args = parser.parse_args()

    grants = fetch_grants_missing_descriptions(limit=args.limit)

    fixed = 0
    skipped = 0
    failed = 0
    unreachable = 0

    for i, grant in enumerate(grants, 1):
        gid = grant["id"]
        title = grant.get("title", "")[:60]
        url = grant.get("source_url", "")

        print(f"[{i}/{len(grants)}] {title[:50]}")

        if should_skip_url(url):
            print(f"  ⏭  Skipped (bad URL pattern)")
            skipped += 1
            continue

        # Rate limit
        time.sleep(random.uniform(1.0, 2.5))

        desc = extract_description(url)

        if not desc:
            print(f"  ✗  No description found at {url[:60]}")
            unreachable += 1
            continue

        print(f"  ✓  Found: {desc[:80]}...")

        if args.apply:
            ok = patch_description(gid, desc)
            if ok:
                fixed += 1
            else:
                print(f"  ✗  Supabase patch failed for {gid}")
                failed += 1
        else:
            fixed += 1  # count as "would fix" in dry run

    print(f"\n{'=== DRY RUN ===' if not args.apply else '=== DONE ==='}")
    print(f"  Would fix / Fixed:  {fixed}")
    print(f"  Skipped (bad URL):  {skipped}")
    print(f"  No description:     {unreachable}")
    if args.apply:
        print(f"  Supabase failures:  {failed}")
    else:
        print(f"\nRun with --apply to write {fixed} descriptions to Supabase.")


if __name__ == "__main__":
    main()
