"""
Federal & Industry-Specific Grant Scrapers (Supplementary)
============================================================
Covers remaining sources not handled by businessgov.py, grantconnect.py,
or statescrapers.py:

  CSIRO Kick-Start            — research/innovation co-funding
  Austrade EMDG               — export market development grants
  Community Grants Hub        — community/not-for-profit grants
  Industry.gov.au             — AusIndustry, Industry Growth Program
  MRFF (Dept of Health)       — medical research future fund
  Creative Australia          — arts & culture grants
  Sport Australia             — sport/recreation funding
  Defence Innovation Hub      — defence industry grants
  AgriFutures Australia       — rural R&D grants
  LaunchVic                   — VIC startup/innovation grants
  IP Australia                — patent/IP commercialisation programs
  Clean Energy Finance Corp   — CEFC clean energy finance
  Wine Australia              — wine industry R&D grants
  Meat & Livestock Australia  — MLA research funding

Usage:
    python federalscrapers.py
"""

import os
import re
import sys
import json
import time
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Fix Windows console encoding for emoji/unicode
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MAX_INT = 2_000_000_000
REQUEST_DELAY = 2

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

def get(url: str, timeout: int = 20) -> Optional[requests.Response]:
    try:
        time.sleep(REQUEST_DELAY)
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        return r
    except Exception as e:
        logger.warning(f"GET {url[:80]} failed: {e}")
        return None


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").strip()


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def parse_amount(text: str):
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
from detection import detect_industries, detect_states, detect_sizes  # noqa: E402


def gid(prefix: str, url: str) -> str:
    import hashlib
    return f"{prefix}_{hashlib.md5(url.encode()).hexdigest()[:8]}"


def make_grant(
    prefix: str,
    title: str,
    url: str,
    source: str,
    description: str = "",
    eligibility: str = "",
    amount_text: str = "",
    status: str = "open",
    close_date: str = "",
    category: str = "federal",
    states: Optional[List[str]] = None,
    industries: Optional[List[str]] = None,
    sizes: Optional[List[str]] = None,
    grant_type: str = "grant",
) -> Dict:
    combined = f"{title} {description} {eligibility}"
    amount_min, amount_max, amount_text_clean = parse_amount(amount_text or combined)
    return {
        "id": gid(prefix, url),
        "title": title[:500],
        "source": source,
        "source_url": url,
        "url": url,
        "amount_min": amount_min,
        "amount_max": amount_max,
        "amount_text": amount_text_clean,
        "states": states or detect_states(combined),
        "industries": industries or detect_industries(combined),
        "business_sizes": sizes or detect_sizes(combined),
        "status": status,
        "close_date": close_date or "",
        "description": description[:2000],
        "eligibility": eligibility[:1500],
        "grant_type": grant_type,
        "category": category,
    }


# ── Push to Supabase ────────────────────────────────────────────────────────

def push_to_supabase(grants: List[Dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not set — skipping push")
        return 0

    # Deduplicate by ID — duplicate IDs in the same batch cause Postgres upsert to fail
    seen_ids: set = set()
    unique_grants = []
    for g in grants:
        if g.get("id") and g["id"] not in seen_ids:
            seen_ids.add(g["id"])
            unique_grants.append(g)
    if len(unique_grants) < len(grants):
        logger.info(f"  Deduplicated {len(grants)} → {len(unique_grants)} grants (removed {len(grants) - len(unique_grants)} ID dupes)")

    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    BATCH = 50
    total = 0
    for i in range(0, len(unique_grants), BATCH):
        batch = unique_grants[i:i + BATCH]
        try:
            resp = requests.post(url, headers=headers, json=batch, timeout=30)
            resp.raise_for_status()
            total += len(batch)
            logger.info(f"  Pushed batch {i // BATCH + 1} ({len(batch)} grants)")
        except Exception as e:
            logger.error(f"  Failed batch {i // BATCH + 1}: {e}")
    return total


# ════════════════════════════════════════════════════════════════════════════
# 1. CSIRO Kick-Start
# ════════════════════════════════════════════════════════════════════════════

def scrape_csiro() -> List[Dict]:
    """CSIRO Kick-Start co-funding for small businesses working with CSIRO researchers."""
    logger.info("Scraping CSIRO Kick-Start...")
    grants = []

    urls = [
        "https://www.csiro.au/en/work-with-us/funding-programs/programs/kick-start",
        "https://www.csiro.au/en/work-with-us/funding-programs",
    ]

    for url in urls:
        r = get(url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        full_text = clean(soup.get_text())

        # Look for program/grant headings and links
        for a in soup.find_all("a", href=True):
            href = a["href"]
            # Use only the direct/inline text of the <a> tag, not nested block elements
            raw_title = " ".join(t.strip() for t in a.strings if t.strip()).split("\n")[0]
            title = clean(raw_title)
            if len(title) < 10:
                continue
            if any(kw in (title + href).lower() for kw in ["program", "fund", "grant", "kick-start", "kickstart"]):
                full_url = href if href.startswith("http") else urljoin("https://www.csiro.au", href)
                if "csiro.au" not in full_url:
                    continue
                desc_el = a.find_next("p")
                desc = clean(desc_el.get_text()) if desc_el else ""
                grants.append(make_grant(
                    prefix="csiro",
                    title=title,
                    url=full_url,
                    source="csiro.gov.au",
                    description=desc,
                    eligibility="Small businesses (under 50 employees) with an existing CSIRO project or scope for collaboration",
                    amount_text="Up to $50,000 (matched 1:1 by business)",
                    status="open",
                    category="research",
                    states=["National"],
                    industries=["Research", "Technology"],
                ))

    # Deduplicate
    seen = set()
    unique = []
    for g in grants:
        if g["title"] not in seen and len(g["title"]) > 10:
            seen.add(g["title"])
            unique.append(g)

    # Always include the flagship program even if scraping fails
    if not unique:
        unique.append(make_grant(
            prefix="csiro",
            title="CSIRO Kick-Start",
            url="https://www.csiro.au/en/work-with-us/funding-programs/programs/kick-start",
            source="csiro.gov.au",
            description="CSIRO Kick-Start offers early-stage funding to help Australian start-ups and small businesses access CSIRO's world class expertise and capabilities. Provides matched co-funding of up to $50,000.",
            eligibility="Australian start-ups and small businesses (under 50 employees, less than $10M revenue) not previously worked with CSIRO",
            amount_text="Up to $50,000",
            status="open",
            category="research",
            states=["National"],
            industries=["Research", "Technology", "Manufacturing"],
            sizes=["Startup", "Small"],
        ))

    logger.info(f"  CSIRO: {len(unique)} grants")
    return unique


# ════════════════════════════════════════════════════════════════════════════
# 2. Austrade — Export Market Development Grants + programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_austrade() -> List[Dict]:
    """Austrade EMDG and other export/investment programs."""
    logger.info("Scraping Austrade programs...")
    grants = []

    pages = [
        "https://www.austrade.gov.au/en/how-we-can-help-you/grants",
        "https://www.austrade.gov.au/en/how-we-can-help-you/programs-and-incentives",
    ]

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        # Find all program links
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "program", "incentive", "emdg", "support"]):
                full_url = href if href.startswith("http") else urljoin("https://www.austrade.gov.au", href)
                if "austrade.gov.au" not in full_url:
                    continue
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="austrade",
                    title=title,
                    url=full_url,
                    source="austrade.gov.au",
                    description=desc,
                    eligibility="Australian businesses looking to grow export markets",
                    status="open",
                    category="export",
                    states=["National"],
                    industries=["Export"],
                ))

    # Deduplicate
    seen = set()
    unique = []
    for g in grants:
        if g["title"] not in seen and len(g["title"]) > 10:
            seen.add(g["title"])
            unique.append(g)

    # Always ensure EMDG is present
    emdg_present = any("emdg" in g["title"].lower() or "export market development" in g["title"].lower() for g in unique)
    if not emdg_present:
        unique.append(make_grant(
            prefix="austrade",
            title="Export Market Development Grants (EMDG)",
            url="https://www.austrade.gov.au/en/how-austrade-can-help-you/programs-and-incentives/export-market-development-grants",
            source="austrade.gov.au",
            description="The EMDG program helps small and medium Australian businesses grow their export revenue. Provides reimbursements for eligible export promotion expenses.",
            eligibility="Australian businesses with export income under $20M in the most recent income year",
            amount_text="Tier 1: up to $40,000; Tier 2: up to $80,000; Tier 3: up to $150,000",
            status="open",
            category="export",
            states=["National"],
            industries=["Export"],
            sizes=["Small", "Medium"],
        ))

    logger.info(f"  Austrade: {len(unique)} grants")
    return unique


# ════════════════════════════════════════════════════════════════════════════
# 3. Community Grants Hub
# ════════════════════════════════════════════════════════════════════════════

def scrape_community_grants_hub() -> List[Dict]:
    """Community Grants Hub — DSS-administered community/NFP grants."""
    logger.info("Scraping Community Grants Hub...")
    grants = []

    base_url = "https://www.communitygrants.gov.au"

    # The hub lists grants via a search page
    pages = [
        f"{base_url}/grants",
        f"{base_url}/grants?page=1",
        f"{base_url}/grants?page=2",
        f"{base_url}/grants?page=3",
    ]

    seen_urls = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        # Find grant cards/listings
        for article in soup.find_all(["article", "div"], class_=re.compile(r"grant|card|listing|result", re.I)):
            a_tag = article.find("a", href=True)
            if not a_tag:
                continue
            href = a_tag["href"]
            title = clean(a_tag.get_text())
            if len(title) < 10:
                continue
            full_url = href if href.startswith("http") else urljoin(base_url, href)
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            desc_el = article.find("p")
            desc = clean(desc_el.get_text())[:500] if desc_el else ""

            # Look for amount
            amount_text = ""
            amount_el = article.find(string=re.compile(r"\$[\d,]+", re.I))
            if amount_el:
                amount_text = clean(str(amount_el))[:200]

            # Status
            status = "open"
            status_el = article.find(string=re.compile(r"closed|open|upcoming", re.I))
            if status_el:
                s = status_el.lower()
                if "closed" in s:
                    status = "closed"
                elif "upcoming" in s:
                    status = "upcoming"

            grants.append(make_grant(
                prefix="cgh",
                title=title,
                url=full_url,
                source="communitygrants.gov.au",
                description=desc,
                amount_text=amount_text,
                status=status,
                category="community",
                states=["National"],
                industries=detect_industries(f"{title} {desc}"),
                sizes=["Non-profit", "All"],
            ))

        # Also grab any direct grant links if no article structure
        if not grants:
            for a in soup.find_all("a", href=True):
                href = a["href"]
                title = clean(a.get_text())
                if len(title) < 15:
                    continue
                full_url = href if href.startswith("http") else urljoin(base_url, href)
                if "communitygrants.gov.au/grants/" in full_url and full_url not in seen_urls:
                    seen_urls.add(full_url)
                    grants.append(make_grant(
                        prefix="cgh",
                        title=title,
                        url=full_url,
                        source="communitygrants.gov.au",
                        status="open",
                        category="community",
                        states=["National"],
                        sizes=["Non-profit", "All"],
                    ))

    # Hardcoded core programs when site blocks bots
    if not grants:
        known = [
            {
                "title": "Emergency Relief Program",
                "url": "https://www.communitygrants.gov.au/grants/emergency-relief",
                "description": "Provides assistance to people experiencing financial crisis. Funded organisations deliver food, material aid, and other support to vulnerable Australians.",
                "industries": ["Healthcare"],
                "sizes": ["Non-profit"],
            },
            {
                "title": "Financial Wellbeing and Capability Activity",
                "url": "https://www.communitygrants.gov.au/grants/financial-wellbeing-and-capability",
                "description": "Supports people experiencing financial hardship to build financial resilience through financial counselling, capability building and consumer advocacy.",
                "industries": ["Education"],
                "sizes": ["Non-profit"],
            },
            {
                "title": "Stronger Communities Programme",
                "url": "https://www.communitygrants.gov.au/grants/stronger-communities-programme",
                "description": "Funds small capital works and minor equipment projects by community and not-for-profit organisations to benefit local communities.",
                "amount_text": "$2,500 to $20,000",
                "industries": ["General"],
                "sizes": ["Non-profit"],
            },
        ]
        for k in known:
            grants.append(make_grant(
                prefix="cgh",
                title=k["title"],
                url=k["url"],
                source="communitygrants.gov.au",
                description=k["description"],
                amount_text=k.get("amount_text", ""),
                status="open",
                category="community",
                states=["National"],
                industries=k.get("industries", ["General"]),
                sizes=k.get("sizes", ["Non-profit"]),
            ))

    logger.info(f"  Community Grants Hub: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 4. Industry.gov.au — AusIndustry / Industry Growth Program
# ════════════════════════════════════════════════════════════════════════════

def scrape_industry_gov() -> List[Dict]:
    """Department of Industry, Science and Resources grants & programs."""
    logger.info("Scraping Industry.gov.au...")
    grants = []

    pages = [
        "https://www.industry.gov.au/grants-and-programs",
        "https://www.industry.gov.au/funding-and-incentives",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "program", "fund", "incentive", "support", "scheme"]):
                full_url = href if href.startswith("http") else urljoin("https://www.industry.gov.au", href)
                if title in seen or len(title) < 15:
                    continue
                seen.add(title)

                parent = a.find_parent(["li", "div", "article", "section"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]

                amount_text = ""
                amount_match = re.search(r"\$[\d,.]+(?: ?(?:million|m|k))?(?:\s*(?:to|–|-)\s*\$[\d,.]+(?:m|million|k)?)?", f"{title} {desc}", re.I)
                if amount_match:
                    amount_text = amount_match.group(0)

                grants.append(make_grant(
                    prefix="industry",
                    title=title,
                    url=full_url,
                    source="industry.gov.au",
                    description=desc,
                    amount_text=amount_text,
                    status="open",
                    category="federal",
                    states=["National"],
                ))

    # Always include flagship programs
    flagships = [
        {
            "title": "Industry Growth Program",
            "url": "https://www.industry.gov.au/grants-and-programs/industry-growth-program",
            "description": "The Industry Growth Program supports Australian SMEs and startups to commercialise their ideas and grow their operations. Provides matched co-investment and advisory services.",
            "eligibility": "Australian SMEs and startups with a novel product or service, and viable commercialisation plan",
            "amount_text": "Up to $5 million (matched)",
            "industries": ["Manufacturing", "Technology", "Research"],
            "sizes": ["Startup", "Small", "Medium"],
        },
        {
            "title": "Modern Manufacturing Initiative (MMI)",
            "url": "https://www.industry.gov.au/grants-and-programs/modern-manufacturing-initiative",
            "description": "Supports Australian manufacturers to scale up, become more competitive and access global value chains in six National Manufacturing Priorities.",
            "eligibility": "Australian manufacturers in priority sectors (food & beverage, resources, medical products, recycling, defence, space)",
            "amount_text": "$1 million to $200 million",
            "industries": ["Manufacturing"],
            "sizes": ["Small", "Medium", "Large"],
        },
    ]

    for f in flagships:
        if f["title"] not in seen:
            seen.add(f["title"])
            grants.append(make_grant(
                prefix="industry",
                title=f["title"],
                url=f["url"],
                source="industry.gov.au",
                description=f["description"],
                eligibility=f.get("eligibility", ""),
                amount_text=f["amount_text"],
                status="open",
                category="federal",
                states=["National"],
                industries=f.get("industries"),
                sizes=f.get("sizes"),
            ))

    logger.info(f"  Industry.gov.au: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 5. Medical Research Future Fund (MRFF)
# ════════════════════════════════════════════════════════════════════════════

def scrape_mrff() -> List[Dict]:
    """Medical Research Future Fund open grant opportunities."""
    logger.info("Scraping MRFF...")
    grants = []

    pages = [
        "https://www.health.gov.au/our-work/mrff/open-grant-opportunities",
        "https://www.health.gov.au/our-work/mrff",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "opportunity", "fund", "program", "initiative", "mission"]):
                full_url = href if href.startswith("http") else urljoin("https://www.health.gov.au", href)
                if title in seen:
                    continue
                seen.add(title)

                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]

                amount_match = re.search(r"\$[\d,.]+(?: ?(?:million|m|k|billion|b))?", f"{title} {desc}", re.I)
                amount_text = amount_match.group(0) if amount_match else ""

                grants.append(make_grant(
                    prefix="mrff",
                    title=title,
                    url=full_url,
                    source="health.gov.au",
                    description=desc,
                    amount_text=amount_text,
                    status="open",
                    category="health",
                    states=["National"],
                    industries=["Healthcare", "Research"],
                    sizes=["All"],
                ))

    logger.info(f"  MRFF: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 6. Creative Australia (Australia Council for the Arts)
# ════════════════════════════════════════════════════════════════════════════

def scrape_creative_australia() -> List[Dict]:
    """Creative Australia — arts, culture, creative industry funding."""
    logger.info("Scraping Creative Australia...")
    grants = []

    pages = [
        "https://creative.gov.au/funding-and-support/",
        "https://creative.gov.au/funding-and-support/grants/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "support", "program", "fellowship", "residency", "award"]):
                full_url = href if href.startswith("http") else urljoin("https://creative.gov.au", href)
                if title in seen:
                    continue
                seen.add(title)

                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]

                amount_match = re.search(r"\$[\d,.]+(?: ?(?:million|m|k))?", f"{title} {desc}", re.I)
                amount_text = amount_match.group(0) if amount_match else ""

                grants.append(make_grant(
                    prefix="creative_au",
                    title=title,
                    url=full_url,
                    source="creative.gov.au",
                    description=desc,
                    amount_text=amount_text,
                    status="open",
                    category="arts",
                    states=["National"],
                    industries=["Arts"],
                    sizes=["All"],
                ))

    logger.info(f"  Creative Australia: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 7. Sport Australia (ASC)
# ════════════════════════════════════════════════════════════════════════════

def scrape_sport_australia() -> List[Dict]:
    """Sport Australia / Australian Sports Commission funding programs."""
    logger.info("Scraping Sport Australia...")
    grants = []

    pages = [
        "https://www.sportaus.gov.au/grants_and_investment",
        "https://www.ausport.gov.au/supporting/grants",
        "https://www.sportaus.gov.au/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        base = "https://" + urlparse(page_url).netloc
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "initiative", "support", "investment"]):
                full_url = href if href.startswith("http") else urljoin(base, href)
                if title in seen:
                    continue
                seen.add(title)

                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]

                grants.append(make_grant(
                    prefix="sport_au",
                    title=title,
                    url=full_url,
                    source="sportaus.gov.au",
                    description=desc,
                    status="open",
                    category="sport",
                    states=["National"],
                    industries=["Sport"],
                    sizes=["All"],
                ))

    # Hardcoded flagship programs in case site is unreachable
    flagship = [
        {
            "title": "Sport Australia — Significant Sports Fund",
            "url": "https://www.sportaus.gov.au/grants_and_investment",
            "description": "Funding for nationally significant sport infrastructure and facilities that deliver major benefits to Australian communities and sport participation.",
            "amount_text": "Up to $5 million",
        },
        {
            "title": "Community Sport Infrastructure Grant Program",
            "url": "https://www.sportaus.gov.au/grants_and_investment/community-sport-infrastructure-grant-program",
            "description": "Supports local sport infrastructure projects to increase participation in sport and physical activity.",
            "amount_text": "$500 to $500,000",
        },
    ]
    for f in flagship:
        if f["title"] not in seen:
            seen.add(f["title"])
            grants.append(make_grant(
                prefix="sport_au",
                title=f["title"],
                url=f["url"],
                source="sportaus.gov.au",
                description=f["description"],
                amount_text=f["amount_text"],
                status="open",
                category="sport",
                states=["National"],
                industries=["Sport"],
                sizes=["All"],
            ))

    logger.info(f"  Sport Australia: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 8. Defence Innovation Hub & Defence Science Partnership
# ════════════════════════════════════════════════════════════════════════════

def scrape_defence() -> List[Dict]:
    """Defence Innovation Hub and other defence industry grants."""
    logger.info("Scraping Defence grants...")
    grants = []

    pages = [
        "https://www.defence.gov.au/industry/innovation/defence-innovation-hub",
        "https://www.defence.gov.au/industry/innovation",
        "https://www.defence.gov.au/industry/programs",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "hub", "innovation", "partnership", "scheme", "initiative"]):
                full_url = href if href.startswith("http") else urljoin("https://www.defence.gov.au", href)
                if title in seen or len(title) < 15:
                    continue
                seen.add(title)

                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]

                amount_match = re.search(r"\$[\d,.]+(?: ?(?:million|m|k))?", f"{title} {desc}", re.I)
                amount_text = amount_match.group(0) if amount_match else ""

                grants.append(make_grant(
                    prefix="defence",
                    title=title,
                    url=full_url,
                    source="defence.gov.au",
                    description=desc,
                    amount_text=amount_text,
                    status="open",
                    category="defence",
                    states=["National"],
                    industries=["Defence", "Technology", "Manufacturing"],
                    sizes=["All"],
                ))

    # Ensure key programs are always present
    flagships = [
        {
            "title": "Defence Innovation Hub",
            "url": "https://www.defence.gov.au/industry/innovation/defence-innovation-hub",
            "description": "The Defence Innovation Hub funds applied research and development for novel technologies that address capability gaps. Supports Australian companies to mature technologies from TRL 4 to 7.",
            "eligibility": "Australian companies developing technology relevant to ADF capability requirements",
            "amount_text": "Up to $1 million per project",
            "sizes": ["Small", "Medium", "Large"],
        },
        {
            "title": "Defence Science Partnership Program",
            "url": "https://www.defence.gov.au/industry/innovation/defence-science-partnerships",
            "description": "Collaborative R&D between Australian universities/research organisations and Defence for fundamental research.",
            "eligibility": "Australian universities and research organisations with Defence-relevant research",
            "amount_text": "Variable",
            "sizes": ["All"],
        },
    ]

    for f in flagships:
        if f["title"] not in seen:
            seen.add(f["title"])
            grants.append(make_grant(
                prefix="defence",
                title=f["title"],
                url=f["url"],
                source="defence.gov.au",
                description=f["description"],
                eligibility=f.get("eligibility", ""),
                amount_text=f.get("amount_text", ""),
                status="open",
                category="defence",
                states=["National"],
                industries=["Defence"],
                sizes=f.get("sizes", ["All"]),
            ))

    logger.info(f"  Defence: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 9. AgriFutures Australia
# ════════════════════════════════════════════════════════════════════════════

def scrape_agrifutures() -> List[Dict]:
    """AgriFutures Australia — rural R&D and agribusiness grants."""
    logger.info("Scraping AgriFutures Australia...")
    grants = []

    pages = [
        "https://agrifutures.com.au/grants/",
        "https://agrifutures.com.au/funding-opportunities/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for article in soup.find_all(["article", "div"], class_=re.compile(r"post|card|grant|fund|listing", re.I)):
            a_tag = article.find("a", href=True)
            if not a_tag:
                continue
            href = a_tag["href"]
            title = clean(a_tag.get_text())
            if len(title) < 10:
                continue
            full_url = href if href.startswith("http") else urljoin("https://agrifutures.com.au", href)
            if title in seen:
                continue
            seen.add(title)
            desc_el = article.find("p")
            desc = clean(desc_el.get_text())[:500] if desc_el else ""
            grants.append(make_grant(
                prefix="agrifutures",
                title=title,
                url=full_url,
                source="agrifutures.com.au",
                description=desc,
                status="open",
                category="agriculture",
                states=["National"],
                industries=["Agriculture", "Research"],
                sizes=["All"],
            ))

    # Hardcoded known programs (site often blocks bots)
    known = [
        {
            "title": "AgriFutures Rural Women's Award",
            "url": "https://agrifutures.com.au/programs/rural-womens-award/",
            "description": "Recognises and promotes outstanding rural women who are making a difference in Australian rural industries and communities. Winners receive funding to develop their projects.",
            "amount_text": "$10,000",
            "industries": ["Agriculture"],
        },
        {
            "title": "AgriFutures Horizon Scholarship",
            "url": "https://agrifutures.com.au/programs/scholarships/",
            "description": "Scholarships for students pursuing careers in the rural sector across a range of fields including agriculture, science, business and technology.",
            "amount_text": "Up to $10,000 per year",
            "industries": ["Agriculture", "Education"],
            "sizes": ["All"],
        },
        {
            "title": "AgriFutures Australia Research Programs",
            "url": "https://agrifutures.com.au/research-development/",
            "description": "Co-investment in rural R&D projects across emerging and developing agricultural industries not covered by other Rural R&D Corporations.",
            "amount_text": "Variable — see website",
            "industries": ["Agriculture", "Research"],
            "sizes": ["All"],
        },
    ]
    for k in known:
        if k["title"] not in seen:
            seen.add(k["title"])
            grants.append(make_grant(
                prefix="agrifutures",
                title=k["title"],
                url=k["url"],
                source="agrifutures.com.au",
                description=k["description"],
                amount_text=k.get("amount_text", ""),
                status="open",
                category="agriculture",
                states=["National"],
                industries=k.get("industries", ["Agriculture"]),
                sizes=k.get("sizes", ["All"]),
            ))

    logger.info(f"  AgriFutures: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 10. LaunchVic — Victoria startup/innovation grants
# ════════════════════════════════════════════════════════════════════════════

def scrape_launchvic() -> List[Dict]:
    """LaunchVic — Victorian startup ecosystem grants and programs."""
    logger.info("Scraping LaunchVic...")
    grants = []

    pages = [
        "https://launchvic.org/programs/",
        "https://launchvic.org/grants/",
        "https://launchvic.org/funding/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            full_url = href if href.startswith("http") else urljoin("https://launchvic.org", href)
            if "launchvic.org" not in full_url or title in seen:
                continue
            if any(kw in (title + href).lower() for kw in ["program", "grant", "fund", "support", "initiative"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="launchvic",
                    title=title,
                    url=full_url,
                    source="launchvic.org",
                    description=desc,
                    status="open",
                    category="state",
                    states=["VIC"],
                    industries=["Technology", "Research"],
                    sizes=["Startup", "Small"],
                ))

    logger.info(f"  LaunchVic: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 11. Wine Australia
# ════════════════════════════════════════════════════════════════════════════

def scrape_wine_australia() -> List[Dict]:
    """Wine Australia — wine industry R&D and export grants."""
    logger.info("Scraping Wine Australia...")
    grants = []

    pages = [
        "https://www.wineaustralia.com/growers-and-winemakers",
        "https://www.wineaustralia.com/research-and-development",
        "https://www.wineaustralia.com/apply-for-funding",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            full_url = href if href.startswith("http") else urljoin("https://www.wineaustralia.com", href)
            if title in seen or "wineaustralia.com" not in full_url:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "apply", "support", "scholarship"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="wine_au",
                    title=title,
                    url=full_url,
                    source="wineaustralia.com",
                    description=desc,
                    status="open",
                    category="agriculture",
                    states=["National"],
                    industries=["Food & Beverage", "Agriculture", "Export"],
                    sizes=["All"],
                ))

    logger.info(f"  Wine Australia: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 12. Meat & Livestock Australia (MLA)
# ════════════════════════════════════════════════════════════════════════════

def scrape_mla() -> List[Dict]:
    """MLA — R&D and marketing co-investment for beef, lamb, and goat industries."""
    logger.info("Scraping MLA...")
    grants = []

    pages = [
        "https://www.mla.com.au/research-and-development/funding-opportunities/",
        "https://www.mla.com.au/research-and-development/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10:
                continue
            full_url = href if href.startswith("http") else urljoin("https://www.mla.com.au", href)
            if title in seen or "mla.com.au" not in full_url:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "research", "co-invest", "initiative"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="mla",
                    title=title,
                    url=full_url,
                    source="mla.com.au",
                    description=desc,
                    status="open",
                    category="agriculture",
                    states=["National"],
                    industries=["Agriculture", "Food & Beverage"],
                    sizes=["All"],
                ))

    logger.info(f"  MLA: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 13. IP Australia — IP commercialisation / patent box programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_ip_australia() -> List[Dict]:
    """IP Australia commercialisation support programs."""
    logger.info("Scraping IP Australia programs...")
    grants = []

    pages = [
        "https://www.ipaustralia.gov.au/tools-resources/ip-government-toolkit",
        "https://business.gov.au/grants-and-programs/patent-box",
        "https://www.ipaustralia.gov.au/about/what-we-do",
    ]

    known_programs = [
        {
            "title": "Patent Box Tax Incentive",
            "url": "https://business.gov.au/grants-and-programs/patent-box",
            "description": "The patent box tax incentive reduces the corporate tax rate to 17% on income earned from Australian medical and biotech patents (Australian Standard Patent).",
            "eligibility": "Companies holding Australian Standard Patents for medical/biotech inventions",
            "amount_text": "Reduced corporate tax rate (17%)",
            "industries": ["Healthcare", "Technology", "Research"],
            "sizes": ["Small", "Medium", "Large"],
            "grant_type": "tax_incentive",
        },
        {
            "title": "R&D Tax Incentive",
            "url": "https://business.gov.au/grants-and-programs/research-and-development-tax-incentive",
            "description": "The R&D Tax Incentive encourages companies to engage in R&D through a tax offset for eligible R&D expenditure. Small companies get a 43.5% refundable offset, larger companies get 38.5%.",
            "eligibility": "Australian companies conducting eligible R&D activities in Australia with aggregated turnover under $20M (for refundable offset)",
            "amount_text": "43.5% refundable tax offset (small companies) or 38.5% non-refundable (larger)",
            "industries": ["Research", "Technology", "Manufacturing", "Healthcare"],
            "sizes": ["Small", "Medium", "Large"],
            "grant_type": "tax_incentive",
        },
    ]

    seen = set()
    for prog in known_programs:
        seen.add(prog["title"])
        grants.append(make_grant(
            prefix="ip_au",
            title=prog["title"],
            url=prog["url"],
            source="ipaustralia.gov.au",
            description=prog["description"],
            eligibility=prog.get("eligibility", ""),
            amount_text=prog["amount_text"],
            status="open",
            category="federal",
            states=["National"],
            industries=prog.get("industries"),
            sizes=prog.get("sizes"),
            grant_type=prog.get("grant_type", "grant"),
        ))

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin("https://www.ipaustralia.gov.au", href)
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "incentive", "commerciali"]):
                seen.add(title)
                grants.append(make_grant(
                    prefix="ip_au",
                    title=title,
                    url=full_url,
                    source="ipaustralia.gov.au",
                    status="open",
                    category="federal",
                    states=["National"],
                    industries=["Research", "Technology"],
                ))

    logger.info(f"  IP Australia: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 14. Queensland Innovation & Startup (additional QLD)
# ════════════════════════════════════════════════════════════════════════════

def scrape_qld_innovation() -> List[Dict]:
    """Additional QLD innovation/startup grants beyond the base QLD scraper."""
    logger.info("Scraping QLD Innovation grants...")
    grants = []

    pages = [
        "https://www.business.qld.gov.au/running-business/growing-business/becoming-innovative/grants",
        "https://www.business.qld.gov.au/industries/startup-business",
        "https://ignite.ideas.com/en/programs",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        base = "https://www.business.qld.gov.au" if "qld.gov.au" in page_url else "https://ignite.ideas.com"

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin(base, href)
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "initiative", "startup", "innovation"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="qld_innov",
                    title=title,
                    url=full_url,
                    source="business.qld.gov.au",
                    description=desc,
                    status="open",
                    category="state",
                    states=["QLD"],
                    industries=detect_industries(f"{title} {desc}"),
                    sizes=["Startup", "Small", "Medium"],
                ))

    logger.info(f"  QLD Innovation: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 15. Advance Queensland (incl. Ignite Ideas Fund)
# ════════════════════════════════════════════════════════════════════════════

def scrape_advance_qld() -> List[Dict]:
    """Advance Queensland programs — Ignite Ideas Fund and others."""
    logger.info("Scraping Advance Queensland...")
    grants = []

    known_programs = [
        {
            "title": "Ignite Ideas Fund",
            "url": "https://advance.qld.gov.au/ignite-ideas-fund",
            "description": "The Ignite Ideas Fund supports Queensland entrepreneurs and small businesses to develop, test and commercialise innovative products, services or processes.",
            "eligibility": "Queensland businesses and entrepreneurs with an innovative idea, product or service",
            "amount_text": "Up to $125,000",
            "sizes": ["Startup", "Small"],
            "industries": ["Technology", "Research"],
        },
        {
            "title": "Advance Queensland Innovation Partnerships",
            "url": "https://advance.qld.gov.au/innovation-partnerships",
            "description": "Co-investment program connecting Queensland industry with universities and research institutions for collaborative R&D projects.",
            "eligibility": "Queensland businesses partnering with a Queensland university or research organisation",
            "amount_text": "Up to $200,000",
            "sizes": ["Small", "Medium", "Large"],
            "industries": ["Research", "Technology", "Manufacturing"],
        },
    ]

    seen = set()
    for prog in known_programs:
        seen.add(prog["title"])
        grants.append(make_grant(
            prefix="advance_qld",
            title=prog["title"],
            url=prog["url"],
            source="advance.qld.gov.au",
            description=prog["description"],
            eligibility=prog.get("eligibility", ""),
            amount_text=prog["amount_text"],
            status="open",
            category="state",
            states=["QLD"],
            industries=prog.get("industries"),
            sizes=prog.get("sizes"),
        ))

    # Try scraping live
    for page_url in ["https://advance.qld.gov.au/funding", "https://advance.qld.gov.au/"]:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin("https://advance.qld.gov.au", href)
            if "advance.qld.gov.au" not in full_url:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "initiative", "ignite"]):
                seen.add(title)
                grants.append(make_grant(
                    prefix="advance_qld",
                    title=title,
                    url=full_url,
                    source="advance.qld.gov.au",
                    status="open",
                    category="state",
                    states=["QLD"],
                    industries=["Technology", "Research"],
                    sizes=["Startup", "Small"],
                ))

    logger.info(f"  Advance Queensland: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 16. SA Innovation — FIXE and other SA programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_sa_innovation() -> List[Dict]:
    """South Australia innovation and industry grants."""
    logger.info("Scraping SA Innovation grants...")
    grants = []

    pages = [
        "https://www.industry.sa.gov.au/programs-and-support",
        "https://www.dit.sa.gov.au/industry_and_trade/business/grants_and_funding",
        "https://www.invest.sa.gov.au/funding-opportunities",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        base = "https://" + urlparse(page_url).netloc

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin(base, href)
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "incentive", "support", "invest"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="sa_innov",
                    title=title,
                    url=full_url,
                    source="industry.sa.gov.au",
                    description=desc,
                    status="open",
                    category="state",
                    states=["SA"],
                    industries=detect_industries(f"{title} {desc}"),
                    sizes=["Small", "Medium"],
                ))

    # Hardcoded core SA programs
    if not grants:
        known = [
            {
                "title": "SA Small Business Grants",
                "url": "https://www.sa.gov.au/topics/business-and-trade/business-grants",
                "description": "South Australian government grants for small businesses across a range of industries and purposes including export, innovation, and workforce development.",
                "industries": ["General"],
                "sizes": ["Small", "Medium"],
            },
            {
                "title": "Investment Attraction South Australia",
                "url": "https://www.invest.sa.gov.au/",
                "description": "InvestSA assists businesses investing in South Australia with co-investment support, site selection, and connections to government programs.",
                "industries": ["General"],
                "sizes": ["Small", "Medium", "Large"],
            },
            {
                "title": "SA Research and Innovation Fund",
                "url": "https://www.sa.gov.au/topics/business-and-trade/innovation",
                "description": "Funding for South Australian businesses and research institutions to collaborate on innovative projects that create jobs and economic growth.",
                "amount_text": "Up to $250,000",
                "industries": ["Research", "Technology", "Manufacturing"],
                "sizes": ["Small", "Medium"],
            },
        ]
        for k in known:
            grants.append(make_grant(
                prefix="sa_innov",
                title=k["title"],
                url=k["url"],
                source="industry.sa.gov.au",
                description=k["description"],
                amount_text=k.get("amount_text", ""),
                status="open",
                category="state",
                states=["SA"],
                industries=k.get("industries", ["General"]),
                sizes=k.get("sizes", ["All"]),
            ))

    logger.info(f"  SA Innovation: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 17. Grains Research & Development Corporation (GRDC)
# ════════════════════════════════════════════════════════════════════════════

def scrape_grdc() -> List[Dict]:
    """GRDC — grains industry R&D investment programs."""
    logger.info("Scraping GRDC...")
    grants = []

    pages = [
        "https://grdc.com.au/research/programs",
        "https://grdc.com.au/about/investment",
        "https://grdc.com.au/grains-research/co-investment",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin("https://grdc.com.au", href)
            if "grdc.com.au" not in full_url:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "invest", "research", "co-invest"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="grdc",
                    title=title,
                    url=full_url,
                    source="grdc.com.au",
                    description=desc,
                    status="open",
                    category="agriculture",
                    states=["National"],
                    industries=["Agriculture", "Research"],
                    sizes=["All"],
                ))

    # Hardcoded known programs (site often returns 403)
    known = [
        {
            "title": "GRDC Grains Research Grants",
            "url": "https://grdc.com.au/research/programs",
            "description": "GRDC invests in R&D for the Australian grains industry covering wheat, barley, canola, pulses and more. Co-investment opportunities for researchers and agribusinesses.",
            "amount_text": "Variable — competitive grants",
            "industries": ["Agriculture", "Research"],
        },
        {
            "title": "GRDC International Programs Fund",
            "url": "https://grdc.com.au/research/international",
            "description": "Supports Australian grains researchers to participate in international R&D collaborations that benefit the Australian industry.",
            "amount_text": "Up to $500,000",
            "industries": ["Agriculture", "Research", "Export"],
        },
    ]
    for k in known:
        if k["title"] not in seen:
            seen.add(k["title"])
            grants.append(make_grant(
                prefix="grdc",
                title=k["title"],
                url=k["url"],
                source="grdc.com.au",
                description=k["description"],
                amount_text=k.get("amount_text", ""),
                status="open",
                category="agriculture",
                states=["National"],
                industries=k.get("industries", ["Agriculture"]),
                sizes=["All"],
            ))

    logger.info(f"  GRDC: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 18. Energy Efficiency / Clean Energy programs (ARENA already in statescrapers)
#     Clean Energy Finance Corporation (CEFC)
# ════════════════════════════════════════════════════════════════════════════

def scrape_cefc() -> List[Dict]:
    """CEFC — Clean Energy Finance Corporation programs."""
    logger.info("Scraping CEFC programs...")

    known_programs = [
        {
            "title": "CEFC Clean Energy Loans",
            "url": "https://www.cefc.com.au/how-we-invest/finance-options/",
            "description": "The CEFC provides debt finance and structured finance solutions for clean energy, energy efficiency, and low-emissions projects across all sectors.",
            "eligibility": "Businesses investing in eligible clean energy, energy efficiency or low-emissions technology projects",
            "amount_text": "$500,000 and above",
            "industries": ["Energy", "Manufacturing", "Agriculture", "Transport"],
            "grant_type": "loan",
        },
        {
            "title": "CEFC Agri Finance",
            "url": "https://www.cefc.com.au/how-we-invest/sectors/agriculture/",
            "description": "Specialised finance for Australian farmers and agribusinesses to adopt clean energy, energy efficiency and emissions reduction technologies.",
            "eligibility": "Australian farmers, agribusinesses, and rural property owners",
            "amount_text": "From $50,000",
            "industries": ["Agriculture", "Energy"],
            "grant_type": "loan",
        },
    ]

    grants = []
    for prog in known_programs:
        grants.append(make_grant(
            prefix="cefc",
            title=prog["title"],
            url=prog["url"],
            source="cefc.com.au",
            description=prog["description"],
            eligibility=prog.get("eligibility", ""),
            amount_text=prog["amount_text"],
            status="open",
            category="energy",
            states=["National"],
            industries=prog.get("industries"),
            sizes=["All"],
            grant_type=prog.get("grant_type", "loan"),
        ))

    logger.info(f"  CEFC: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 19. Hort Innovation — horticulture industry R&D
# ════════════════════════════════════════════════════════════════════════════

def scrape_hort_innovation() -> List[Dict]:
    """Hort Innovation — horticulture industry R&D and marketing programs."""
    logger.info("Scraping Hort Innovation...")
    grants = []

    pages = [
        "https://www.horticulture.com.au/growers/funding-consulting-investing/",
        "https://www.horticulture.com.au/research-and-development/",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin("https://www.horticulture.com.au", href)
            if "horticulture.com.au" not in full_url:
                continue
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "invest", "research"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                grants.append(make_grant(
                    prefix="hort_innov",
                    title=title,
                    url=full_url,
                    source="horticulture.com.au",
                    description=desc,
                    status="open",
                    category="agriculture",
                    states=["National"],
                    industries=["Agriculture", "Food & Beverage"],
                    sizes=["All"],
                ))

    logger.info(f"  Hort Innovation: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 20. Tourism Australia / State Tourism Grants
# ════════════════════════════════════════════════════════════════════════════

def scrape_tourism_grants() -> List[Dict]:
    """Tourism Australia and state tourism authority grant programs."""
    logger.info("Scraping Tourism grants...")
    grants = []

    pages = [
        "https://www.tourism.australia.com/en/resources/industry-resources/grants-and-programs.html",
        "https://www.destinationnsw.com.au/industry-development/grants",
        "https://www.visitvictoria.com/industry/grants-and-awards",
        "https://www.queensland.com/au/en/plan-your-holiday/travel-trade/industry-news-grants.html",
        "https://tourism.sa.gov.au/industry/funding-and-grants",
    ]

    seen = set()

    for page_url in pages:
        r = get(page_url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        base = "https://" + urlparse(page_url).netloc

        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 10 or title in seen:
                continue
            full_url = href if href.startswith("http") else urljoin(base, href)
            if any(kw in (title + href).lower() for kw in ["grant", "fund", "program", "support", "award", "initiative"]):
                seen.add(title)
                parent = a.find_parent(["li", "div", "article"])
                desc = ""
                if parent:
                    p = parent.find("p")
                    if p:
                        desc = clean(p.get_text())[:500]
                states = detect_states(f"{page_url} {title}")
                grants.append(make_grant(
                    prefix="tourism",
                    title=title,
                    url=full_url,
                    source=urlparse(page_url).netloc,
                    description=desc,
                    status="open",
                    category="tourism",
                    states=states,
                    industries=["Tourism"],
                    sizes=["Small", "Medium"],
                ))

    # Hardcoded known tourism grants
    if not grants:
        known = [
            {
                "title": "Destination NSW – Tourism Industry Development Fund",
                "url": "https://www.destinationnsw.com.au/industry/grants-and-programs",
                "description": "Supports NSW tourism businesses and regional tourism organisations to develop and market visitor experiences that grow overnight visitation.",
                "amount_text": "Up to $100,000",
                "states": ["NSW"],
                "industries": ["Tourism"],
                "sizes": ["Small", "Medium"],
            },
            {
                "title": "Visit Victoria – Regional Events Fund",
                "url": "https://www.visitvictoria.com/industry/grants",
                "description": "Supports the development of new or growing events in regional Victoria that attract visitors and boost local economies.",
                "amount_text": "$10,000 to $250,000",
                "states": ["VIC"],
                "industries": ["Tourism", "Arts"],
                "sizes": ["Small", "Medium", "Non-profit"],
            },
            {
                "title": "Queensland Tourism Industry Development Fund",
                "url": "https://www.tiq.qld.gov.au/",
                "description": "Tourism and Events Queensland provides funding to develop new tourism product and experiences in Queensland.",
                "amount_text": "Variable",
                "states": ["QLD"],
                "industries": ["Tourism"],
                "sizes": ["Small", "Medium"],
            },
            {
                "title": "SA Tourism Commission – Industry Development Program",
                "url": "https://tourism.sa.gov.au/industry/funding-and-programs",
                "description": "Supports South Australian tourism businesses and regions to develop new experiences, infrastructure and marketing.",
                "amount_text": "Variable",
                "states": ["SA"],
                "industries": ["Tourism"],
                "sizes": ["Small", "Medium"],
            },
            {
                "title": "Tourism WA – Industry Development Program",
                "url": "https://www.tourism.wa.gov.au/Industry-resources/Grants-and-funding/",
                "description": "Supports Western Australian tourism businesses and regions to develop tourism products, experiences, and destination marketing.",
                "amount_text": "Variable",
                "states": ["WA"],
                "industries": ["Tourism"],
                "sizes": ["Small", "Medium"],
            },
        ]
        for k in known:
            grants.append(make_grant(
                prefix="tourism",
                title=k["title"],
                url=k["url"],
                source="tourism.gov.au",
                description=k["description"],
                amount_text=k.get("amount_text", ""),
                status="open",
                category="tourism",
                states=k.get("states", ["National"]),
                industries=k.get("industries", ["Tourism"]),
                sizes=k.get("sizes", ["All"]),
            ))

    logger.info(f"  Tourism: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# Main orchestrator
# ════════════════════════════════════════════════════════════════════════════

SCRAPERS = [
    ("CSIRO Kick-Start", scrape_csiro),
    ("Austrade EMDG", scrape_austrade),
    ("Community Grants Hub", scrape_community_grants_hub),
    ("Industry.gov.au", scrape_industry_gov),
    ("MRFF Health", scrape_mrff),
    ("Creative Australia", scrape_creative_australia),
    ("Sport Australia", scrape_sport_australia),
    ("Defence Innovation Hub", scrape_defence),
    ("AgriFutures", scrape_agrifutures),
    ("LaunchVic", scrape_launchvic),
    ("Wine Australia", scrape_wine_australia),
    ("MLA Livestock", scrape_mla),
    ("IP Australia", scrape_ip_australia),
    ("QLD Innovation", scrape_qld_innovation),
    ("Advance Queensland", scrape_advance_qld),
    ("SA Innovation", scrape_sa_innovation),
    ("GRDC Grains", scrape_grdc),
    ("CEFC Clean Energy", scrape_cefc),
    ("Hort Innovation", scrape_hort_innovation),
    ("Tourism Grants", scrape_tourism_grants),
]


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    print("\n" + "=" * 60)
    print("🇦🇺  FEDERAL & INDUSTRY SCRAPERS — Supplementary Sources")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    all_grants: List[Dict] = []
    source_counts: Dict[str, int] = {}

    for name, scraper_fn in SCRAPERS:
        print(f"\n--- {name} ---")
        try:
            results = scraper_fn()
            all_grants.extend(results)
            source_counts[name] = len(results)
        except Exception as e:
            logger.error(f"  {name} failed: {e}")
            source_counts[name] = 0

    # Deduplicate by title
    seen = set()
    unique = []
    for g in all_grants:
        key = g["title"].lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(g)

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(unique)} unique grants from {len(SCRAPERS)} sources")
    print(f"{'=' * 60}")
    for name, count in source_counts.items():
        print(f"  {name:<35} {count:>4}")

    # Save locally
    out_file = "federalscrapers_data.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(unique, f, indent=2, ensure_ascii=False)
    print(f"\n📁 Saved to {out_file}")

    # Push to Supabase
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        print(f"\n📤 Pushing {len(unique)} grants to Supabase...")
        pushed = push_to_supabase(unique)
        print(f"✅ Pushed {pushed}/{len(unique)} grants")
    else:
        print("\n⚠️  No Supabase credentials — skipped push")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
