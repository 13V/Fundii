"""
business.gov.au Grants Scraper
================================
Uses Playwright to grab a fresh Coveo search token from business.gov.au,
then calls the Coveo REST API directly to fetch all 600+ grants in one request.
Much faster than scraping individual pages.

Usage:
    python businessgov.py
"""

import asyncio
import os
import sys
import json
import re
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

COVEO_ORG = "departmentofindustryscienceenergyandresourcesproduxlo9oz8e"
COVEO_URL = f"https://{COVEO_ORG}.org.coveo.com/rest/search/v2?organizationId={COVEO_ORG}"
BGA_URL = "https://business.gov.au/grants-and-programs"
MAX_INT = 2_000_000_000


# ── Helpers ───────────────────────────────────────────────────────────────────

def strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    return re.sub(r"<[^>]+>", " ", text or "").strip()


def parse_amount(text: str):
    """Extract min/max dollar amounts from text."""
    if not text:
        return None, None, ""
    text = str(text)
    amounts = re.findall(r"\$[\d,]+(?:\.\d{2})?", text)
    vals = [int(a.replace("$", "").replace(",", "").split(".")[0]) for a in amounts]
    if len(vals) >= 2:
        return min(vals), max(vals), text.strip()
    elif len(vals) == 1:
        return vals[0], vals[0], text.strip()
    millions = re.findall(r"(\d+(?:\.\d+)?)\s*million", text, re.IGNORECASE)
    if millions:
        v = [int(float(m) * 1_000_000) for m in millions]
        return min(v), max(v), text.strip()
    return None, None, text.strip()


import sys as _sys, os as _os; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # noqa: E402
from detection import detect_industries, detect_sizes, detect_states as _detect_states  # noqa: E402


def detect_states(text: str, biz_states: Optional[str] = None) -> List[str]:
    """Merges optional cesbusinessstate field then delegates to shared detection."""
    combined = text + " " + (biz_states or "")
    return _detect_states(combined)


def ts_to_date(ts) -> str:
    """Convert Coveo millisecond timestamp to YYYY-MM-DD string."""
    if not ts:
        return ""
    try:
        return datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        return str(ts)


def generate_id(url: str) -> str:
    return f"bga_{hash(url) % 10000000:07d}"


# ── Step 1: Get fresh bearer token via Playwright ────────────────────────────

async def get_coveo_token() -> Optional[str]:
    """Load business.gov.au and intercept the Coveo bearer token."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not installed")
        return None

    token = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="en-AU",
            timezone_id="Australia/Sydney",
        )
        page = await context.new_page()

        def on_request(req):
            nonlocal token
            if "coveo.com" in req.url and "/search/v2" in req.url:
                auth = req.headers.get("authorization", "")
                if auth.startswith("Bearer "):
                    token = auth  # Keep "Bearer xxx" prefix

        page.on("request", on_request)

        logger.info("Loading business.gov.au to get Coveo token...")
        try:
            await page.goto(BGA_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(5000)
        except Exception as e:
            logger.warning(f"Page load issue (may still have token): {e}")

        await browser.close()

    if token:
        logger.info(f"Got Coveo token: {token[:30]}...")
    else:
        logger.error("Failed to capture Coveo token")

    return token


# ── Step 2: Call Coveo API directly to get all grants ─────────────────────────

def fetch_all_grants_from_coveo(auth_header: str, total: int = 650) -> List[dict]:
    """Call the Coveo search API to get all grants in one request."""
    import requests

    payload = {
        "locale": "en-US",
        "debug": False,
        "tab": "default",
        "referrer": "",
        "timezone": "UTC",
        "cq": (
            "(NOT @z95xtemplate==(ADB6CA4F03EF4F47B9AC9CE2BA53FF97,FE5DD82648C6436DB87A7C4210C7413B)) "
            "((@z95xtemplate==64642b7d33654d6aabfaa209fe642da9) "
            "(@ez120xcludez32xfromz32xsearch==0) OR @z95xtemplate==03c2e6e6631e4ba9b889e4455d7eb090) "
            "(@z95xlanguage==en) (@z95xlatestversion==1) "
            "(@source==\"Coveo_web_index - BGA Prod Environment\")"
        ),
        "context": {"fcq": ""},
        "fieldsToInclude": [
            "ctitle", "curl", "fshortz32xdescription28333", "csearchcarddescription",
            "closez32xdate", "startz32xdate", "whoz32xthisz32xisz32xfor",
            "whatz32xyouz32xget", "cgs", "cesbusinessstate", "fheading28333",
            "labelz32xoverride", "nez120xtz32xgrantz32xinz32xsequence",
        ],
        "q": "",
        "enableQuerySyntax": False,
        "searchHub": "Grants and programs",
        "sortCriteria": "@cgrantsort ascending",
        "numberOfResults": total,
        "firstResult": 0,
    }

    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json",
        "Origin": "https://business.gov.au",
        "Referer": "https://business.gov.au/",
    }

    logger.info(f"Calling Coveo API for up to {total} grants...")
    resp = requests.post(COVEO_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    results = data.get("results", [])
    logger.info(f"Coveo returned {len(results)} results (total available: {data.get('totalCount', '?')})")
    return results


# ── Step 3: Convert Coveo results to Grant dicts ───────────────────────────────

def coveo_to_grant(result: dict) -> Optional[Dict]:
    """Convert a Coveo search result to our grant schema."""
    raw = result.get("raw", {})

    title = strip_html(raw.get("ctitle", "") or result.get("title", ""))
    if not title or len(title) < 3:
        return None

    # URL — prefer curl (business.gov.au path), fall back to clickUri
    url = raw.get("curl", "") or result.get("clickUri", "") or result.get("uri", "")
    if not url:
        return None
    # Normalise to canonical URL
    if url.startswith("/"):
        url = "https://business.gov.au" + url
    if "bgaauth.business.gov.au/grants/" in url:
        slug = url.split("/grants/")[-1].rstrip("/")
        url = f"https://business.gov.au/grants-and-programs/{slug}"

    description = strip_html(
        raw.get("fshortz32xdescription28333", "")
        or raw.get("csearchcarddescription", "")
        or result.get("excerpt", "")
    )[:2000]

    who_for = strip_html(raw.get("whoz32xthisz32xisz32xfor", ""))[:1000]
    what_you_get = strip_html(raw.get("whatz32xyouz32xget", ""))[:1000]

    close_ts = raw.get("closez32xdate")
    close_date = ts_to_date(close_ts) if close_ts else "See website"

    combined_text = f"{title} {description} {who_for} {what_you_get}"

    amount_min, amount_max, amount_text = parse_amount(what_you_get or combined_text)
    if amount_min and amount_min > MAX_INT:
        amount_min = MAX_INT
    if amount_max and amount_max > MAX_INT:
        amount_max = MAX_INT

    # Status from cgs field or close date
    cgs = (raw.get("cgs") or "").lower()
    if "closed" in cgs or "not open" in cgs:
        status = "closed"
    elif "ongoing" in cgs or "open anytime" in cgs:
        status = "ongoing"
    elif close_ts and int(close_ts) < datetime.now(tz=timezone.utc).timestamp() * 1000:
        status = "closed"
    else:
        status = "open"

    biz_states = raw.get("cesbusinessstate", "")

    return {
        "id": generate_id(url),
        "title": title[:500],
        "source": "business.gov.au",
        "source_url": url,
        "amount_min": amount_min,
        "amount_max": amount_max,
        "amount_text": amount_text or "",
        "states": detect_states(combined_text, biz_states),
        "industries": detect_industries(combined_text),
        "business_sizes": detect_sizes(combined_text),
        "status": status,
        "close_date": close_date,
        "description": description or title,
        "eligibility": who_for,
        "grant_type": "grant",
        "category": "federal",
        "url": url,
    }


# ── Step 4: Push to Supabase ──────────────────────────────────────────────────

def push_to_supabase(grants: List[Dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not set — skipping push")
        return 0

    import requests

    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Deduplicate by ID before batching — duplicate IDs cause Postgres upsert to fail
    seen_ids: set = set()
    unique = [g for g in grants if g.get("id") and not seen_ids.__contains__(g["id"]) and not seen_ids.add(g["id"])]

    BATCH = 50
    total = 0
    for i in range(0, len(unique), BATCH):
        batch = unique[i:i + BATCH]
        try:
            resp = requests.post(url, headers=headers, json=batch, timeout=30)
            resp.raise_for_status()
            total += len(batch)
            logger.info(f"  Pushed batch {i // BATCH + 1} ({len(batch)} grants)")
        except Exception as e:
            logger.error(f"  Failed batch {i // BATCH + 1}: {e}")
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    print("\n" + "=" * 60)
    print("🇦🇺  BUSINESS.GOV.AU SCRAPER — Coveo API")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # 1. Get fresh Coveo token
    auth_header = asyncio.run(get_coveo_token())
    if not auth_header:
        print("❌ Could not get Coveo token. Exiting.")
        return

    # 2. Fetch all grants from Coveo
    try:
        results = fetch_all_grants_from_coveo(auth_header, total=700)
    except Exception as e:
        print(f"❌ Coveo API call failed: {e}")
        return

    # 3. Convert to grant schema
    grants = []
    for r in results:
        g = coveo_to_grant(r)
        if g:
            grants.append(g)

    skipped = len(results) - len(grants)
    print(f"\n✅ Parsed {len(grants)} grants ({skipped} skipped — no title/url)")

    # 4. Save locally
    with open("businessgov_data.json", "w", encoding="utf-8") as f:
        json.dump(grants, f, indent=2, ensure_ascii=False)
    print(f"📁 Saved to businessgov_data.json")

    # 5. Push to Supabase
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        print(f"\n📤 Pushing {len(grants)} grants to Supabase...")
        pushed = push_to_supabase(grants)
        print(f"✅ Pushed {pushed}/{len(grants)} grants")
    else:
        print("⚠️  No Supabase credentials — skipped push")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
