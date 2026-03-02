"""
Australian Government Grant Scraper v2 — Comprehensive
=========================================================
Scrapes grants from ALL major Australian government sources:

FEDERAL:
  - business.gov.au (grants & programs finder)
  - grants.gov.au (GrantConnect — centralised federal grants)
  - communitygrants.gov.au (Community Grants Hub)

STATE / TERRITORY:
  - NSW: nsw.gov.au/grants-and-funding
  - VIC: business.vic.gov.au/grants-and-programs
  - QLD: business.qld.gov.au/starting-business/advice-support/grants
  - SA:  sa.gov.au/topics/business-and-trade/business-grants
  - WA:  smallbusiness.wa.gov.au/grants + wa.gov.au grants register
  - TAS: business.tas.gov.au/funding
  - NT:  nt.gov.au business grants
  - ACT: business.act.gov.au grants

INDUSTRY-SPECIFIC:
  - ARENA (Australian Renewable Energy Agency)
  - CSIRO Kick-Start
  - AusIndustry / Industry Growth Program
  - Export Market Development Grants (EMDG)

Usage:
    pip install requests beautifulsoup4 lxml
    python scraper.py [--source SOURCE] [--state STATE] [--enrich]

Output:
    - grants_data.csv
    - grants_data.json
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import re
import argparse
import os
from datetime import datetime
from urllib.parse import urljoin, urlencode, urlparse
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional, List

# --- Config ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "GrantFinder-Research/2.0 (Australian Grant Matching Service; hello@grantfinder.com.au)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
}

# --- Supabase config (set via environment variables) ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

REQUEST_DELAY = 2  # Seconds between requests — be respectful
MAX_RETRIES = 3
OUTPUT_CSV = "grants_data.csv"
OUTPUT_JSON = "grants_data.json"


# =============================================================================
# GRANT DATA MODEL
# =============================================================================

@dataclass
class Grant:
    id: str = ""
    title: str = ""
    description: str = ""
    source: str = ""           # Which website
    source_url: str = ""       # Direct link
    amount_min: Optional[int] = None
    amount_max: Optional[int] = None
    amount_text: str = ""
    eligibility_summary: str = ""
    industries: str = ""       # Comma-separated
    states: str = ""           # Comma-separated or "National"
    business_sizes: str = ""   # Comma-separated
    grant_type: str = ""       # grant, loan, rebate, tax_incentive
    status: str = ""           # open, closed, upcoming, ongoing, unknown
    open_date: str = ""
    close_date: str = ""
    application_url: str = ""
    category: str = ""         # business, community, research, export, energy, etc.
    funding_body: str = ""     # Which department/agency
    scraped_at: str = ""

    def to_dict(self):
        return asdict(self)


GRANT_FIELDS = list(Grant.__dataclass_fields__.keys())


# =============================================================================
# HTTP UTILITIES
# =============================================================================

def make_request(url, retries=MAX_RETRIES, delay=REQUEST_DELAY):
    """Make a polite HTTP request with retries and rate limiting."""
    for attempt in range(retries):
        try:
            time.sleep(delay)
            response = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logger.warning(f"Request failed (attempt {attempt+1}/{retries}): {url} — {e}")
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))  # Exponential backoff
    logger.error(f"All retries failed for: {url}")
    return None


def clean_text(text):
    """Clean up scraped text."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_amount(text):
    """Extract min/max dollar amounts from text."""
    if not text:
        return None, None
    amounts = re.findall(r"\$[\d,]+(?:\.\d{2})?", str(text))
    amounts = [int(a.replace("$", "").replace(",", "").split(".")[0]) for a in amounts]
    if len(amounts) >= 2:
        return min(amounts), max(amounts)
    elif len(amounts) == 1:
        return amounts[0], amounts[0]

    # Try "X million" pattern
    millions = re.findall(r"(\d+(?:\.\d+)?)\s*million", str(text), re.IGNORECASE)
    if millions:
        amounts = [int(float(m) * 1_000_000) for m in millions]
        if len(amounts) >= 2:
            return min(amounts), max(amounts)
        elif len(amounts) == 1:
            return amounts[0], amounts[0]

    return None, None


def detect_status(text):
    """Detect grant status from page text."""
    text_lower = text.lower()[:2000]
    if any(kw in text_lower for kw in ["applications closed", "this grant is closed", "no longer accepting"]):
        return "closed"
    elif any(kw in text_lower for kw in ["apply now", "applications open", "currently open", "accepting applications"]):
        return "open"
    elif any(kw in text_lower for kw in ["coming soon", "opening soon", "will open"]):
        return "upcoming"
    elif any(kw in text_lower for kw in ["ongoing", "apply any time", "open year-round", "year round"]):
        return "ongoing"
    return "unknown"


def detect_industries(text):
    """Detect relevant industries from content."""
    text_lower = text.lower()
    industry_map = {
        "Agriculture": ["agriculture", "farming", "agri", "pastoral", "horticulture"],
        "Manufacturing": ["manufacturing", "manufacturer", "made in australia"],
        "Technology": ["technology", "tech", "software", "digital", "IT", "cyber", "ai ", "artificial intelligence"],
        "Construction": ["construction", "building", "trade", "trades"],
        "Healthcare": ["health", "medical", "healthcare", "biotech", "pharmaceutical"],
        "Education": ["education", "training", "skills"],
        "Tourism": ["tourism", "hospitality", "visitor"],
        "Retail": ["retail", "shop", "e-commerce"],
        "Energy": ["energy", "renewable", "solar", "clean energy", "hydrogen", "battery"],
        "Mining": ["mining", "resources", "minerals"],
        "Defence": ["defence", "defense", "military"],
        "Export": ["export", "international trade", "trade mission"],
        "Research": ["research", "r&d", "innovation", "science"],
        "Arts": ["arts", "creative", "cultural", "heritage"],
        "Environment": ["environment", "sustainability", "climate", "waste", "recycling"],
        "Transport": ["transport", "logistics", "freight", "shipping"],
        "Space": ["space", "satellite", "aerospace"],
        "Food & Beverage": ["food", "beverage", "wine", "brewery"],
    }
    found = []
    for industry, keywords in industry_map.items():
        if any(kw in text_lower for kw in keywords):
            found.append(industry)
    return ",".join(found) if found else "General"


def detect_business_sizes(text):
    """Detect applicable business sizes from content."""
    text_lower = text.lower()
    size_map = {
        "Sole Trader": ["sole trader", "sole proprietor"],
        "Micro": ["micro business", "micro-business"],
        "Small": ["small business", "small to medium", "sme"],
        "Medium": ["medium business", "medium enterprise"],
        "Large": ["large business", "large enterprise", "corporation"],
        "Startup": ["startup", "start-up", "early stage", "early-stage"],
        "Non-profit": ["non-profit", "nonprofit", "not-for-profit", "charity", "charities"],
        "Aboriginal": ["aboriginal", "indigenous", "first nations", "torres strait"],
    }
    found = []
    for size, keywords in size_map.items():
        if any(kw in text_lower for kw in keywords):
            found.append(size)
    return ",".join(found) if found else "All"


def detect_grant_type(text):
    """Detect the type of grant/funding."""
    text_lower = text.lower()[:2000]
    if "loan" in text_lower:
        return "loan"
    elif "tax incentive" in text_lower or "tax offset" in text_lower:
        return "tax_incentive"
    elif "rebate" in text_lower:
        return "rebate"
    elif "voucher" in text_lower:
        return "voucher"
    elif "scholarship" in text_lower:
        return "scholarship"
    elif "subsidy" in text_lower or "subsidies" in text_lower:
        return "subsidy"
    return "grant"


def extract_dates(text):
    """Extract dates from text."""
    date_pattern = r"(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})"
    dates = re.findall(date_pattern, text, re.IGNORECASE)
    open_date = dates[0] if len(dates) >= 1 else ""
    close_date = dates[1] if len(dates) >= 2 else dates[0] if len(dates) == 1 else ""
    return open_date, close_date


def extract_eligibility(soup):
    """Extract eligibility section from a page."""
    for heading in soup.find_all(["h2", "h3", "h4"]):
        heading_text = heading.get_text().lower()
        if any(kw in heading_text for kw in ["eligib", "who can apply", "who is eligible", "are you eligible"]):
            parts = []
            for sibling in heading.find_next_siblings():
                if sibling.name in ["h2", "h3"]:
                    break
                parts.append(clean_text(sibling.get_text()))
            return " ".join(parts)[:1500]
    return ""


def generate_id(source_prefix, url):
    """Generate a deterministic ID from source and URL."""
    return f"{source_prefix}_{hash(url) % 1000000:06d}"


# =============================================================================
# SCRAPER: business.gov.au — Federal Grants Finder
# =============================================================================

class BusinessGovScraper:
    """Scrapes business.gov.au grants and programs finder."""

    BASE_URL = "https://business.gov.au"
    LISTING_URL = "https://business.gov.au/grants-and-programs"

    # business.gov.au has filter parameters we can use
    STATES = [
        "Australian+Capital+Territory", "New+South+Wales", "Northern+Territory",
        "Queensland", "South+Australia", "Tasmania", "Victoria", "Western+Australia"
    ]

    def scrape(self) -> List[Grant]:
        logger.info("=" * 50)
        logger.info("SCRAPING: business.gov.au (Federal)")
        logger.info("=" * 50)

        grant_links = set()

        # Scrape main listing page
        response = make_request(self.LISTING_URL)
        if response:
            grant_links.update(self._extract_grant_links(response.text))

        # Try filtered views to catch more
        for status in ["open", "closed"]:
            url = f"{self.LISTING_URL}?status={status}"
            response = make_request(url)
            if response:
                grant_links.update(self._extract_grant_links(response.text))

        logger.info(f"Found {len(grant_links)} unique grant links on business.gov.au")

        # Scrape each detail page
        grants = []
        for i, url in enumerate(grant_links):
            logger.info(f"  [{i+1}/{len(grant_links)}] Scraping: {url[:80]}...")
            grant = self._scrape_detail(url)
            if grant and grant.title:
                grants.append(grant)

        logger.info(f"Successfully scraped {len(grants)} grants from business.gov.au")
        return grants

    def _extract_grant_links(self, html):
        soup = BeautifulSoup(html, "lxml")
        links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/grants-and-programs/" in href and href != "/grants-and-programs/" and "#" not in href:
                full_url = urljoin(self.BASE_URL, href)
                # Skip pagination/filter links
                if "?" not in full_url or "grants-and-programs/" in full_url.split("?")[0]:
                    links.add(full_url.split("?")[0])  # Remove query params
        return links

    def _scrape_detail(self, url):
        response = make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, "lxml")
        full_text = soup.get_text()

        grant = Grant()
        grant.id = generate_id("bga", url)
        grant.source = "business.gov.au"
        grant.source_url = url
        grant.application_url = url
        grant.scraped_at = datetime.now().isoformat()

        # Title
        h1 = soup.find("h1")
        grant.title = clean_text(h1.get_text()) if h1 else ""

        # Description
        paragraphs = soup.find_all("p")
        desc_parts = [clean_text(p.get_text()) for p in paragraphs[:6] if len(clean_text(p.get_text())) > 40]
        grant.description = " ".join(desc_parts[:3])[:2000]

        # Amount
        amount_match = re.search(r"(\$[\d,]+(?:\s*(?:to|–|-|—)\s*\$[\d,]+)?(?:\s*(?:million|m))?)", full_text, re.IGNORECASE)
        if amount_match:
            grant.amount_text = amount_match.group(1).strip()
            grant.amount_min, grant.amount_max = parse_amount(grant.amount_text)

        # Other fields from content analysis
        grant.status = detect_status(full_text)
        grant.industries = detect_industries(full_text)
        grant.business_sizes = detect_business_sizes(full_text)
        grant.grant_type = detect_grant_type(full_text)
        grant.eligibility_summary = extract_eligibility(soup)
        grant.open_date, grant.close_date = extract_dates(full_text)

        # States detection
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
        found_states = []
        full_lower = full_text.lower()
        for state, kws in state_map.items():
            if any(kw in full_lower for kw in kws):
                found_states.append(state)
        grant.states = ",".join(found_states) if found_states and len(found_states) < 8 else "National"

        return grant


# =============================================================================
# SCRAPER: grants.gov.au (GrantConnect)
# =============================================================================

class GrantConnectScraper:
    """Scrapes GrantConnect — the centralised federal grants system."""

    LIST_URL = "https://www.grants.gov.au/go/list"

    def scrape(self) -> List[Grant]:
        logger.info("=" * 50)
        logger.info("SCRAPING: grants.gov.au (GrantConnect)")
        logger.info("=" * 50)

        response = make_request(self.LIST_URL)
        if not response:
            logger.warning("Could not access GrantConnect listing")
            return []

        soup = BeautifulSoup(response.text, "lxml")
        grants = []

        # GrantConnect lists grants in a table or card format
        # Look for grant opportunity links
        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = clean_text(link.get_text())

            if ("/go/show" in href.lower() or "/Go/Show" in href) and len(text) > 15:
                full_url = urljoin("https://www.grants.gov.au", href)

                grant = Grant()
                grant.id = generate_id("gc", full_url)
                grant.title = text
                grant.source = "grants.gov.au"
                grant.source_url = full_url
                grant.application_url = full_url
                grant.states = "National"
                grant.status = "open"  # Listed grants are usually open
                grant.scraped_at = datetime.now().isoformat()
                grant.category = "federal"
                grants.append(grant)

        # Also look for text blocks that describe grants
        for div in soup.find_all(["div", "tr", "li"]):
            text = clean_text(div.get_text())
            if len(text) > 50 and any(kw in text.lower() for kw in ["grant", "program", "fund"]):
                links_in_div = div.find_all("a", href=True)
                for a in links_in_div:
                    href = a["href"]
                    if "/go/show" in href.lower():
                        # Already captured above
                        break

        # Deduplicate
        seen = set()
        unique = []
        for g in grants:
            if g.title not in seen:
                seen.add(g.title)
                unique.append(g)

        logger.info(f"Found {len(unique)} grants on GrantConnect")
        return unique


# =============================================================================
# SCRAPER: Community Grants Hub
# =============================================================================

class CommunityGrantsScraper:
    """Scrapes communitygrants.gov.au."""

    BASE_URL = "https://www.communitygrants.gov.au"
    GRANTS_URL = "https://www.communitygrants.gov.au/grants"

    def scrape(self) -> List[Grant]:
        logger.info("=" * 50)
        logger.info("SCRAPING: communitygrants.gov.au")
        logger.info("=" * 50)

        response = make_request(self.GRANTS_URL)
        if not response:
            return []

        soup = BeautifulSoup(response.text, "lxml")
        grants = []

        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = clean_text(link.get_text())

            if "/grants/" in href and len(text) > 15 and href != "/grants/":
                full_url = urljoin(self.BASE_URL, href)

                grant = Grant()
                grant.id = generate_id("cgh", full_url)
                grant.title = text
                grant.source = "communitygrants.gov.au"
                grant.source_url = full_url
                grant.application_url = full_url
                grant.states = "National"
                grant.category = "community"
                grant.scraped_at = datetime.now().isoformat()
                grants.append(grant)

        seen = set()
        unique = [g for g in grants if g.title not in seen and not seen.add(g.title)]
        logger.info(f"Found {len(unique)} grants on Community Grants Hub")
        return unique


# =============================================================================
# STATE SCRAPERS — Generic base + specific implementations
# =============================================================================

class StateGrantScraper:
    """Base class for state grant portal scrapers."""

    def __init__(self, name, base_url, grants_url, state_code):
        self.name = name
        self.base_url = base_url
        self.grants_url = grants_url
        self.state_code = state_code

    def scrape(self) -> List[Grant]:
        logger.info("=" * 50)
        logger.info(f"SCRAPING: {self.name}")
        logger.info("=" * 50)

        response = make_request(self.grants_url)
        if not response:
            return []

        soup = BeautifulSoup(response.text, "lxml")
        grants = []

        # Generic extraction — find all grant-like links
        grant_keywords = ["grant", "fund", "program", "scheme", "rebate", "incentive",
                          "voucher", "subsidy", "loan", "support", "assistance"]

        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = clean_text(link.get_text())
            text_lower = text.lower()

            # Check if it looks like a grant link
            is_grant_link = any(kw in text_lower for kw in grant_keywords) and len(text) > 10
            # Also check URL patterns
            is_grant_url = any(kw in href.lower() for kw in ["grant", "fund", "program"])

            if (is_grant_link or is_grant_url) and len(text) > 10:
                full_url = urljoin(self.base_url, href)

                # Skip external links, anchors, and common non-grant pages
                if "#" in href and not href.startswith("http"):
                    continue
                if any(skip in href.lower() for skip in ["javascript:", "mailto:", ".pdf", "login", "register"]):
                    continue

                grant = Grant()
                grant.id = generate_id(self.state_code.lower(), full_url)
                grant.title = text
                grant.source = urlparse(self.grants_url).netloc
                grant.source_url = full_url
                grant.application_url = full_url
                grant.states = self.state_code
                grant.status = "unknown"
                grant.scraped_at = datetime.now().isoformat()
                grant.category = "state"
                grants.append(grant)

        # Deduplicate
        seen = set()
        unique = []
        for g in grants:
            key = g.title.lower().strip()
            if key not in seen and len(key) > 5:
                seen.add(key)
                unique.append(g)

        logger.info(f"Found {len(unique)} grants on {self.name}")
        return unique

    def enrich(self, grants, max_enrich=25) -> List[Grant]:
        """Visit detail pages to fill in more info."""
        logger.info(f"Enriching up to {max_enrich} grants from {self.name}...")
        for i, grant in enumerate(grants[:max_enrich]):
            if not grant.source_url:
                continue
            logger.info(f"  Enriching [{i+1}/{min(len(grants), max_enrich)}]: {grant.title[:50]}...")

            response = make_request(grant.source_url)
            if not response:
                continue

            soup = BeautifulSoup(response.text, "lxml")
            full_text = soup.get_text()

            if not grant.description:
                paragraphs = soup.find_all("p")
                desc_parts = [clean_text(p.get_text()) for p in paragraphs[:5]
                              if len(clean_text(p.get_text())) > 40]
                grant.description = " ".join(desc_parts[:3])[:2000]

            if not grant.amount_text:
                match = re.search(r"(\$[\d,]+(?:\s*(?:to|–|-|—)\s*\$[\d,]+)?(?:\s*(?:million|m))?)",
                                  full_text, re.IGNORECASE)
                if match:
                    grant.amount_text = match.group(1)
                    grant.amount_min, grant.amount_max = parse_amount(match.group(1))

            if grant.status == "unknown":
                grant.status = detect_status(full_text)

            if not grant.eligibility_summary:
                grant.eligibility_summary = extract_eligibility(soup)

            if not grant.industries or grant.industries == "General":
                grant.industries = detect_industries(full_text)

            if not grant.business_sizes or grant.business_sizes == "All":
                grant.business_sizes = detect_business_sizes(full_text)

            grant.grant_type = detect_grant_type(full_text)
            grant.open_date, grant.close_date = extract_dates(full_text)

        return grants


# --- State scraper instances ---

def get_state_scrapers():
    """Return configured scrapers for all states/territories."""
    return [
        StateGrantScraper(
            name="NSW Grants & Funding",
            base_url="https://www.nsw.gov.au",
            grants_url="https://www.nsw.gov.au/grants-and-funding",
            state_code="NSW"
        ),
        StateGrantScraper(
            name="Business Victoria Grants",
            base_url="https://business.vic.gov.au",
            grants_url="https://business.vic.gov.au/grants-and-programs",
            state_code="VIC"
        ),
        StateGrantScraper(
            name="Queensland Business Grants",
            base_url="https://www.business.qld.gov.au",
            grants_url="https://www.business.qld.gov.au/starting-business/advice-support/grants",
            state_code="QLD"
        ),
        StateGrantScraper(
            name="South Australia Grants",
            base_url="https://www.sa.gov.au",
            grants_url="https://www.sa.gov.au/topics/business-and-trade/business-grants",
            state_code="SA"
        ),
        StateGrantScraper(
            name="Western Australia Grants (SBDC)",
            base_url="https://www.smallbusiness.wa.gov.au",
            grants_url="https://www.smallbusiness.wa.gov.au/grants",
            state_code="WA"
        ),
        StateGrantScraper(
            name="WA Grants Register",
            base_url="https://www.wa.gov.au",
            grants_url="https://www.wa.gov.au/organisation/department-of-energy-and-economic-diversification/grants-assistance-and-programs-register-wa-industry",
            state_code="WA"
        ),
        StateGrantScraper(
            name="Business Tasmania Funding",
            base_url="https://www.business.tas.gov.au",
            grants_url="https://www.business.tas.gov.au/funding",
            state_code="TAS"
        ),
        StateGrantScraper(
            name="Tasmania State Growth Grants",
            base_url="https://www.stategrowth.tas.gov.au",
            grants_url="https://www.stategrowth.tas.gov.au/grants_and_funding_opportunities/grants/business_funding_programs",
            state_code="TAS"
        ),
        StateGrantScraper(
            name="NT Business Grants",
            base_url="https://nt.gov.au",
            grants_url="https://nt.gov.au/industry/business-grants-funding",
            state_code="NT"
        ),
        StateGrantScraper(
            name="ACT Business Grants",
            base_url="https://www.act.gov.au",
            grants_url="https://www.act.gov.au/business/business-support-and-grants",
            state_code="ACT"
        ),
    ]


# =============================================================================
# SCRAPER: Industry-Specific Sources
# =============================================================================

class IndustryGrantScraper:
    """Scrapes industry-specific grant sources."""

    SOURCES = [
        {
            "name": "ARENA (Renewable Energy)",
            "url": "https://arena.gov.au/funding/",
            "base_url": "https://arena.gov.au",
            "category": "energy",
            "prefix": "arena",
        },
        {
            "name": "CSIRO Kick-Start",
            "url": "https://www.csiro.au/en/work-with-us/funding-programs/programs/kick-start",
            "base_url": "https://www.csiro.au",
            "category": "research",
            "prefix": "csiro",
        },
        {
            "name": "Austrade Export Grants",
            "url": "https://www.austrade.gov.au/en/how-austrade-can-help-you/programs-and-incentives",
            "base_url": "https://www.austrade.gov.au",
            "category": "export",
            "prefix": "austrade",
        },
        {
            "name": "Queensland Innovation Grants",
            "url": "https://www.business.qld.gov.au/running-business/growing-business/becoming-innovative/grants",
            "base_url": "https://www.business.qld.gov.au",
            "category": "innovation",
            "prefix": "qld_innov",
        },
    ]

    def scrape(self) -> List[Grant]:
        logger.info("=" * 50)
        logger.info("SCRAPING: Industry-Specific Sources")
        logger.info("=" * 50)

        all_grants = []

        for source in self.SOURCES:
            logger.info(f"\n  Scraping {source['name']}...")
            response = make_request(source["url"])
            if not response:
                continue

            soup = BeautifulSoup(response.text, "lxml")
            grant_keywords = ["grant", "fund", "program", "scheme", "incentive", "support"]

            for link in soup.find_all("a", href=True):
                href = link["href"]
                text = clean_text(link.get_text())

                if len(text) > 10 and any(kw in text.lower() for kw in grant_keywords):
                    full_url = urljoin(source["base_url"], href)

                    if any(skip in href.lower() for skip in ["javascript:", "mailto:", "#", "login"]):
                        continue

                    grant = Grant()
                    grant.id = generate_id(source["prefix"], full_url)
                    grant.title = text
                    grant.source = urlparse(source["url"]).netloc
                    grant.source_url = full_url
                    grant.application_url = full_url
                    grant.states = "National"
                    grant.category = source["category"]
                    grant.scraped_at = datetime.now().isoformat()
                    all_grants.append(grant)

        # Deduplicate
        seen = set()
        unique = [g for g in all_grants if g.title.lower() not in seen and not seen.add(g.title.lower())]
        logger.info(f"Found {len(unique)} grants from industry sources")
        return unique


# =============================================================================
# DATA OUTPUT
# =============================================================================

def save_to_csv(grants, filename):
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GRANT_FIELDS)
        writer.writeheader()
        for grant in grants:
            writer.writerow(grant.to_dict())
    logger.info(f"Saved {len(grants)} grants to {filename}")


def save_to_json(grants, filename):
    data = [grant.to_dict() for grant in grants]
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(grants)} grants to {filename}")


def push_to_supabase(grants: List[Grant]) -> int:
    """Upsert scraped grants to Supabase. Returns count of grants pushed."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping push")
        return 0

    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    VALID_STATUSES = {"open", "closed", "ongoing", "upcoming", "unknown"}
    VALID_TYPES = {"grant", "loan", "rebate", "tax_incentive", "voucher", "subsidy", "scholarship"}

    def to_array(val: str) -> list:
        if not val:
            return []
        return [v.strip() for v in val.split(",") if v.strip()]

    BATCH_SIZE = 50
    total = 0

    for i in range(0, len(grants), BATCH_SIZE):
        batch = grants[i:i + BATCH_SIZE]
        payload = []

        for g in batch:
            payload.append({
                "id": g.id,
                "title": g.title[:500] if g.title else "",
                "source": g.source or "",
                "source_url": g.source_url or "",
                "amount_min": g.amount_min,
                "amount_max": g.amount_max,
                "amount_text": g.amount_text or "",
                "states": to_array(g.states) or ["National"],
                "industries": to_array(g.industries) or ["General"],
                "business_sizes": to_array(g.business_sizes) or ["All"],
                "status": g.status if g.status in VALID_STATUSES else "unknown",
                "close_date": g.close_date or None,
                "description": (g.description or "")[:2000],
                "eligibility": (g.eligibility_summary or "")[:1500],
                "grant_type": g.grant_type if g.grant_type in VALID_TYPES else "grant",
                "category": g.category or "federal",
                "url": g.application_url or g.source_url or "",
            })

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            resp.raise_for_status()
            total += len(batch)
            logger.info(f"  Pushed {len(batch)} grants (total: {total})")
        except requests.RequestException as e:
            logger.error(f"  Failed to push batch {i}–{i+BATCH_SIZE}: {e}")

    return total


def print_summary(grants):
    """Print a nice summary of scraped data."""
    print("\n" + "=" * 60)
    print("📊  SCRAPE SUMMARY")
    print("=" * 60)

    # By source
    sources = {}
    for g in grants:
        sources[g.source] = sources.get(g.source, 0) + 1
    print("\nBy Source:")
    for source, count in sorted(sources.items(), key=lambda x: -x[1]):
        print(f"  {source:45s} {count:4d}")

    # By state
    states = {}
    for g in grants:
        for s in g.states.split(","):
            s = s.strip()
            if s:
                states[s] = states.get(s, 0) + 1
    print("\nBy State/Territory:")
    for state, count in sorted(states.items(), key=lambda x: -x[1]):
        print(f"  {state:15s} {count:4d}")

    # By status
    statuses = {}
    for g in grants:
        statuses[g.status or "unknown"] = statuses.get(g.status or "unknown", 0) + 1
    print("\nBy Status:")
    for status, count in sorted(statuses.items(), key=lambda x: -x[1]):
        print(f"  {status:15s} {count:4d}")

    # By category
    categories = {}
    for g in grants:
        categories[g.category or "uncategorized"] = categories.get(g.category or "uncategorized", 0) + 1
    print("\nBy Category:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat:15s} {count:4d}")

    print(f"\n{'TOTAL UNIQUE GRANTS':45s} {len(grants):4d}")
    print(f"\n📁 Output: {OUTPUT_CSV}, {OUTPUT_JSON}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Australian Grant Scraper v2")
    parser.add_argument("--source", type=str, help="Scrape specific source only (e.g., 'federal', 'nsw', 'vic')")
    parser.add_argument("--state", type=str, help="Scrape specific state only (e.g., 'SA', 'QLD', 'NSW')")
    parser.add_argument("--enrich", action="store_true", help="Visit detail pages to enrich data (slower)")
    parser.add_argument("--max-enrich", type=int, default=25, help="Max grants to enrich per source")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("🇦🇺  AUSTRALIAN GRANT SCRAPER v2 — Comprehensive")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    all_grants = []

    # --- Federal Sources ---
    if not args.source or args.source in ["federal", "business.gov.au", "all"]:
        print("\n📡 Federal: business.gov.au...")
        scraper = BusinessGovScraper()
        all_grants.extend(scraper.scrape())

    if not args.source or args.source in ["federal", "grantconnect", "all"]:
        print("\n📡 Federal: grants.gov.au (GrantConnect)...")
        scraper = GrantConnectScraper()
        all_grants.extend(scraper.scrape())

    if not args.source or args.source in ["federal", "community", "all"]:
        print("\n📡 Federal: communitygrants.gov.au...")
        scraper = CommunityGrantsScraper()
        all_grants.extend(scraper.scrape())

    # --- State Sources ---
    state_scrapers = get_state_scrapers()
    for scraper in state_scrapers:
        state = scraper.state_code
        if args.state and state != args.state.upper():
            continue
        if args.source and args.source not in ["states", "all", state.lower()]:
            continue

        print(f"\n📡 State: {scraper.name}...")
        grants = scraper.scrape()
        if args.enrich:
            grants = scraper.enrich(grants, max_enrich=args.max_enrich)
        all_grants.extend(grants)

    # --- Industry Sources ---
    if not args.source or args.source in ["industry", "all"]:
        print("\n📡 Industry-specific sources...")
        scraper = IndustryGrantScraper()
        all_grants.extend(scraper.scrape())

    # --- Deduplicate globally by title ---
    seen_titles = set()
    unique_grants = []
    for g in all_grants:
        key = g.title.lower().strip()
        if key and key not in seen_titles and len(key) > 5:
            seen_titles.add(key)
            unique_grants.append(g)

    # --- Save locally ---
    save_to_csv(unique_grants, OUTPUT_CSV)
    save_to_json(unique_grants, OUTPUT_JSON)
    print_summary(unique_grants)

    # --- Push to Supabase ---
    print(f"\n📤 Pushing to Supabase...")
    pushed = push_to_supabase(unique_grants)
    if pushed:
        print(f"✅ Pushed {pushed} grants to Supabase")
    else:
        print("⚠️  Supabase push skipped (no credentials or error)")

    print(f"\n✅ Done! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🚀 Run again anytime to refresh. Use --enrich for richer data.\n")


if __name__ == "__main__":
    main()
