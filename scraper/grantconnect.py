"""
GrantConnect Scraper — grants.gov.au
=====================================
Uses Playwright to scrape all open grant opportunities from the
Australian Government's central grants portal (GrantConnect).

This is a separate module because GrantConnect is fully JavaScript-rendered
and cannot be scraped with requests/BeautifulSoup.

Usage (standalone):
    python grantconnect.py

Output:
    - Prints grant count
    - Returns list of Grant-compatible dicts
    - Pushes to Supabase if credentials are set
"""

import asyncio
import os
import json
import re
import time
import random
import logging
from datetime import datetime
from typing import List, Dict

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BASE_URL = "https://www.grants.gov.au"
LIST_URL = "https://www.grants.gov.au/go/list"

VALID_STATUSES = {"open", "closed", "ongoing", "upcoming", "unknown"}
VALID_TYPES = {"grant", "loan", "rebate", "tax_incentive", "voucher", "subsidy", "scholarship"}


def parse_amount(text: str):
    """Extract min/max dollar amounts from text."""
    if not text:
        return None, None, text
    amounts = re.findall(r"\$[\d,]+(?:\.\d{2})?", str(text))
    amounts_int = [int(a.replace("$", "").replace(",", "").split(".")[0]) for a in amounts]
    if len(amounts_int) >= 2:
        return min(amounts_int), max(amounts_int), text.strip()
    elif len(amounts_int) == 1:
        return amounts_int[0], amounts_int[0], text.strip()
    millions = re.findall(r"(\d+(?:\.\d+)?)\s*million", str(text), re.IGNORECASE)
    if millions:
        vals = [int(float(m) * 1_000_000) for m in millions]
        return min(vals), max(vals), text.strip()
    return None, None, text.strip()


def detect_grant_type(text: str) -> str:
    t = text.lower()[:3000]
    if "loan" in t: return "loan"
    if "tax incentive" in t or "tax offset" in t: return "tax_incentive"
    if "rebate" in t: return "rebate"
    if "voucher" in t: return "voucher"
    if "subsidy" in t or "subsidies" in t: return "subsidy"
    return "grant"


def detect_industries(text: str) -> List[str]:
    t = text.lower()
    industry_map = {
        "Agriculture": ["agriculture", "farming", "agri", "horticulture", "aquaculture"],
        "Manufacturing": ["manufacturing", "manufacturer", "made in australia"],
        "Technology": ["technology", "tech", "software", "digital", "cyber", "artificial intelligence", "ai "],
        "Construction": ["construction", "building", "trade", "infrastructure"],
        "Healthcare": ["health", "medical", "healthcare", "biotech", "pharmaceutical", "aged care"],
        "Education": ["education", "training", "skills", "vocational"],
        "Tourism": ["tourism", "hospitality", "visitor economy"],
        "Retail": ["retail", "e-commerce", "ecommerce"],
        "Energy": ["energy", "renewable", "solar", "clean energy", "hydrogen", "battery storage"],
        "Mining": ["mining", "resources", "minerals", "extractive"],
        "Defence": ["defence", "defense", "military", "security"],
        "Export": ["export", "international trade", "trade mission", "emdg"],
        "Research": ["research", "r&d", "innovation", "science", "csiro"],
        "Arts": ["arts", "creative", "cultural", "heritage", "screen"],
        "Environment": ["environment", "sustainability", "climate", "waste", "recycling", "biodiversity"],
        "Transport": ["transport", "logistics", "freight", "aviation"],
        "Food & Beverage": ["food", "beverage", "wine", "brewery", "distillery"],
        "Space": ["space", "satellite", "aerospace"],
    }
    found = []
    for industry, keywords in industry_map.items():
        if any(kw in t for kw in keywords):
            found.append(industry)
    return found if found else ["General"]


def detect_states(text: str) -> List[str]:
    t = text.lower()
    state_map = {
        "NSW": ["nsw", "new south wales"],
        "VIC": ["vic", "victoria"],
        "QLD": ["qld", "queensland"],
        "SA": ["south australia"],
        "WA": ["western australia"],
        "TAS": ["tas", "tasmania"],
        "NT": ["northern territory"],
        "ACT": ["australian capital territory", "canberra"],
    }
    found = []
    for state, kws in state_map.items():
        if any(kw in t for kw in kws):
            found.append(state)
    return found if found and len(found) < 8 else ["National"]


def detect_sizes(text: str) -> List[str]:
    t = text.lower()
    sizes = []
    if any(k in t for k in ["sole trader", "sole proprietor"]): sizes.append("Sole Trader")
    if any(k in t for k in ["startup", "start-up", "early stage"]): sizes.append("Startup")
    if any(k in t for k in ["small business", "small to medium", "sme", "small and medium"]): sizes.append("Small")
    if any(k in t for k in ["medium business", "medium enterprise"]): sizes.append("Medium")
    if any(k in t for k in ["large business", "large enterprise"]): sizes.append("Large")
    if any(k in t for k in ["non-profit", "not-for-profit", "charity", "charities"]): sizes.append("Non-profit")
    return sizes if sizes else ["All"]


def generate_id(url: str) -> str:
    return f"gc_{hash(url) % 10000000:07d}"


async def scrape_grantconnect() -> List[Dict]:
    """Scrape all open grants from GrantConnect using Playwright with stealth mode."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not installed. Run: pip install playwright && playwright install chromium")
        return []

    grants = []

    # Randomise viewport slightly so all runs don't look identical
    width = random.randint(1260, 1400)
    height = random.randint(860, 960)

    async with async_playwright() as p:
        logger.info("Launching stealth browser...")
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--window-size=1280,900",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": width, "height": height},
            locale="en-AU",
            timezone_id="Australia/Sydney",
            # Mimic real browser headers
            extra_http_headers={
                "Accept-Language": "en-AU,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Upgrade-Insecure-Requests": "1",
            },
        )

        # Inject stealth JS to hide webdriver fingerprint
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-AU', 'en'] });
            window.chrome = { runtime: {} };
        """)

        page = await context.new_page()

        # Apply playwright-stealth if available
        try:
            from playwright_stealth import stealth_async
            await stealth_async(page)
            logger.info("Stealth mode active")
        except ImportError:
            logger.info("playwright-stealth not available, using manual stealth")

        # --- Step 1: Load the grant list ---
        # First visit the homepage to look like a real user, not a direct deep-link bot
        logger.info("Visiting homepage first...")
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(random.randint(1500, 3000))

        logger.info(f"Navigating to grant list...")
        await page.goto(LIST_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(random.randint(2000, 4000))

        # Try to set page size to max (show more per page)
        try:
            # Look for a "show all" or page size selector
            selectors = ["select[name*='limit']", "select[name*='pageSize']", "select[name*='rows']", "#pageSize"]
            for sel in selectors:
                if await page.locator(sel).count() > 0:
                    await page.select_option(sel, value="100")
                    await page.wait_for_timeout(2000)
                    break
        except Exception:
            pass

        # --- Step 2: Collect all grant links from all pages ---
        grant_links = set()
        page_num = 1

        while True:
            logger.info(f"  Page {page_num}: collecting grant links...")

            # Find all links to grant detail pages
            # GrantConnect uses /Go/Show?GoUuid=... format
            links = await page.eval_on_selector_all(
                "a[href]",
                "els => els.map(e => e.href).filter(h => h.includes('Show?GoUuid') || h.includes('show?GoUuid') || h.includes('/go/show') || h.includes('/Go/Show'))"
            )
            for link in links:
                if link and "grants.gov.au" in link:
                    grant_links.add(link)

            logger.info(f"  Found {len(grant_links)} unique grant links so far")

            # Try to go to next page
            next_clicked = False
            next_selectors = [
                "a[aria-label='Next page']",
                "a:has-text('Next')",
                "a:has-text('>')",
                ".pagination .next a",
                "button:has-text('Next')",
                "[rel='next']",
            ]
            for sel in next_selectors:
                try:
                    el = page.locator(sel).first
                    if await el.count() > 0 and await el.is_visible():
                        await el.click()
                        await page.wait_for_timeout(random.randint(1500, 3000))
                        page_num += 1
                        next_clicked = True
                        break
                except Exception:
                    continue

            if not next_clicked:
                logger.info(f"  No more pages. Total links: {len(grant_links)}")
                break

            if page_num > 20:  # Safety limit
                break

        # --- Step 3: Scrape each grant detail page ---
        logger.info(f"\nScraping {len(grant_links)} grant detail pages...")
        scraped = 0
        errors = 0

        for i, url in enumerate(grant_links):
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(500)

                # Extract all text content
                full_text = await page.inner_text("body")
                title_el = await page.query_selector("h1")
                title = (await title_el.inner_text()).strip() if title_el else ""

                if not title or len(title) < 5:
                    continue

                # Get description paragraphs
                desc_parts = []
                for tag in ["p", ".description", ".summary", "[class*='desc']"]:
                    elements = await page.query_selector_all(tag)
                    for el in elements[:5]:
                        text = (await el.inner_text()).strip()
                        if len(text) > 40:
                            desc_parts.append(text)
                    if desc_parts:
                        break
                description = " ".join(desc_parts[:3])[:2000]

                # Amount
                amount_text = ""
                amount_patterns = [
                    r"\$[\d,]+(?:\s*(?:to|–|-|—)\s*\$[\d,]+)?(?:\s*(?:million|m))?",
                    r"up to \$[\d,]+",
                    r"maximum.*?\$[\d,]+",
                ]
                for pat in amount_patterns:
                    match = re.search(pat, full_text, re.IGNORECASE)
                    if match:
                        amount_text = match.group(0).strip()
                        break
                amount_min, amount_max, amount_text = parse_amount(amount_text or full_text[:500])

                # Status
                status = "unknown"
                text_lower = full_text.lower()[:3000]
                if any(k in text_lower for k in ["applications closed", "closed", "no longer accepting"]):
                    status = "closed"
                elif any(k in text_lower for k in ["apply now", "applications open", "currently open", "accepting applications"]):
                    status = "open"
                elif any(k in text_lower for k in ["ongoing", "open year-round", "apply any time"]):
                    status = "ongoing"
                else:
                    status = "open"  # Default for GrantConnect — listed = likely open

                # Close date
                close_date = ""
                date_match = re.search(
                    r"clos(?:ing|es?)\s+(?:date[:\s]+)?(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})",
                    full_text, re.IGNORECASE
                )
                if date_match:
                    close_date = date_match.group(1)

                # Agency/source
                agency = "grants.gov.au"
                agency_patterns = [
                    r"administering\s+(?:agency|body|department)[:\s]+([^\n]+)",
                    r"department\s+of\s+([^\n]+)",
                    r"agency[:\s]+([^\n]{10,60})",
                ]
                for pat in agency_patterns:
                    m = re.search(pat, full_text, re.IGNORECASE)
                    if m:
                        agency = m.group(1).strip()[:100]
                        break

                grant = {
                    "id": generate_id(url),
                    "title": title[:500],
                    "source": "grants.gov.au",
                    "source_url": url,
                    "amount_min": amount_min,
                    "amount_max": amount_max,
                    "amount_text": amount_text or "",
                    "states": detect_states(full_text),
                    "industries": detect_industries(full_text),
                    "business_sizes": detect_sizes(full_text),
                    "status": status,
                    "close_date": close_date or "See website",
                    "description": description or full_text[:500],
                    "eligibility": "",
                    "grant_type": detect_grant_type(full_text),
                    "category": "federal",
                    "url": url,
                }

                # Eligibility section
                elig_match = re.search(
                    r"(?:eligib[^\n]+\n)((?:.|\n){50,800}?)(?:\n\n|\Z)",
                    full_text, re.IGNORECASE
                )
                if elig_match:
                    grant["eligibility"] = elig_match.group(1).strip()[:1000]

                grants.append(grant)
                scraped += 1

                if scraped % 10 == 0:
                    logger.info(f"  Scraped {scraped}/{len(grant_links)} grants...")

                await page.wait_for_timeout(random.randint(800, 2000))  # Human-like delay

            except Exception as e:
                errors += 1
                logger.warning(f"  Failed to scrape {url}: {e}")
                continue

        await browser.close()
        logger.info(f"\nGrantConnect: scraped {scraped} grants ({errors} errors)")

    return grants


def push_to_supabase(grants: List[Dict]) -> int:
    """Push grants to Supabase. Returns count pushed."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not set — skipping push")
        return 0

    import requests as req

    # Cap amounts to PostgreSQL integer range (2B max)
    MAX_INT = 2_000_000_000
    for g in grants:
        if g.get("amount_min") and g["amount_min"] > MAX_INT:
            g["amount_min"] = MAX_INT
        if g.get("amount_max") and g["amount_max"] > MAX_INT:
            g["amount_max"] = MAX_INT

    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    BATCH_SIZE = 50
    total = 0

    for i in range(0, len(grants), BATCH_SIZE):
        batch = grants[i:i + BATCH_SIZE]
        try:
            resp = req.post(url, headers=headers, json=batch, timeout=30)
            resp.raise_for_status()
            total += len(batch)
            logger.info(f"  Pushed batch {i//BATCH_SIZE + 1} ({len(batch)} grants)")
        except Exception as e:
            logger.error(f"  Failed batch {i//BATCH_SIZE + 1}: {e}")

    return total


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    print("\n" + "=" * 60)
    print("🇦🇺  GRANTCONNECT SCRAPER — grants.gov.au")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    grants = asyncio.run(scrape_grantconnect())

    if not grants:
        print("⚠️  No grants scraped. Check logs.")
        return

    # Save locally
    with open("grantconnect_data.json", "w", encoding="utf-8") as f:
        json.dump(grants, f, indent=2, ensure_ascii=False)
    print(f"\n📁 Saved {len(grants)} grants to grantconnect_data.json")

    # Push to Supabase
    print(f"\n📤 Pushing {len(grants)} grants to Supabase...")
    pushed = push_to_supabase(grants)
    print(f"✅ Pushed {pushed} grants")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
