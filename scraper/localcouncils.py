"""
Local Council Grant Scrapers — Top 30 Australian Councils by Grant Budget
=========================================================================
Covers major councils across all states/territories.

Key insight: ~90% of Australian councils use SmartyGrants as their
application portal (subdomain.smartygrants.com.au). We scrape both
the SmartyGrants portal AND the council's own page for each.

Seed data is always present (accurate hardcoded programs). Live
scraping adds current open rounds on top.

Usage:
    python localcouncils.py
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

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
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


# ── Helpers ────────────────────────────────────────────────────────────────

def get(url: str, timeout: int = 20) -> Optional[requests.Response]:
    try:
        time.sleep(REQUEST_DELAY)
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        return r
    except Exception as e:
        logger.warning(f"GET {url[:80]} — {e}")
        return None


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def parse_amount(text: str):
    if not text:
        return None, None
    amounts = re.findall(r"\$[\d,]+(?:\.\d{2})?", str(text))
    vals = [int(a.replace("$", "").replace(",", "").split(".")[0]) for a in amounts]
    if len(vals) >= 2:
        return min(vals), max(vals)
    elif len(vals) == 1:
        return vals[0], vals[0]
    millions = re.findall(r"(\d+(?:\.\d+)?)\s*million", text, re.IGNORECASE)
    if millions:
        v = [int(float(m) * 1_000_000) for m in millions]
        return min(v), max(v)
    return None, None


def gid(prefix: str, url: str) -> str:
    return f"{prefix}_{hash(url) % 10000000:07d}"


def make_grant(
    prefix: str,
    title: str,
    url: str,
    council: str,
    state: str,
    description: str = "",
    eligibility: str = "",
    amount_text: str = "",
    status: str = "open",
    close_date: str = "",
    industries: Optional[List[str]] = None,
    sizes: Optional[List[str]] = None,
    grant_type: str = "grant",
) -> Dict:
    amount_min, amount_max = parse_amount(amount_text)
    return {
        "id": gid(prefix, url),
        "title": title[:500],
        "source": council,
        "source_url": url,
        "url": url,
        "amount_min": amount_min,
        "amount_max": amount_max,
        "amount_text": amount_text,
        "states": [state],
        "industries": industries or ["General"],
        "business_sizes": sizes or ["All"],
        "status": status,
        "close_date": close_date or "See website",
        "description": description[:2000],
        "eligibility": eligibility[:1500],
        "grant_type": grant_type,
        "category": "local",
    }


# ── SmartyGrants scraper ───────────────────────────────────────────────────

def scrape_smartygrants(subdomain: str, council_name: str, state: str, prefix: str) -> List[Dict]:
    """Scrape open grants from a council's SmartyGrants portal."""
    base = f"https://{subdomain}.smartygrants.com.au"
    r = get(base)
    if not r:
        return []

    soup = BeautifulSoup(r.text, "lxml")
    grants = []
    seen = set()

    # SmartyGrants lists open programs as links — find all that look like grant applications
    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = clean(a.get_text())
        if len(title) < 10:
            continue
        # SmartyGrants program links are typically short slugs or form paths
        if any(skip in href.lower() for skip in ["javascript:", "mailto:", "login", "register", "faq", "contact"]):
            continue
        if len(title) > 10 and not title.lower().startswith(("home", "about", "help", "contact", "faq", "login")):
            full_url = href if href.startswith("http") else urljoin(base, href)
            if title in seen:
                continue
            seen.add(title)

            # Try to find description near the link
            parent = a.find_parent(["li", "div", "article", "td", "p"])
            desc = ""
            if parent:
                p = parent.find("p")
                if p and clean(p.get_text()) != title:
                    desc = clean(p.get_text())[:500]

            # Look for dates nearby
            close_date = ""
            if parent:
                date_match = re.search(
                    r"(?:clos(?:es?|ing)|due|deadline)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})",
                    parent.get_text(), re.I
                )
                if date_match:
                    close_date = date_match.group(1)

            grants.append(make_grant(
                prefix=prefix,
                title=title,
                url=full_url,
                council=council_name,
                state=state,
                description=desc,
                close_date=close_date,
                status="open",
            ))

    return grants


# ── Council own-page scraper ────────────────────────────────────────────────

def scrape_council_page(url: str, council_name: str, state: str, prefix: str) -> List[Dict]:
    """Scrape a council's own grants page for links and summaries."""
    r = get(url)
    if not r:
        return []

    soup = BeautifulSoup(r.text, "lxml")
    base = "https://" + urlparse(url).netloc
    grants = []
    seen = set()

    keywords = ["grant", "fund", "program", "support", "scheme", "sponsorship", "initiative", "award"]

    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = clean(a.get_text())
        if len(title) < 10:
            continue
        if any(kw in (title + href).lower() for kw in keywords):
            if any(skip in href.lower() for skip in ["javascript:", "mailto:", "#", "login"]):
                continue
            full_url = href if href.startswith("http") else urljoin(base, href)
            if title in seen:
                continue
            seen.add(title)

            parent = a.find_parent(["li", "div", "article", "td"])
            desc = ""
            if parent:
                p = parent.find("p")
                if p:
                    desc = clean(p.get_text())[:500]

            amount_match = re.search(r"\$[\d,]+(?:,\d{3})*(?:\s*(?:to|–|-)\s*\$[\d,]+)?", f"{title} {desc}", re.I)
            amount_text = amount_match.group(0) if amount_match else ""

            grants.append(make_grant(
                prefix=prefix,
                title=title,
                url=full_url,
                council=council_name,
                state=state,
                description=desc,
                amount_text=amount_text,
                status="open",
            ))

    return grants


# ── Push to Supabase ────────────────────────────────────────────────────────

def push_to_supabase(grants: List[Dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase credentials not set — skipping push")
        return 0
    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    BATCH, total = 50, 0
    for i in range(0, len(grants), BATCH):
        batch = grants[i:i + BATCH]
        try:
            resp = requests.post(url, headers=headers, json=batch, timeout=30)
            resp.raise_for_status()
            total += len(batch)
        except Exception as e:
            logger.error(f"  Supabase batch failed: {e}")
    return total


# ════════════════════════════════════════════════════════════════════════════
# COUNCIL SEED DATA — accurate hardcoded programs as quality baseline
# ════════════════════════════════════════════════════════════════════════════

SEED_PROGRAMS = [

    # ── NSW ──────────────────────────────────────────────────────────────
    {
        "prefix": "sydney",
        "title": "City of Sydney — Creative Grants",
        "url": "https://www.cityofsydney.nsw.gov.au/grants-sponsorships/creative-grants",
        "council": "City of Sydney",
        "state": "NSW",
        "description": "Supports creative practitioners and organisations to produce high-quality creative work in the City of Sydney area, including visual art, performance, music, literature and screen.",
        "eligibility": "Creative practitioners and organisations working in or for the City of Sydney local area",
        "amount_text": "Up to $20,000",
        "industries": ["Arts"],
        "sizes": ["Small", "Non-profit"],
    },
    {
        "prefix": "sydney",
        "title": "City of Sydney — Community Grants",
        "url": "https://www.cityofsydney.nsw.gov.au/grants-sponsorships/community-grants",
        "council": "City of Sydney",
        "state": "NSW",
        "description": "Funding for community organisations to deliver services and programs that benefit residents of the City of Sydney. Supports social services, multicultural activities, seniors programs and more.",
        "eligibility": "Not-for-profit organisations delivering services to City of Sydney residents",
        "amount_text": "Up to $30,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "sydney",
        "title": "City of Sydney — Quick Response Grants",
        "url": "https://www.cityofsydney.nsw.gov.au/grants-sponsorships",
        "council": "City of Sydney",
        "state": "NSW",
        "description": "Small grants available year-round for unexpected or time-sensitive projects or events that benefit the local community. Fast turnaround for decisions.",
        "eligibility": "Community organisations and individuals in the City of Sydney area",
        "amount_text": "Up to $3,000",
        "industries": ["General"],
        "sizes": ["All"],
    },
    {
        "prefix": "sydney",
        "title": "City of Sydney — Festivals and Events Sponsorship",
        "url": "https://www.cityofsydney.nsw.gov.au/grants-sponsorships/festivals-events-sponsorship",
        "council": "City of Sydney",
        "state": "NSW",
        "description": "Sponsorship for festivals and public events that activate Sydney's streets, public spaces and venues, creating social connection and economic activity.",
        "eligibility": "Event organisers running public events in the City of Sydney local area",
        "amount_text": "$5,000 to $100,000",
        "industries": ["Arts", "Tourism"],
        "sizes": ["Small", "Medium", "Non-profit"],
    },
    {
        "prefix": "sydney",
        "title": "City of Sydney — Business Grants",
        "url": "https://www.cityofsydney.nsw.gov.au/business/business-support-resources/business-grants-funding",
        "council": "City of Sydney",
        "state": "NSW",
        "description": "Grants for businesses to activate and improve City of Sydney's business districts, support workforce development, and drive economic recovery.",
        "eligibility": "Businesses operating within the City of Sydney local government area",
        "amount_text": "Up to $50,000",
        "industries": ["General", "Tourism", "Retail"],
        "sizes": ["Small", "Medium"],
    },
    {
        "prefix": "parramatta",
        "title": "City of Parramatta — Community Grants",
        "url": "https://www.cityofparramatta.nsw.gov.au/community/grants",
        "council": "City of Parramatta",
        "state": "NSW",
        "description": "Annual grants for community organisations to deliver projects, programs and events that benefit Parramatta residents. Includes quarterly and annual rounds.",
        "eligibility": "Not-for-profit organisations serving the Parramatta LGA community",
        "amount_text": "$1,000 to $20,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "newcastle",
        "title": "City of Newcastle — Community Grants",
        "url": "https://newcastle.nsw.gov.au/community/grants-and-sponsorships/grants",
        "council": "City of Newcastle",
        "state": "NSW",
        "description": "Grants to help local community organisations deliver activities, events and projects that make Newcastle a great place to live.",
        "eligibility": "Not-for-profit organisations operating in the Newcastle LGA",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "wollongong",
        "title": "Wollongong City Council — Small Arts and Cultural Grants",
        "url": "https://wollongong.nsw.gov.au/book-and-apply/apply-for-a-grant",
        "council": "Wollongong City Council",
        "state": "NSW",
        "description": "Supports small-scale arts and cultural projects that benefit the Wollongong community. Open to local artists, arts organisations and cultural groups.",
        "eligibility": "Artists and cultural organisations in the Wollongong LGA",
        "amount_text": "Up to $5,000",
        "industries": ["Arts"],
        "sizes": ["All"],
    },

    # ── VIC ──────────────────────────────────────────────────────────────
    {
        "prefix": "melbourne",
        "title": "City of Melbourne — Business Growth and Impact Grants",
        "url": "https://www.melbourne.vic.gov.au/business-growth-impact-grants",
        "council": "City of Melbourne",
        "state": "VIC",
        "description": "Supports businesses in the City of Melbourne to grow, innovate and increase their economic and social impact. For businesses wanting to trial new approaches, access new markets or develop capabilities.",
        "eligibility": "Businesses operating in the City of Melbourne LGA with an ABN",
        "amount_text": "$5,000 to $50,000",
        "industries": ["General", "Technology", "Tourism", "Retail"],
        "sizes": ["Small", "Medium"],
    },
    {
        "prefix": "melbourne",
        "title": "City of Melbourne — Community Events Grants",
        "url": "https://www.melbourne.vic.gov.au/community-events-grants",
        "council": "City of Melbourne",
        "state": "VIC",
        "description": "Funding for events that activate Melbourne's public spaces and streets, celebrate community and culture, and bring people together.",
        "eligibility": "Organisations running events in the City of Melbourne LGA",
        "amount_text": "$5,000 to $50,000",
        "industries": ["Arts", "Tourism"],
        "sizes": ["Small", "Medium", "Non-profit"],
    },
    {
        "prefix": "melbourne",
        "title": "City of Melbourne — Connected Neighbourhood Small Grants",
        "url": "https://www.melbourne.vic.gov.au/connected-neighbourhood-small-grants",
        "council": "City of Melbourne",
        "state": "VIC",
        "description": "Small grants for neighbourhood projects that build community connections and help people feel at home in Melbourne.",
        "eligibility": "Residents and community organisations in the City of Melbourne",
        "amount_text": "Up to $5,000",
        "industries": ["General"],
        "sizes": ["All"],
    },
    {
        "prefix": "geelong",
        "title": "City of Greater Geelong — Community Grants",
        "url": "https://www.geelongaustralia.com.au/grants/",
        "council": "City of Greater Geelong",
        "state": "VIC",
        "description": "Annual grants program funding community organisations to deliver projects across arts, sport, environment, heritage, and social services in the Greater Geelong region.",
        "eligibility": "Not-for-profit organisations and community groups in the Greater Geelong LGA",
        "amount_text": "$500 to $20,000",
        "industries": ["General", "Arts", "Environment"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "yarra",
        "title": "Yarra City Council — Community Grants Program",
        "url": "https://www.yarracity.vic.gov.au/get-involved/community-grants/yarra-grants-program",
        "council": "Yarra City Council",
        "state": "VIC",
        "description": "Supports community-based projects that improve quality of life for Yarra residents, with focus on social inclusion, arts, environment and active living.",
        "eligibility": "Community organisations serving Yarra residents",
        "amount_text": "Up to $15,000",
        "industries": ["General", "Arts"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "monash",
        "title": "City of Monash — Community Grants Program",
        "url": "https://www.monash.vic.gov.au/Community/Grants-and-Funding/Community-Grants-Program",
        "council": "City of Monash",
        "state": "VIC",
        "description": "Annual grants to help local organisations deliver programs and projects that enhance community wellbeing, participation and social connection in Monash.",
        "eligibility": "Community organisations operating in the Monash LGA",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "wyndham",
        "title": "Wyndham City Council — Community Grants",
        "url": "https://www.wyndham.vic.gov.au/services/volunteering-grants/community-grants-program",
        "council": "Wyndham City Council",
        "state": "VIC",
        "description": "Grants for community organisations to deliver projects that strengthen Wyndham's communities, especially in a growing outer-western Melbourne area.",
        "eligibility": "Not-for-profit organisations serving Wyndham residents",
        "amount_text": "Small: up to $3,000; Medium: $3,001–$10,000; Large: $10,001–$30,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "frankston",
        "title": "Frankston City Council — Annual Community Grants",
        "url": "https://www.frankston.vic.gov.au/Community-and-Health/Grants-and-funding/Community-grants",
        "council": "Frankston City Council",
        "state": "VIC",
        "description": "Annual funding for community organisations to run projects, activities and events that benefit Frankston residents and build a stronger community.",
        "eligibility": "Not-for-profit organisations with projects benefiting the Frankston community",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },

    # ── QLD ──────────────────────────────────────────────────────────────
    {
        "prefix": "brisbane",
        "title": "Brisbane City Council — Lord Mayor's Community Fund",
        "url": "https://www.brisbane.qld.gov.au/community-and-safety/grants-awards-and-sponsorships",
        "council": "Brisbane City Council",
        "state": "QLD",
        "description": "Ward-based discretionary funding supporting local community groups and projects across Brisbane. Each ward councillor administers funding for their area.",
        "eligibility": "Community organisations and groups operating within Brisbane City Council wards",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "brisbane",
        "title": "Brisbane City Council — Community and Environment Grants",
        "url": "https://www.brisbane.qld.gov.au/community-and-safety/grants-awards-and-sponsorships/applying-for-a-grant/community-grants",
        "council": "Brisbane City Council",
        "state": "QLD",
        "description": "Grants for community organisations to run projects and activities that improve quality of life in Brisbane and deliver environmental outcomes.",
        "eligibility": "Not-for-profit organisations with projects benefiting Brisbane residents",
        "amount_text": "Up to $15,000",
        "industries": ["General", "Environment"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "goldcoast",
        "title": "Gold Coast City Council — Community Grants Program",
        "url": "https://www.goldcoast.qld.gov.au/Services/Supporting-our-community/Community-group-hub/Community-grants",
        "council": "Gold Coast City Council",
        "state": "QLD",
        "description": "Annual grants supporting Gold Coast community organisations to deliver projects, programs and events that build community wellbeing.",
        "eligibility": "Incorporated not-for-profit organisations based in or serving the Gold Coast",
        "amount_text": "$2,000 to $15,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "sunshinecoast",
        "title": "Sunshine Coast Council — Major Grants",
        "url": "https://www.sunshinecoast.qld.gov.au/living-and-community/grants-and-funding/grants-programs",
        "council": "Sunshine Coast Council",
        "state": "QLD",
        "description": "Major grants for significant community, arts, sport and environment projects on the Sunshine Coast that deliver broad community benefit.",
        "eligibility": "Not-for-profit organisations and community groups on the Sunshine Coast",
        "amount_text": "$5,000 to $30,000",
        "industries": ["General", "Arts", "Sport"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "townsville",
        "title": "Townsville City Council — Community Grants",
        "url": "https://www.townsville.qld.gov.au/community-support/grants-and-partnerships/community-grants",
        "council": "Townsville City Council",
        "state": "QLD",
        "description": "Annual grants to support Townsville community organisations in delivering projects and programs that strengthen community life in North Queensland.",
        "eligibility": "Not-for-profit organisations operating in Townsville",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "cairns",
        "title": "Cairns Regional Council — Community Partnerships Grants",
        "url": "https://www.cairns.qld.gov.au/online/apply/grants",
        "council": "Cairns Regional Council",
        "state": "QLD",
        "description": "Grants for community organisations to deliver projects that support the wellbeing and lifestyle of Cairns residents, including arts, sport, environment and social services.",
        "eligibility": "Incorporated not-for-profit organisations in the Cairns region",
        "amount_text": "Up to $10,000",
        "industries": ["General", "Arts"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "moreton",
        "title": "City of Moreton Bay — Community Grants",
        "url": "https://www.moretonbay.qld.gov.au/Services/Community-Support/Grants-and-Funding/Community-Grants",
        "council": "City of Moreton Bay",
        "state": "QLD",
        "description": "Grants for community organisations to deliver activities and projects that build stronger communities across the Moreton Bay region.",
        "eligibility": "Not-for-profit organisations serving Moreton Bay communities",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "logan",
        "title": "Logan City Council — Community Development Funding",
        "url": "https://www.logan.qld.gov.au/grants",
        "council": "Logan City Council",
        "state": "QLD",
        "description": "Grants and sponsorships supporting Logan community organisations to run events, programs and projects that build social connection and community wellbeing.",
        "eligibility": "Community organisations operating in Logan City",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "ipswich",
        "title": "Ipswich City Council — Community Funding and Support Program",
        "url": "https://www.ipswich.qld.gov.au/Services/Funding-and-Support",
        "council": "Ipswich City Council",
        "state": "QLD",
        "description": "Grants for community organisations to deliver projects and programs that benefit Ipswich residents. Includes major grants up to $15,000.",
        "eligibility": "Not-for-profit community organisations serving Ipswich residents",
        "amount_text": "Up to $15,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },

    # ── SA ───────────────────────────────────────────────────────────────
    {
        "prefix": "adelaide",
        "title": "City of Adelaide — Community Impact Grants",
        "url": "https://www.cityofadelaide.com.au/about-council/grants-sponsorship-incentives/community-impact-grants/",
        "council": "City of Adelaide",
        "state": "SA",
        "description": "Grants for community organisations to deliver projects that have a positive impact on Adelaide CBD residents and visitors. Supports wellbeing, inclusion, and community life.",
        "eligibility": "Not-for-profit organisations delivering projects that benefit the Adelaide CBD community",
        "amount_text": "Up to $20,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "adelaide",
        "title": "City of Adelaide — Arts and Cultural Grants",
        "url": "https://www.cityofadelaide.com.au/about-council/grants-sponsorship-incentives/arts-cultural-grants/",
        "council": "City of Adelaide",
        "state": "SA",
        "description": "Supports arts and cultural activities that enrich life in the Adelaide CBD, including visual arts, performing arts, music, literature and cultural festivals.",
        "eligibility": "Artists, arts organisations and cultural groups with projects in or benefiting the Adelaide CBD",
        "amount_text": "$2,000 to $30,000",
        "industries": ["Arts"],
        "sizes": ["All"],
    },
    {
        "prefix": "adelaide",
        "title": "City of Adelaide — Sustainability Incentives Scheme",
        "url": "https://www.cityofadelaide.com.au/about-council/grants-sponsorship-incentives/",
        "council": "City of Adelaide",
        "state": "SA",
        "description": "Incentives for Adelaide CBD businesses and residents to undertake sustainability improvements including energy efficiency, solar panels, water-saving measures and green infrastructure.",
        "eligibility": "Businesses and residents in the City of Adelaide LGA",
        "amount_text": "Up to $10,000",
        "industries": ["Energy", "Environment"],
        "sizes": ["Small", "Medium"],
    },
    {
        "prefix": "onkaparinga",
        "title": "City of Onkaparinga — Community Grants",
        "url": "https://www.onkaparingacity.com/Community-facilities-support/Grants",
        "council": "City of Onkaparinga",
        "state": "SA",
        "description": "Grants for community organisations in the Onkaparinga region to deliver projects and programs that build community capacity and wellbeing. $705,000 total annual budget.",
        "eligibility": "Not-for-profit organisations and community groups in the Onkaparinga LGA",
        "amount_text": "Variable — see website",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "salisbury",
        "title": "City of Salisbury — Active and Connected Community Grant",
        "url": "https://www.salisbury.sa.gov.au/council/grants-and-awards/grants/community-grants-2",
        "council": "City of Salisbury",
        "state": "SA",
        "description": "Supports projects that improve active participation, social connection and community wellbeing in Salisbury. Includes economic growth, sustainability and active living streams.",
        "eligibility": "Community organisations and businesses in the Salisbury LGA",
        "amount_text": "Up to $5,000",
        "industries": ["General", "Sport"],
        "sizes": ["Non-profit", "Small"],
    },
    {
        "prefix": "charlessturt",
        "title": "City of Charles Sturt — Business Support Program",
        "url": "https://www.charlessturt.sa.gov.au/business/business-grants-and-funding",
        "council": "City of Charles Sturt",
        "state": "SA",
        "description": "Grants and support for businesses in the Charles Sturt area including arts funding, event grants, and sponsorship for community activities.",
        "eligibility": "Businesses and community organisations in the City of Charles Sturt LGA",
        "amount_text": "Variable",
        "industries": ["General", "Arts"],
        "sizes": ["Small"],
    },
    {
        "prefix": "playford",
        "title": "City of Playford — Community Development Grants",
        "url": "https://www.playford.sa.gov.au/community/get-involved/grants-and-funding",
        "council": "City of Playford",
        "state": "SA",
        "description": "Small grants supporting community projects and events in Playford that promote community participation, social connection and local pride.",
        "eligibility": "Community organisations and groups in the City of Playford",
        "amount_text": "Up to $5,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },

    # ── WA ───────────────────────────────────────────────────────────────
    {
        "prefix": "perth",
        "title": "City of Perth — Local Activation Grants",
        "url": "https://perth.wa.gov.au/community/sponsorship-and-grants",
        "council": "City of Perth",
        "state": "WA",
        "description": "Grants for projects and events that activate Perth's CBD, bringing vibrancy and economic activity to the city centre.",
        "eligibility": "Businesses, community organisations, and individuals with projects in the Perth CBD",
        "amount_text": "Up to $20,000",
        "industries": ["General", "Tourism", "Arts"],
        "sizes": ["Small", "Non-profit"],
    },
    {
        "prefix": "perth",
        "title": "City of Perth — Heritage Adaptive Reuse Grants",
        "url": "https://perth.wa.gov.au/community/sponsorship-and-grants",
        "council": "City of Perth",
        "state": "WA",
        "description": "Supports property owners to adaptively reuse heritage buildings in the Perth CBD, preserving architectural character while enabling new economic uses.",
        "eligibility": "Property owners with heritage buildings in the City of Perth",
        "amount_text": "Up to $50,000",
        "industries": ["Construction", "Tourism"],
        "sizes": ["All"],
    },
    {
        "prefix": "stirling",
        "title": "City of Stirling — Community Grants Program",
        "url": "https://www.stirling.wa.gov.au/community-support/community-grants-program",
        "council": "City of Stirling",
        "state": "WA",
        "description": "Bi-annual grants supporting community groups to deliver projects that improve quality of life across Stirling. Two rounds per year, over $500,000 awarded annually.",
        "eligibility": "Not-for-profit organisations delivering projects for the Stirling community",
        "amount_text": "Up to $10,000",
        "industries": ["General", "Arts", "Sport"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "wanneroo",
        "title": "City of Wanneroo — Community Funding Program",
        "url": "https://www.wanneroo.wa.gov.au/communityfunding",
        "council": "City of Wanneroo",
        "state": "WA",
        "description": "Grants for community organisations to run projects, events and activities that strengthen Wanneroo's communities and support residents.",
        "eligibility": "Not-for-profit organisations and community groups in the Wanneroo LGA",
        "amount_text": "Variable — see website",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "fremantle",
        "title": "City of Fremantle — Arts Grants",
        "url": "https://www.fremantle.wa.gov.au/arts-and-culture/arts-in-fremantle/arts-grant/",
        "council": "City of Fremantle",
        "state": "WA",
        "description": "Supports Fremantle artists and arts organisations to create and present high-quality arts projects that engage the community and strengthen Fremantle's cultural identity.",
        "eligibility": "Artists and arts organisations with projects in or benefiting the Fremantle community",
        "amount_text": "Up to $10,000",
        "industries": ["Arts"],
        "sizes": ["All"],
    },
    {
        "prefix": "fremantle",
        "title": "City of Fremantle — Community and Youth Grants",
        "url": "https://www.fremantle.wa.gov.au/services-and-support/community-support/grants/",
        "council": "City of Fremantle",
        "state": "WA",
        "description": "Grants supporting community organisations and youth programs in Fremantle to promote wellbeing, inclusion and active participation.",
        "eligibility": "Not-for-profit organisations and community groups serving Fremantle residents",
        "amount_text": "Up to $5,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "rockingham",
        "title": "City of Rockingham — Community Grants Program",
        "url": "https://rockingham.wa.gov.au/events,-culture-and-tourism/grants-and-scholarships/community-grants-program",
        "council": "City of Rockingham",
        "state": "WA",
        "description": "Grants for community groups and organisations to support projects and activities that improve community wellbeing and participation in Rockingham.",
        "eligibility": "Community organisations operating in the City of Rockingham",
        "amount_text": "Up to $15,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },

    # ── TAS ──────────────────────────────────────────────────────────────
    {
        "prefix": "hobart",
        "title": "City of Hobart — Business Grants",
        "url": "https://www.hobartcity.com.au/Community/Grants-and-funding/Business-Grants",
        "council": "City of Hobart",
        "state": "TAS",
        "description": "Supports Hobart CBD businesses to innovate, grow, and contribute to a vibrant city centre economy. For projects that benefit the local business community.",
        "eligibility": "Businesses operating in the City of Hobart LGA with an ABN",
        "amount_text": "Up to $10,000",
        "industries": ["General", "Tourism", "Retail"],
        "sizes": ["Small"],
    },
    {
        "prefix": "hobart",
        "title": "City of Hobart — Creative Hobart Grants",
        "url": "https://www.hobartcity.com.au/Community/Grants-and-funding/Creative-Hobart-Grants",
        "council": "City of Hobart",
        "state": "TAS",
        "description": "Supports artists and arts organisations to create, develop and present work that enriches Hobart's cultural life and activates the city's creative spaces.",
        "eligibility": "Artists and arts organisations with projects in or benefiting the Hobart community",
        "amount_text": "Up to $10,000",
        "industries": ["Arts"],
        "sizes": ["All"],
    },
    {
        "prefix": "hobart",
        "title": "City of Hobart — Community Grants",
        "url": "https://www.hobartcity.com.au/Community/Grants-and-funding/Community-Grants",
        "council": "City of Hobart",
        "state": "TAS",
        "description": "Annual grants for Hobart community organisations to deliver projects and programs that build a connected, inclusive and healthy community.",
        "eligibility": "Not-for-profit organisations delivering projects for the Hobart community",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "hobart",
        "title": "City of Hobart — Event Grants",
        "url": "https://www.hobartcity.com.au/Community/Grants-and-funding/Event-Grants",
        "council": "City of Hobart",
        "state": "TAS",
        "description": "Supports community events and festivals that activate Hobart's public spaces, celebrate culture and diversity, and attract visitors to the city.",
        "eligibility": "Event organisers holding public events in the City of Hobart",
        "amount_text": "$1,000 to $20,000",
        "industries": ["Tourism", "Arts"],
        "sizes": ["Small", "Non-profit"],
    },

    # ── NT ───────────────────────────────────────────────────────────────
    {
        "prefix": "darwin",
        "title": "City of Darwin — Community Grants",
        "url": "https://www.darwin.nt.gov.au/community/programs/grants-sponsorship/community-grants",
        "council": "City of Darwin",
        "state": "NT",
        "description": "Twice-yearly grants supporting Darwin community organisations to deliver projects and programs that enhance community wellbeing and participation. Two rounds per year.",
        "eligibility": "Not-for-profit organisations and community groups in the Darwin municipality",
        "amount_text": "Up to $10,000",
        "industries": ["General"],
        "sizes": ["Non-profit"],
    },
    {
        "prefix": "darwin",
        "title": "City of Darwin — Environment and Climate Grants",
        "url": "https://www.darwin.nt.gov.au/community/programs/grants-sponsorship/environment-and-climate-change-grants",
        "council": "City of Darwin",
        "state": "NT",
        "description": "Supports Darwin organisations and residents to undertake projects that improve local environment outcomes, address climate change impacts, and build community sustainability.",
        "eligibility": "Community organisations, businesses and residents in Darwin",
        "amount_text": "Up to $5,000",
        "industries": ["Environment", "Energy"],
        "sizes": ["All"],
    },
]


# ════════════════════════════════════════════════════════════════════════════
# SMARTYGRANTS COUNCILS — portal subdomains to scrape
# ════════════════════════════════════════════════════════════════════════════

SMARTYGRANTS_PORTALS = [
    ("parracity", "City of Parramatta", "NSW", "parramatta"),
    ("brisbane", "Brisbane City Council", "QLD", "brisbane"),
    ("goldcoast", "Gold Coast City Council", "QLD", "goldcoast"),
    ("sunshinecoast", "Sunshine Coast Council", "QLD", "sunshinecoast"),
    ("townsville", "Townsville City Council", "QLD", "townsville"),
    ("cairns", "Cairns Regional Council", "QLD", "cairns"),
    ("moretonbay", "City of Moreton Bay", "QLD", "moreton"),
    ("logan", "Logan City Council", "QLD", "logan"),
    ("ipswich", "Ipswich City Council", "QLD", "ipswich"),
    ("cityofadelaide", "City of Adelaide", "SA", "adelaide"),
    ("onkaparinga", "City of Onkaparinga", "SA", "onkaparinga"),
    ("stirling", "City of Stirling", "WA", "stirling"),
    ("fremantle", "City of Fremantle", "WA", "fremantle"),
    ("frankston", "Frankston City Council", "VIC", "frankston"),
    ("cityofyarra", "Yarra City Council", "VIC", "yarra"),
    ("monash", "City of Monash", "VIC", "monash"),
    ("wyndham", "Wyndham City Council", "VIC", "wyndham"),
    ("hobartcity", "City of Hobart", "TAS", "hobart"),
    ("darwin", "City of Darwin", "NT", "darwin"),
]

# Council own-pages (not using SmartyGrants or as supplement)
COUNCIL_PAGES = [
    ("https://www.cityofsydney.nsw.gov.au/grants-sponsorships", "City of Sydney", "NSW", "sydney"),
    ("https://newcastle.nsw.gov.au/community/grants-and-sponsorships/grants", "City of Newcastle", "NSW", "newcastle"),
    ("https://wollongong.nsw.gov.au/book-and-apply/apply-for-a-grant", "Wollongong City Council", "NSW", "wollongong"),
    ("https://www.melbourne.vic.gov.au/grants-and-sponsorships", "City of Melbourne", "VIC", "melbourne"),
    ("https://www.geelongaustralia.com.au/grants/", "City of Greater Geelong", "VIC", "geelong"),
    ("https://perth.wa.gov.au/community/sponsorship-and-grants", "City of Perth", "WA", "perth"),
    ("https://www.wanneroo.wa.gov.au/communityfunding", "City of Wanneroo", "WA", "wanneroo"),
    ("https://rockingham.wa.gov.au/events,-culture-and-tourism/grants-and-scholarships/community-grants-program", "City of Rockingham", "WA", "rockingham"),
    ("https://www.salisbury.sa.gov.au/council/grants-and-awards/grants", "City of Salisbury", "SA", "salisbury"),
    ("https://www.charlessturt.sa.gov.au/services/other-services/grants-and-funding", "City of Charles Sturt", "SA", "charlessturt"),
    ("https://www.playford.sa.gov.au/community/get-involved/grants-and-funding", "City of Playford", "SA", "playford"),
]


# ════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    print("\n" + "=" * 60)
    print("LOCAL COUNCIL GRANT SCRAPERS — Top 30 Australian Councils")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    all_grants: List[Dict] = []
    seen_titles: set = set()

    def add(grants: List[Dict]):
        for g in grants:
            key = g["title"].lower().strip()
            if key and key not in seen_titles and len(key) > 10:
                seen_titles.add(key)
                all_grants.append(g)

    # 1. Load seed programs (always present — quality baseline)
    print("Loading seed programs...")
    seed_grants = []
    for s in SEED_PROGRAMS:
        seed_grants.append(make_grant(
            prefix=s["prefix"],
            title=s["title"],
            url=s["url"],
            council=s["council"],
            state=s["state"],
            description=s.get("description", ""),
            eligibility=s.get("eligibility", ""),
            amount_text=s.get("amount_text", ""),
            industries=s.get("industries"),
            sizes=s.get("sizes"),
            status="open",
        ))
    add(seed_grants)
    print(f"  Loaded {len(seed_grants)} seed programs")

    # 2. SmartyGrants portals
    print("\nScraping SmartyGrants portals...")
    sg_counts = {}
    for subdomain, name, state, prefix in SMARTYGRANTS_PORTALS:
        logger.info(f"  {name} ({subdomain}.smartygrants.com.au)...")
        grants = scrape_smartygrants(subdomain, name, state, prefix)
        add(grants)
        sg_counts[name] = len(grants)
        if grants:
            logger.info(f"    Got {len(grants)} grants")

    # 3. Council own pages
    print("\nScraping council own pages...")
    cp_counts = {}
    for url, name, state, prefix in COUNCIL_PAGES:
        logger.info(f"  {name}...")
        grants = scrape_council_page(url, name, state, prefix)
        add(grants)
        cp_counts[name] = len(grants)
        if grants:
            logger.info(f"    Got {len(grants)} grants")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(all_grants)} unique grants from {len(SMARTYGRANTS_PORTALS) + len(COUNCIL_PAGES) + 1} sources")
    print(f"  Seed programs:       {len(seed_grants)}")
    print(f"  SmartyGrants live:   {sum(sg_counts.values())}")
    print(f"  Council pages live:  {sum(cp_counts.values())}")

    # Save locally
    out_file = "localcouncils_data.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_grants, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {out_file}")

    # Push to Supabase
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        print(f"\nPushing {len(all_grants)} grants to Supabase...")
        pushed = push_to_supabase(all_grants)
        print(f"Pushed {pushed}/{len(all_grants)} grants")
    else:
        print("\nNo Supabase credentials — skipped push")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
