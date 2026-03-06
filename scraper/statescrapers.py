"""
State, Territory & Additional Federal Grant Scrapers
=====================================================
Covers:
  NSW    — 470 grants (Elasticsearch API)
  VIC    — 158 grants (embedded grantsData JSON)
  WA     — 100+ grants (HTML directory)
  TAS    — 80+ grants (HTML list + detail pages)
  QLD    — 50+ grants (HTML list + detail pages)
  SA     — 30+ grants (HTML list + detail pages)
  ACT    — 15+ grants (HTML links)
  NT     — 30+ grants (HTML directory)
  ARENA  — 20+ grants (Playwright, JS-rendered)
  Screen Australia — 15+ grants (HTML)
  DAFF Agriculture — 15+ grants (HTML)
  DCCEEW Environment — 15+ grants (HTML)

Usage:
    python statescrapers.py
"""

import asyncio
import os
import sys
import re
import json
import time
import random
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MAX_INT = 2_000_000_000

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
})


# ── Shared helpers ─────────────────────────────────────────────────────────────

def make_request(url: str, method="GET", timeout=20, retries=2, **kwargs):
    for attempt in range(retries + 1):
        try:
            time.sleep(random.uniform(0.5, 1.5))
            resp = SESSION.request(method, url, timeout=timeout, **kwargs)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (403, 429, 503):
                logger.warning(f"  {resp.status_code} for {url[:80]}, waiting...")
                time.sleep(5)
            else:
                logger.debug(f"  {resp.status_code} for {url[:80]}")
                return None
        except Exception as e:
            logger.debug(f"  Error fetching {url[:80]}: {e}")
            if attempt < retries:
                time.sleep(3)
    return None


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").strip()


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def parse_amount(text: str):
    if not text:
        return None, None, ""
    text = str(text)
    amounts = re.findall(r"\$[\d,]+(?:\.\d{2})?", text)
    vals = [int(a.replace("$", "").replace(",", "").split(".")[0]) for a in amounts]
    if len(vals) >= 2:
        mn, mx = min(vals), max(vals)
        return (mn if mn <= MAX_INT else MAX_INT), (mx if mx <= MAX_INT else MAX_INT), text.strip()
    elif len(vals) == 1:
        v = min(vals[0], MAX_INT)
        return v, v, text.strip()
    millions = re.findall(r"(\d+(?:\.\d+)?)\s*million", text, re.IGNORECASE)
    if millions:
        v = [min(int(float(m) * 1_000_000), MAX_INT) for m in millions]
        return min(v), max(v), text.strip()
    return None, None, text.strip()


import sys as _sys, os as _os; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))  # noqa: E402
from detection import detect_industries, detect_sizes, detect_status, detect_states as _shared_detect_states  # noqa: E402


def detect_states_from_text(text: str, explicit_state: Optional[str] = None) -> List[str]:
    """Delegates to shared detection, supports explicit_state override."""
    return _shared_detect_states(text, explicit_state)


def generate_id(prefix: str, url: str) -> str:
    return f"{prefix}_{hash(url) % 10000000:07d}"


# ── Grant quality validation ────────────────────────────────────────────────

# Words that indicate real grant/funding content
GRANT_SIGNALS = [
    "grant", "fund", "funding", "subsidy", "rebate", "loan", "voucher",
    "incentive", "financial assistance", "support program", "apply",
    "eligible", "eligibility", "$",
]

# Phrases that indicate we scraped navigation/template content instead of grant info
NAV_GARBAGE = [
    "skip navigation", "toggle high contrast", "accessibility options",
    "more language options", "skip to content", "high contrast mode",
    "more options", "more sites",
]

# Titles that are clearly not grants
NON_GRANT_TITLES = [
    "small business week", "mental health week", "conference", "expo 2",
    "workshop", "webinar", "news", "calendar", "events calendar",
    "business awards", "awards night",
]


def is_likely_grant(title: str, description: str) -> bool:
    """Return True if the scraped content looks like a real grant/funding program."""
    combined = f"{title} {description}".lower()

    # Must mention grants/funding
    if not any(s in combined for s in GRANT_SIGNALS):
        return False

    # Description must be substantive
    if len(description.strip()) < 60:
        return False

    # Description must not be nav garbage
    desc_lower = description.lower()
    if any(s in desc_lower for s in NAV_GARBAGE):
        return False

    # Skip clearly non-grant page titles
    title_lower = title.lower()
    if any(t in title_lower for t in NON_GRANT_TITLES):
        return False

    return True


def scrape_detail_page(url: str, source: str, state: str, prefix: str) -> Optional[Dict]:
    """Scrape a grant detail page extracting clean description from main content only."""
    resp = make_request(url)
    if not resp:
        return None
    soup = BeautifulSoup(resp.text, "lxml")

    # ── Find main content area, ignore nav/sidebar/header/footer ──
    main = (
        soup.find("main") or
        soup.find("div", id=re.compile(r"^(main|content|primary|body)", re.I)) or
        soup.find("div", class_=re.compile(r"^(main|content|article|body|inner|page-content|entry)", re.I)) or
        soup.find("article") or
        soup
    )

    # Strip navigation and boilerplate from the content area
    for tag in main.find_all(["nav", "header", "footer", "aside", "script", "style", "noscript"]):
        tag.decompose()
    for tag in main.find_all(True, attrs={"class": re.compile(
        r"nav|menu|sidebar|breadcrumb|footer|header|cookie|alert|banner|skip|widget|social|share",
        re.I,
    )}):
        tag.decompose()
    for tag in main.find_all(True, attrs={"id": re.compile(
        r"nav|menu|sidebar|header|footer|cookie|skip|share|social",
        re.I,
    )}):
        tag.decompose()

    full_text = clean_text(main.get_text())

    # ── Title ──
    title_tag = soup.find("h1")
    title = clean_text(title_tag.get_text()) if title_tag else ""
    if not title or len(title) < 4:
        return None

    # ── Description: first 3 clean paragraphs from main content ──
    desc_parts = []
    for p in main.find_all("p"):
        t = clean_text(p.get_text())
        if len(t) < 40:
            continue
        if t in desc_parts:
            continue
        # Skip paragraphs that look like navigation or link lists
        t_lower = t.lower()
        if any(s in t_lower for s in NAV_GARBAGE):
            continue
        if t.count(".gov.au") > 2 or t.count("http") > 2:
            continue
        desc_parts.append(t)
        if len(desc_parts) >= 3:
            break
    description = " ".join(desc_parts)

    # ── Validate this is actually a grant ──
    if not is_likely_grant(title, description):
        logger.debug(f"  Skipped non-grant: {title[:70]}")
        return None

    # ── Amount ──
    amount_text = ""
    for pat in [r"up to \$[\d,]+(?:\s*(?:million|m))?", r"\$[\d,]+(?:\s*(?:to|–|-)\s*\$[\d,]+)?"]:
        m = re.search(pat, full_text, re.IGNORECASE)
        if m:
            amount_text = m.group(0)
            break
    amount_min, amount_max, amount_text = parse_amount(amount_text or full_text[:500])

    # ── Close date ──
    close_date = ""
    dm = re.search(
        r"clos(?:es?|ing)\s+(?:date[:\s]+)?(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}|\d{1,2}/\d{1,2}/\d{4})",
        full_text, re.IGNORECASE,
    )
    if dm:
        close_date = dm.group(1)

    # Use only title + description for industry/size detection (not full nav-contaminated page text)
    detection_text = f"{title} {description}"

    return {
        "id": generate_id(prefix, url),
        "title": title[:500],
        "source": source,
        "source_url": url,
        "amount_min": amount_min,
        "amount_max": amount_max,
        "amount_text": amount_text or "",
        "states": detect_states_from_text(detection_text, state),
        "industries": detect_industries(detection_text),
        "business_sizes": detect_sizes(detection_text),
        "status": detect_status(full_text),
        "close_date": close_date or "See website",
        "description": description[:2000] or title,
        "eligibility": "",
        "grant_type": "grant",
        "category": "state",
        "url": url,
    }


# ── NSW ────────────────────────────────────────────────────────────────────────

def scrape_nsw() -> List[Dict]:
    logger.info("Scraping NSW (Elasticsearch API)...")
    payload = {
        "_source": True,
        "from": 0,
        "size": 600,
        "sort": [{"title.keyword": "asc"}, {"_id": "asc"}],
        "query": {
            "bool": {
                "must": [
                    {"bool": {"minimum_should_match": 1, "should": [
                        {"bool": {"must": {"term": {"grant_date_range": int(time.time() * 1000)}}}},
                        {"term": {"subtype": "grantnoncompetitive"}},
                    ]}},
                    {"match_all": {}},
                ],
                "filter": [
                    {"term": {"type": "grant"}},
                    {"term": {"status": "true"}},
                ],
            }
        },
    }
    resp = make_request(
        "https://www.nsw.gov.au/api/v1/elasticsearch/prod_content/_search",
        method="POST",
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": "https://www.nsw.gov.au",
            "Referer": "https://www.nsw.gov.au/grants-and-funding",
        },
        timeout=30,
    )
    if not resp:
        logger.error("NSW Elasticsearch request failed")
        return []

    data = resp.json()
    hits = data.get("hits", {}).get("hits", [])
    logger.info(f"  NSW: {data.get('hits', {}).get('total', {}).get('value', 0)} total, {len(hits)} fetched")

    grants = []
    for hit in hits:
        src = hit.get("_source", {})

        def first(field):
            v = src.get(field, [])
            return v[0] if isinstance(v, list) and v else (v or "")

        title = clean_text(str(first("title")))
        if not title:
            continue

        url_path = str(first("url"))
        url = f"https://www.nsw.gov.au{url_path}" if url_path.startswith("/") else url_path

        description = clean_text(strip_html(str(first("field_summary"))))[:2000]

        amount_min_raw = first("grant_amount_min")
        amount_max_raw = first("grant_amount_max")
        try:
            amount_min = min(int(float(amount_min_raw)), MAX_INT) if amount_min_raw else None
            amount_max = min(int(float(amount_max_raw)), MAX_INT) if amount_max_raw else None
        except (ValueError, TypeError):
            amount_min, amount_max = None, None

        amount_text = clean_text(str(first("grant_amount"))) if not amount_min else f"${amount_min:,}–${amount_max:,}" if amount_max and amount_max != amount_min else (f"${amount_min:,}" if amount_min else "")

        is_ongoing = first("grant_is_ongoing")
        dates_end = first("grant_dates_end")
        status = "ongoing" if is_ongoing else "open"

        close_date = ""
        if dates_end and not is_ongoing:
            try:
                close_date = datetime.fromtimestamp(int(dates_end) / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            except Exception:
                close_date = str(dates_end)

        audience = clean_text(str(first("grant_audience")))
        agency = clean_text(str(first("agency_name")))
        combined = f"{title} {description} {audience} {agency}"

        grants.append({
            "id": generate_id("nsw", url),
            "title": title[:500],
            "source": "nsw.gov.au",
            "source_url": url,
            "amount_min": amount_min,
            "amount_max": amount_max,
            "amount_text": amount_text,
            "states": ["NSW"],
            "industries": detect_industries(combined),
            "business_sizes": detect_sizes(combined),
            "status": status,
            "close_date": close_date or "See website",
            "description": description or title,
            "eligibility": audience[:1000],
            "grant_type": "grant",
            "category": "state",
            "url": url,
        })

    logger.info(f"  NSW done: {len(grants)} grants")
    return grants


# ── VIC ────────────────────────────────────────────────────────────────────────

def scrape_vic() -> List[Dict]:
    logger.info("Scraping VIC (embedded grantsData JSON)...")
    resp = make_request("https://business.vic.gov.au/grants-and-programs")
    if not resp:
        logger.error("VIC page request failed")
        return []

    idx = resp.text.find("grantsData = [")
    if idx == -1:
        idx = resp.text.find("grantsData=[")
    if idx == -1:
        logger.error("grantsData not found in VIC page")
        return []

    start = resp.text.find("[", idx)
    depth, end = 0, start
    for i in range(start, min(start + 500000, len(resp.text))):
        if resp.text[i] == "[":
            depth += 1
        elif resp.text[i] == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    raw = resp.text[start:end]
    raw_clean = re.sub(r"/\*.*?\*/", "", raw, flags=re.DOTALL)
    raw_clean = re.sub(r",(\s*[}\]])", r"\1", raw_clean)

    try:
        data = json.loads(raw_clean)
    except json.JSONDecodeError as e:
        logger.error(f"VIC JSON parse error: {e}")
        return []

    logger.info(f"  VIC: {len(data)} grants in embedded JSON")

    MONTH_MAP = {"January": "01","February": "02","March": "03","April": "04",
                 "May": "05","June": "06","July": "07","August": "08",
                 "September": "09","October": "10","November": "11","December": "12"}

    grants = []
    for g in data:
        title = clean_text(str(g.get("title", "")))
        if not title:
            continue

        url = g.get("targetURL", "") or g.get("destination", "")
        if not url:
            continue
        if url.startswith("/"):
            url = "https://business.vic.gov.au" + url

        description = clean_text(strip_html(str(g.get("content", ""))))[:2000]

        # Build close date
        close_day = str(g.get("closingDay", "")).strip()
        close_month = str(g.get("closingMonth", "")).strip()
        close_year = str(g.get("closingYear", "")).strip()
        close_date = ""
        if close_year and close_month and close_day:
            m = MONTH_MAP.get(close_month, "")
            if m:
                close_date = f"{close_year}-{m}-{close_day.zfill(2)}"

        status_val = g.get("status", {})
        if isinstance(status_val, dict):
            status_list = status_val.get("value", [])
        else:
            status_list = []
        status = "open"
        if isinstance(status_list, list) and status_list:
            sv = status_list[0].lower() if status_list else ""
            if "closed" in sv:
                status = "closed"
            elif "ongoing" in sv or "anytime" in sv:
                status = "ongoing"

        topics_val = g.get("topics", {})
        topics = topics_val.get("value", []) if isinstance(topics_val, dict) else []
        topics_str = " ".join(topics) if isinstance(topics, list) else str(topics)

        location_val = g.get("location", {})
        location = location_val.get("value", "") if isinstance(location_val, dict) else str(location_val)

        combined = f"{title} {description} {topics_str} {location}"

        amount_min, amount_max, amount_text = parse_amount(description)

        grants.append({
            "id": generate_id("vic", url),
            "title": title[:500],
            "source": "business.vic.gov.au",
            "source_url": url,
            "amount_min": amount_min,
            "amount_max": amount_max,
            "amount_text": amount_text,
            "states": ["VIC"],
            "industries": detect_industries(combined),
            "business_sizes": detect_sizes(combined),
            "status": status,
            "close_date": close_date or "See website",
            "description": description or title,
            "eligibility": "",
            "grant_type": "grant",
            "category": "state",
            "url": url,
        })

    logger.info(f"  VIC done: {len(grants)} grants")
    return grants


# ── WA ─────────────────────────────────────────────────────────────────────────

def scrape_wa() -> List[Dict]:
    logger.info("Scraping WA (HTML directory)...")
    url = "https://www.wa.gov.au/organisation/department-of-jobs-tourism-science-and-innovation/grants-assistance-and-programs-register-wa-industry"
    resp = make_request(url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    main = soup.find("main") or soup.find("div", class_=re.compile(r"content|main", re.I))

    # Extract all named links from the main content
    grants = []
    seen_urls = set()

    if main:
        # Get all links with meaningful text pointing to .wa.gov.au or gov.au
        for a in main.find_all("a", href=True):
            href = a["href"]
            text = clean_text(a.get_text())

            if not text or len(text) < 5:
                continue
            if not href.startswith("http"):
                href = urljoin("https://www.wa.gov.au", href)

            # Only WA government links (skip business.gov.au, grants.gov.au duplicates)
            parsed = urlparse(href)
            if not parsed.netloc.endswith(".wa.gov.au") and "wa.gov.au" not in parsed.netloc:
                continue
            if href in seen_urls:
                continue
            seen_urls.add(href)

            # Get surrounding paragraph text as context
            parent = a.find_parent("p") or a.find_parent("li") or a.find_parent("div")
            context = clean_text(parent.get_text()) if parent else text

            amount_min, amount_max, amount_text = parse_amount(context)

            # Determine category from nearest heading
            category_hint = ""
            for h in main.find_all(["h2", "h3"]):
                if h.find_next("a") == a:
                    category_hint = clean_text(h.get_text())
                    break

            combined = f"{text} {context} Western Australia {category_hint}"
            grants.append({
                "id": generate_id("wa", href),
                "title": text[:500],
                "source": "wa.gov.au",
                "source_url": href,
                "amount_min": amount_min,
                "amount_max": amount_max,
                "amount_text": amount_text,
                "states": ["WA"],
                "industries": detect_industries(combined),
                "business_sizes": detect_sizes(combined),
                "status": detect_status(context),
                "close_date": "See website",
                "description": context[:2000] if len(context) > len(text) else text,
                "eligibility": "",
                "grant_type": "grant",
                "category": "state",
                "url": href,
            })

    logger.info(f"  WA done: {len(grants)} grants")
    return grants


# ── TAS ────────────────────────────────────────────────────────────────────────

def scrape_tas() -> List[Dict]:
    logger.info("Scraping TAS (HTML list + detail pages)...")
    list_url = "https://www.stategrowth.tas.gov.au/grants_and_funding_opportunities/grants_list"
    resp = make_request(list_url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    grant_links = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = clean_text(a.get_text())
        if not text or len(text) < 5:
            continue
        if not href.startswith("http"):
            href = urljoin("https://www.stategrowth.tas.gov.au", href)
        # Include stategrowth.tas.gov.au grant detail pages
        if "stategrowth.tas.gov.au/grants_and_funding" in href and href != list_url:
            if href not in seen and "/grants_list" not in href and "/grants_and_funding_opportunities" != href.rstrip("/").split("stategrowth.tas.gov.au")[-1]:
                seen.add(href)
                grant_links.append((text, href))
        # Also include arts, sport, and other TAS gov subsites
        elif any(domain in href for domain in ["arts.tas.gov.au", "active.tas.gov.au", "business.tas.gov.au"]):
            if "/grant" in href.lower() or "/funding" in href.lower():
                if href not in seen:
                    seen.add(href)
                    grant_links.append((text, href))

    logger.info(f"  TAS: {len(grant_links)} grant links found")

    grants = []
    for i, (title_hint, url) in enumerate(grant_links):
        g = scrape_detail_page(url, "stategrowth.tas.gov.au", "TAS", "tas")
        if g:
            grants.append(g)
        if (i + 1) % 10 == 0:
            logger.info(f"  TAS: scraped {i+1}/{len(grant_links)}")

    logger.info(f"  TAS done: {len(grants)} grants")
    return grants


# ── QLD ────────────────────────────────────────────────────────────────────────

QLD_GRANT_PATHS = [
    "/running-business/support-services/financial/grants/secure-communities",
    "/running-business/support-services/financial/grants/recovery-tropical-low",
    "/running-business/support-services/financial/grants/recovery-surface-trough",
    "/running-business/support-services/financial/grants/business-basics-grant",
    "/running-business/support-services/financial/grants/business-boost",
    "/running-business/support-services/financial/grants/growth-fund",
    "/running-business/support-services/financial/grants/resilience-partnership-program",
    "/running-business/growing-business/becoming-innovative/grants",
    "/running-business/employing/hiring-recruitment/back-to-work",
    "/starting-business/finance/grants",
]

def scrape_qld() -> List[Dict]:
    logger.info("Scraping QLD (HTML list + detail pages)...")
    base = "https://www.business.qld.gov.au"

    # Collect grant links from the main grants page
    resp = make_request(f"{base}/running-business/support-services/financial/grants")
    grant_urls = set()
    if resp:
        soup = BeautifulSoup(resp.text, "lxml")
        main = soup.find("main") or soup
        for a in main.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(base, href)
            if "business.qld.gov.au" in href and "/grants" in href:
                # Filter out meta pages
                if not any(x in href for x in ["/schedule", "/review", "/making-changes", "/closed", "/finding-grants", "/prepare-write"]):
                    grant_urls.add(href)

    # Also add known paths
    for path in QLD_GRANT_PATHS:
        grant_urls.add(f"{base}{path}")

    # Check innovation grants page
    resp2 = make_request(f"{base}/running-business/growing-business/becoming-innovative/grants")
    if resp2:
        soup2 = BeautifulSoup(resp2.text, "lxml")
        for a in soup2.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(base, href)
            if "business.qld.gov.au" in href and "/grants" in href:
                grant_urls.add(href)

    # Also check Advance QLD
    advance_url = "https://advance.qld.gov.au/grants-and-programs"
    resp3 = make_request(advance_url)
    if resp3:
        soup3 = BeautifulSoup(resp3.text, "lxml")
        for a in soup3.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin("https://advance.qld.gov.au", href)
            if "advance.qld.gov.au" in href and len(href) > len(advance_url) + 5:
                grant_urls.add(href)

    logger.info(f"  QLD: {len(grant_urls)} grant URLs found")

    grants = []
    for i, url in enumerate(grant_urls):
        src = "advance.qld.gov.au" if "advance.qld.gov.au" in url else "business.qld.gov.au"
        g = scrape_detail_page(url, src, "QLD", "qld")
        if g:
            grants.append(g)

    logger.info(f"  QLD done: {len(grants)} grants")
    return grants


# ── SA ─────────────────────────────────────────────────────────────────────────

SA_NON_GRANT_SLUGS = [
    "sources-of-funding", "small-business-week", "business-week",
    "drought-support", "mental-health", "events", "news", "contact",
    "about", "week-2025", "week-2024", "week-2023", "algal-bloom",
    "whyalla-support", "industrial-transformation",
]


def scrape_sa() -> List[Dict]:
    logger.info("Scraping SA (grant-programs listing only)...")
    resp = make_request("https://business.sa.gov.au/programs/grant-programs")
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    grant_links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            href = urljoin("https://business.sa.gov.au", href)
        if "business.sa.gov.au/programs/" in href and href != "https://business.sa.gov.au/programs/grant-programs":
            if not any(slug in href for slug in SA_NON_GRANT_SLUGS):
                grant_links.add(href)

    # NOTE: The general /programs page is intentionally NOT scraped here.
    # It lists non-grant programs (Mental Health, Small Business Week, events)
    # which contaminate results. Only the /grant-programs listing is used.

    logger.info(f"  SA: {len(grant_links)} grant URLs found")

    grants = []
    for url in grant_links:
        g = scrape_detail_page(url, "business.sa.gov.au", "SA", "sa")
        if g:
            grants.append(g)

    logger.info(f"  SA done: {len(grants)} grants")
    return grants


# ── ACT ────────────────────────────────────────────────────────────────────────

ACT_GRANT_URLS = [
    ("https://cbrin.com.au/icon", "ICON Innovation Grant", "ACT"),
    ("https://cbrin.com.au/act-prototyping-voucher-pilot", "ACT Prototyping Voucher Pilot", "ACT"),
    ("https://www.act.gov.au/business/run-your-business/find-capital-investment", "ACTivate Capital Fund", "ACT"),
    ("https://www.act.gov.au/money-and-tax/grants-funding-and-incentives/funding-and-support-for-social-enterprises", "Social Enterprise Grants", "ACT"),
    ("https://tourism.act.gov.au/funding/tourism-product-development-fund", "Tourism Product Development Fund", "ACT"),
    ("https://tourism.act.gov.au/funding/major-event-fund", "ACT Major Event Fund", "ACT"),
    ("https://www.arts.act.gov.au/funding/arts-activities-funding", "ACT Arts Activities Funding", "ACT"),
    ("https://www.act.gov.au/money-and-tax/grants-funding-and-incentives/funding-to-improve-disability-inclusion", "ACT Disability Inclusion Grants", "ACT"),
    ("https://www.act.gov.au/money-and-tax/grants-funding-and-incentives/Funding-to-help-businesses-diversify", "ACT Diversification Fund", "ACT"),
    ("https://www.act.gov.au/cityrenewal/get-involved/grantsandsponsorship/placemaking", "ACT City Renewal Placemaking Grants", "ACT"),
    ("https://www.climatechoices.act.gov.au/rebates-and-incentives", "ACT Everyday Climate Choices Rebates", "ACT"),
]

def scrape_act() -> List[Dict]:
    logger.info("Scraping ACT (known grant URLs)...")
    grants = []
    for url, title_hint, state in ACT_GRANT_URLS:
        g = scrape_detail_page(url, "act.gov.au", state, "act")
        if g:
            grants.append(g)
        else:
            # Create a minimal record from the known info
            grants.append({
                "id": generate_id("act", url),
                "title": title_hint,
                "source": "act.gov.au",
                "source_url": url,
                "amount_min": None,
                "amount_max": None,
                "amount_text": "",
                "states": ["ACT"],
                "industries": detect_industries(title_hint),
                "business_sizes": ["All"],
                "status": "open",
                "close_date": "See website",
                "description": title_hint,
                "eligibility": "",
                "grant_type": "grant",
                "category": "state",
                "url": url,
            })

    logger.info(f"  ACT done: {len(grants)} grants")
    return grants


# ── NT ─────────────────────────────────────────────────────────────────────────

def scrape_nt() -> List[Dict]:
    logger.info("Scraping NT (grants directory)...")
    resp = make_request("https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory")
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    main = soup.find("main") or soup

    grant_links = []
    seen = set()
    skip_patterns = ["#", "javascript:", "grants-directory", "capital-grants", "grantsnt"]

    for a in main.find_all("a", href=True):
        href = a["href"]
        text = clean_text(a.get_text())
        if not text or len(text) < 5:
            continue
        if any(p in href for p in skip_patterns):
            continue
        if not href.startswith("http"):
            href = urljoin("https://nt.gov.au", href)
        if href in seen:
            continue
        seen.add(href)
        grant_links.append((text, href))

    # Also scrape NT business grants page
    resp2 = make_request("https://nt.gov.au/industry/business-grants-funding")
    if resp2:
        soup2 = BeautifulSoup(resp2.text, "lxml")
        for a in soup2.find_all("a", href=True):
            href = a["href"]
            text = clean_text(a.get_text())
            if not text or len(text) < 5:
                continue
            if not href.startswith("http"):
                href = urljoin("https://nt.gov.au", href)
            if href in seen:
                continue
            if "nt.gov.au" in href or "tourismnt" in href:
                seen.add(href)
                grant_links.append((text, href))

    logger.info(f"  NT: {len(grant_links)} grant links found")

    grants = []
    for i, (title_hint, url) in enumerate(grant_links[:60]):  # Cap at 60 to avoid too many requests
        g = scrape_detail_page(url, "nt.gov.au", "NT", "nt")
        if g:
            grants.append(g)

    logger.info(f"  NT done: {len(grants)} grants")
    return grants


# ── ARENA (Playwright) ─────────────────────────────────────────────────────────

async def scrape_arena_async() -> List[Dict]:
    logger.info("Scraping ARENA (Playwright)...")
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not available for ARENA")
        return []

    grants = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            locale="en-AU",
        )
        page = await context.new_page()

        await page.goto("https://arena.gov.au/funding/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        # Get all funding opportunity links
        links = await page.eval_on_selector_all(
            "a[href*='arena.gov.au/funding/']",
            "els => [...new Set(els.map(e => e.href))].filter(h => h.split('/funding/')[1]?.length > 1)"
        )
        logger.info(f"  ARENA: {len(links)} funding links found")

        for url in links[:30]:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(1000)

                title = await page.title()
                title = title.replace(" - Australian Renewable Energy Agency (ARENA)", "").strip()
                if not title:
                    continue

                body_text = await page.inner_text("body")

                amount_min, amount_max, amount_text = parse_amount(body_text[:2000])
                status = detect_status(body_text)

                dm = re.search(
                    r"clos(?:es?|ing)\s+(?:date[:\s]+)?(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})",
                    body_text, re.IGNORECASE
                )
                close_date = dm.group(1) if dm else "See website"

                desc = clean_text(body_text[:1000])

                grants.append({
                    "id": generate_id("arena", url),
                    "title": title[:500],
                    "source": "arena.gov.au",
                    "source_url": url,
                    "amount_min": amount_min,
                    "amount_max": amount_max,
                    "amount_text": amount_text,
                    "states": ["National"],
                    "industries": ["Energy"] + detect_industries(body_text[:2000]),
                    "business_sizes": detect_sizes(body_text),
                    "status": status,
                    "close_date": close_date,
                    "description": desc[:2000],
                    "eligibility": "",
                    "grant_type": "grant",
                    "category": "federal",
                    "url": url,
                })
                await page.wait_for_timeout(random.randint(500, 1500))
            except Exception as e:
                logger.debug(f"  ARENA error on {url}: {e}")

        await browser.close()

    logger.info(f"  ARENA done: {len(grants)} grants")
    return grants


def scrape_arena() -> List[Dict]:
    return asyncio.run(scrape_arena_async())


# ── Screen Australia ──────────────────────────────────────────────────────────

SCREEN_AU_SECTIONS = [
    "https://www.screenaustralia.gov.au/funding-and-support/documentary",
    "https://www.screenaustralia.gov.au/funding-and-support/drama",
    "https://www.screenaustralia.gov.au/funding-and-support/games",
    "https://www.screenaustralia.gov.au/funding-and-support/online",
    "https://www.screenaustralia.gov.au/funding-and-support/feature-films",
    "https://www.screenaustralia.gov.au/funding-and-support/industry-development",
    "https://www.screenaustralia.gov.au/funding-and-support/",
]

def scrape_screen_australia() -> List[Dict]:
    logger.info("Scraping Screen Australia...")
    grant_urls = set()

    for section_url in SCREEN_AU_SECTIONS:
        resp = make_request(section_url)
        if not resp:
            continue
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin("https://www.screenaustralia.gov.au", href)
            if "screenaustralia.gov.au/funding-and-support/" in href:
                # Detail pages (not section landing pages)
                path = href.split("/funding-and-support/")[-1].rstrip("/")
                if "/" in path and len(path) > 10:
                    grant_urls.add(href)

    logger.info(f"  Screen Australia: {len(grant_urls)} grant URLs")

    grants = []
    for url in grant_urls:
        g = scrape_detail_page(url, "screenaustralia.gov.au", "National", "screen")
        if g:
            g["industries"] = ["Arts"] + g["industries"]
            g["category"] = "federal"
            grants.append(g)

    logger.info(f"  Screen Australia done: {len(grants)} grants")
    return grants


# ── Agriculture (DAFF) ────────────────────────────────────────────────────────

DAFF_URLS = [
    "https://www.agriculture.gov.au/agriculture-land/farm-food-drought/drought/farm-household",
    "https://www.agriculture.gov.au/agriculture-land/fisheries/grants",
    "https://www.agriculture.gov.au/agriculture-land/farm-food-drought/horticulture",
    "https://www.agriculture.gov.au/agriculture-land/farm-food-drought/agricultural-competitiveness",
    "https://www.agriculture.gov.au/biosecurity-trade/import/industry-advice/industry-specific/food-imports",
    "https://www.agriculture.gov.au/agriculture-land/farm-food-drought/food/food-manufacturing",
]

def scrape_daff() -> List[Dict]:
    logger.info("Scraping DAFF Agriculture...")

    # Try main grants/assistance page
    resp = make_request("https://www.agriculture.gov.au/about/assistance-grants-tenders")
    grant_urls = set()
    if resp:
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin("https://www.agriculture.gov.au", href)
            if "agriculture.gov.au" in href and any(x in href for x in ["/grants", "/assistance", "/funding", "/support"]):
                grant_urls.add(href)

    for url in DAFF_URLS:
        grant_urls.add(url)

    logger.info(f"  DAFF: {len(grant_urls)} URLs to check")

    grants = []
    for url in grant_urls:
        g = scrape_detail_page(url, "agriculture.gov.au", "National", "daff")
        if g:
            g["industries"] = ["Agriculture"] + g["industries"]
            g["category"] = "federal"
            grants.append(g)

    logger.info(f"  DAFF done: {len(grants)} grants")
    return grants


# ── DCCEEW Environment ─────────────────────────────────────────────────────────

def scrape_dcceew() -> List[Dict]:
    logger.info("Scraping DCCEEW Environment...")
    base = "https://www.dcceew.gov.au"
    resp = make_request(f"{base}/about/assistance-grants-tenders")
    grant_urls = set()

    if resp:
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(base, href)
            if "dcceew.gov.au" in href and any(x in href for x in ["/grants", "/funding", "/assistance", "/programs"]):
                grant_urls.add(href)

    # Known programs
    known = [
        f"{base}/environment/biodiversity/biodiversity-conservation/biodiversity-fund",
        f"{base}/environment/land/landcare/national-landcare-program",
        f"{base}/climate-change/government-action/clean-energy-programs",
        f"{base}/energy/energy-efficiency/energy-efficiency-grants-small-medium-sized-enterprises",
    ]
    for url in known:
        grant_urls.add(url)

    logger.info(f"  DCCEEW: {len(grant_urls)} URLs")

    grants = []
    for url in grant_urls:
        g = scrape_detail_page(url, "dcceew.gov.au", "National", "dcceew")
        if g:
            g["industries"] = ["Environment"] + g["industries"]
            g["category"] = "federal"
            grants.append(g)

    logger.info(f"  DCCEEW done: {len(grants)} grants")
    return grants


# ── Supabase push ─────────────────────────────────────────────────────────────

def push_to_supabase(grants: List[Dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not set")
        return 0

    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    BATCH = 50
    total = 0
    for i in range(0, len(grants), BATCH):
        batch = grants[i:i + BATCH]
        try:
            resp = requests.post(url, headers=headers, json=batch, timeout=30)
            resp.raise_for_status()
            total += len(batch)
        except Exception as e:
            logger.error(f"  Batch push failed: {e}")

    return total


# ── Main ──────────────────────────────────────────────────────────────────────

SCRAPERS = [
    ("NSW (Elasticsearch API)", scrape_nsw),
    ("VIC (embedded JSON)",     scrape_vic),
    ("WA (HTML directory)",     scrape_wa),
    ("TAS (detail pages)",      scrape_tas),
    ("QLD (detail pages)",      scrape_qld),
    ("SA (detail pages)",       scrape_sa),
    ("ACT (known URLs)",        scrape_act),
    ("NT (grants directory)",   scrape_nt),
    ("ARENA (Playwright)",      scrape_arena),
    ("Screen Australia",        scrape_screen_australia),
    ("DAFF Agriculture",        scrape_daff),
    ("DCCEEW Environment",      scrape_dcceew),
]


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    print("\n" + "=" * 60)
    print("🇦🇺  STATE + TERRITORY + FEDERAL SCRAPERS")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    all_grants = []
    results_summary = []

    for name, scraper_fn in SCRAPERS:
        print(f"\n▶ {name}")
        try:
            grants = scraper_fn()
            all_grants.extend(grants)
            results_summary.append((name, len(grants), "✅"))
            print(f"  → {len(grants)} grants")
        except Exception as e:
            logger.error(f"  Scraper '{name}' failed: {e}")
            results_summary.append((name, 0, "❌"))

    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    total = 0
    for name, count, icon in results_summary:
        print(f"  {icon} {name}: {count}")
        total += count
    print(f"\n  Total scraped: {total} grants")

    # Save locally
    with open("statescrapers_data.json", "w", encoding="utf-8") as f:
        json.dump(all_grants, f, indent=2, ensure_ascii=False)
    print(f"📁 Saved to statescrapers_data.json")

    # Push to Supabase
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        print(f"\n📤 Pushing {total} grants to Supabase...")
        pushed = push_to_supabase(all_grants)
        print(f"✅ Pushed {pushed}/{total}")
    else:
        print("⚠️  No Supabase credentials — skipped push")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
