"""
Agency & Additional State Grant Scrapers
=========================================
Covers federal agencies and state programs not in other scrapers:

  Screen Australia             — film, TV, documentary, online/games funding
  ARC Linkage Projects         — industry-university R&D (up to $5M)
  Australian Apprenticeships   — employer wage subsidies & incentives
  Growing Regions Program      — infrastructure.gov.au regional grants
  Regional Connectivity Prog.  — digital infrastructure for regional areas
  CRC-P                        — Cooperative Research Centres (industry R&D)
  Entrepreneurs' Programme     — AusIndustry business advisory + co-investment

  NSW: Jobs Plus, Digital Excellence, Regional Job Creation Fund
  QLD: Works for Queensland, Regional Economic Development
  WA:  Regional Economic Development (RED) Grants, Clean Energy Future Fund
  VIC: Regional Jobs and Infrastructure Fund, Victorian Digital Jobs
  SA:  Jobs Action Scheme, Skilling SA

Note: Building Better Regions Fund (BBRF) is DISCONTINUED under the
current Labor government — not included as open.

Usage:
    python agencyscrapers.py
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
    amount_min, amount_max = parse_amount(amount_text)
    return {
        "id": gid(prefix, url),
        "title": title[:500],
        "source": source,
        "source_url": url,
        "url": url,
        "amount_min": amount_min,
        "amount_max": amount_max,
        "amount_text": amount_text,
        "states": states or ["National"],
        "industries": industries or ["General"],
        "business_sizes": sizes or ["All"],
        "status": status,
        "close_date": close_date or "See website",
        "description": description[:2000],
        "eligibility": eligibility[:1500],
        "grant_type": grant_type,
        "category": category,
    }


def scrape_links(url: str, base_url: str, source: str, prefix: str,
                 state_list: List[str], category: str,
                 industries: List[str], sizes: List[str]) -> List[Dict]:
    """Generic link scraper — finds grant-like links on a page."""
    r = get(url)
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    grants = []
    seen = set()
    keywords = ["grant", "fund", "program", "scheme", "support", "initiative",
                "incentive", "award", "fellowship", "subsidy", "rebate", "investment"]

    for a in soup.find_all("a", href=True):
        href = a["href"]
        title = clean(a.get_text())
        if len(title) < 15 or title in seen:
            continue
        if any(kw in (title + href).lower() for kw in keywords):
            if any(skip in href.lower() for skip in ["javascript:", "mailto:", "login", "#top"]):
                continue
            full_url = href if href.startswith("http") else urljoin(base_url, href)
            seen.add(title)
            parent = a.find_parent(["li", "div", "article"])
            desc = ""
            if parent:
                p = parent.find("p")
                if p:
                    desc = clean(p.get_text())[:500]
            amount_match = re.search(r"\$[\d,.]+(?: ?(?:million|m|k))?(?:\s*(?:to|–|-)\s*\$[\d,.]+(?:m|million|k)?)?",
                                     f"{title} {desc}", re.I)
            amount_text = amount_match.group(0) if amount_match else ""
            grants.append(make_grant(
                prefix=prefix,
                title=title,
                url=full_url,
                source=source,
                description=desc,
                amount_text=amount_text,
                status="open",
                category=category,
                states=state_list,
                industries=industries,
                sizes=sizes,
            ))
    return grants


def push_to_supabase(grants: List[Dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
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
# 1. Screen Australia
# ════════════════════════════════════════════════════════════════════════════

def scrape_screen_australia() -> List[Dict]:
    """Screen Australia — fully hardcoded accurate programs. No live scraping (site returns nav junk)."""
    logger.info("Scraping Screen Australia...")

    programs = [
        # ── Narrative Content ──────────────────────────────────────────────────
        {
            "title": "Screen Australia — Narrative Content Development",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/narrative-content-development",
            "description": "Development funding for Australian narrative projects across online/direct-to-audience, television drama, and theatrical feature films. Supports script development, packaging, and producer-director attachment. Rolling applications accepted year-round.",
            "eligibility": "Australian production companies and producers. Projects must have significant Australian creative involvement. Contact Development@screenaustralia.gov.au.",
            "amount_text": "Varies by project — typically $20,000 to $500,000",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Narrative Content Production",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/narrative-content-production",
            "description": "Equity co-investment in the production of Australian narrative content including feature films, television drama series, and online/direct-to-audience projects. Four application rounds per financial year. As of February 2026, TV projects require minimum broadcaster licence fees.",
            "eligibility": "Australian production companies with production-ready projects attached to a broadcaster, streamer, or distributor. Must demonstrate creative merit and commercial viability.",
            "amount_text": "$500,000 to $5 million (feature film); $100,000 to $3 million per series (TV drama)",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Narrative Content Short Film Production",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/narrative-content-production/narrative-content-short-film",
            "description": "Supports production of Australian narrative short films for theatrical festival distribution. Two application rounds per financial year.",
            "eligibility": "Australian producers and directors with short film projects targeted at festival distribution.",
            "amount_text": "$10,000 to $50,000",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small"],
            "status": "open",
        },
        # ── Documentary ────────────────────────────────────────────────────────
        {
            "title": "Screen Australia — Documentary Development",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/documentary/development/documentary-development",
            "description": "Funding for the development of Australian documentary projects across all platforms. Supports story development, research, director-producer attachment, and pitch materials. Emphasis on quality, cultural value, innovation, and diversity.",
            "eligibility": "Australian producers, directors, and production companies with documentary projects at development stage.",
            "amount_text": "$5,000 to $50,000",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Documentary Production",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/documentary/production/documentary-production",
            "description": "Co-investment in the production of Australian documentary projects for all platforms including broadcast, streaming, and theatrical. Prioritises documentaries with strong cultural value, innovation, and diverse Australian stories.",
            "eligibility": "Australian production companies with documentary projects attached to a broadcaster, distributor, or streaming platform.",
            "amount_text": "$100,000 to $1.5 million",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        # ── Online & Games ─────────────────────────────────────────────────────
        {
            "title": "Screen Australia — Games Production Fund",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/online/games/games-production-fund",
            "description": "Co-investment in the production of Australian video games with strong creative vision and commercial potential. Supports all game genres and platforms including PC, console, and mobile.",
            "eligibility": "Australian game development studios with a production-ready game project. Must have significant Australian creative involvement.",
            "amount_text": "$150,000 to $500,000",
            "industries": ["Arts", "Technology"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Emerging Gamemakers Fund",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/online/games/emerging-gamemakers-fund",
            "description": "Supports emerging Australian game developers to create their first or second commercial game title. Designed to grow the next generation of Australian game development talent.",
            "eligibility": "Emerging Australian game developers (individuals or small studios) with limited prior commercial release history.",
            "amount_text": "$30,000 to $100,000",
            "industries": ["Arts", "Technology"],
            "sizes": ["Small", "Startup"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Online Content Production",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/online",
            "description": "Funding for Australian online and direct-to-audience content including web series, digital shorts, podcasts, and interactive projects. Supports both development and production phases.",
            "eligibility": "Australian producers and creators of online content with significant Australian creative involvement.",
            "amount_text": "$20,000 to $300,000",
            "industries": ["Arts", "Technology"],
            "sizes": ["Small"],
            "status": "open",
        },
        # ── First Nations ──────────────────────────────────────────────────────
        {
            "title": "Screen Australia — First Nations Development Funding",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/first-nations/development",
            "description": "Development funding for First Nations screen projects including feature films, TV drama, documentaries, and online content. Supports concept development, script writing, and project packaging for Aboriginal and Torres Strait Islander storytellers.",
            "eligibility": "Projects must have Aboriginal or Torres Strait Islander practitioners in key creative roles (minimum: writer and director or producer). Open year-round.",
            "amount_text": "Varies — typically $10,000 to $150,000",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small"],
            "status": "open",
        },
        {
            "title": "Screen Australia — First Nations Production Funding",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/first-nations",
            "description": "Production financing for First Nations screen projects. Supports feature films, TV drama, documentaries, and online content made by Aboriginal and Torres Strait Islander practitioners.",
            "eligibility": "Projects must have a First Nations lead creative team including minimum a First Nations writer and director. Must demonstrate strong First Nations creative control.",
            "amount_text": "Varies — typically $100,000 to $2 million",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — First Nations Travel Grants",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/first-nations/sector-development/first-nations-travel-grants",
            "description": "Travel grants for First Nations screen practitioners to attend international film markets, festivals, and industry events. Supports career development and international exposure for Aboriginal and Torres Strait Islander screen professionals.",
            "eligibility": "Aboriginal or Torres Strait Islander screen practitioners with a confirmed invitation to an international industry event.",
            "amount_text": "$2,000 to $10,000",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small"],
            "status": "open",
        },
        # ── Industry Development ───────────────────────────────────────────────
        {
            "title": "Screen Australia — Skills Development Fund",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/industry-development/initiatives/skills-development-fund",
            "description": "Supports skills development initiatives for Australian screen industry practitioners. Funds workshops, training programs, and professional development activities that address skills gaps across the sector.",
            "eligibility": "Screen industry organisations, guilds, and training bodies delivering skills development for Australian screen practitioners.",
            "amount_text": "Up to $200,000 per initiative",
            "industries": ["Arts", "General"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Australian Screen Festivals Fund",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/industry-development/audiences/australian-screen-festivals-fund",
            "description": "Supports Australian screen festivals to showcase Australian and international screen content, build audiences, and develop screen culture. Funding available for programming, marketing, and operational costs.",
            "eligibility": "Australian screen festival organisers with an established track record of delivering public film festival events.",
            "amount_text": "Varies — up to $100,000 per festival",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        {
            "title": "Screen Australia — Screen Industry Partnerships",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/industry-development/businesses/screen-industry-partnerships",
            "description": "Supports strategic partnerships between Australian screen companies and international or domestic partners to build economic sustainability and market access for the Australian screen industry.",
            "eligibility": "Established Australian screen industry businesses seeking to develop strategic partnerships. Must demonstrate industry impact and sustainability.",
            "amount_text": "Varies by project",
            "industries": ["Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
        # ── Tax Offsets ────────────────────────────────────────────────────────
        {
            "title": "Screen Australia — Producer Offset (Tax Rebate)",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/producer-offset",
            "description": "Refundable tax offset for Australian producers of eligible feature films, television, and other screen content. Administered by Screen Australia on behalf of the ATO. Cinema: 40% of Qualifying Australian Production Expenditure (QAPE). Other formats (TV, streaming, documentary): 20% of QAPE. Changes pending from May 2024 Budget.",
            "eligibility": "Australian production companies producing eligible Australian content. Drama TV series require minimum $500K/hour AND $1M total (or $35M/season). Most other formats have minimum spend thresholds.",
            "amount_text": "40% QAPE rebate (feature film); 20% QAPE (TV/other)",
            "grant_type": "tax_incentive",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium", "Large"],
            "status": "ongoing",
        },
        {
            "title": "Screen Australia — Location and PDV Offsets",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/producer-offset/location-and-pdv-offsets",
            "description": "Tax offsets for foreign productions filming in Australia (Location Offset: 16.5% of QAPE for productions spending $15M+ in Australia) and for post-production, digital, and visual effects work (PDV Offset: 30% for productions with $500K+ Australian PDV spend). Additional 'uplift' available for Location Offset if significant Australian economic impact.",
            "eligibility": "Foreign productions filming in Australia (Location Offset) or using Australian post/VFX facilities (PDV Offset). Minimum Australian spend thresholds apply.",
            "amount_text": "Location Offset: 16.5% of Australian spend; PDV Offset: 30% of Australian PDV spend",
            "grant_type": "tax_incentive",
            "industries": ["Arts", "Arts"],
            "sizes": ["Medium", "Large"],
            "status": "ongoing",
        },
        # ── International ──────────────────────────────────────────────────────
        {
            "title": "Screen Australia — Official Co-production Program",
            "url": "https://www.screenaustralia.gov.au/funding-and-support/co-production-program",
            "description": "Facilitates official international co-productions under formal treaty arrangements between Australia and 14 partner countries (Canada, China, France, Germany, India, Ireland, Israel, Italy, Korea, Malaysia, New Zealand, Singapore, South Africa, UK). Co-productions qualify for the Producer Offset and may access funding from both countries.",
            "eligibility": "Australian production companies co-producing with companies in treaty partner countries. Projects must have genuine creative and financial contribution from each country. Apply via SmartyGrants portal.",
            "amount_text": "Varies — assessed per project based on Australian spend",
            "industries": ["Arts", "Arts"],
            "sizes": ["Small", "Medium"],
            "status": "open",
        },
    ]

    grants = []
    for p in programs:
        grants.append(make_grant(
            prefix="screen_au",
            title=p["title"],
            url=p["url"],
            source="screenaustralia.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status=p.get("status", "open"),
            category="arts",
            states=["National"],
            grant_type=p.get("grant_type", "grant"),
            industries=p.get("industries", ["Arts"]),
            sizes=p.get("sizes", ["All"]),
        ))

    logger.info(f"  Screen Australia: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 2. ARC Linkage Projects
# ════════════════════════════════════════════════════════════════════════════

def scrape_arc() -> List[Dict]:
    """Australian Research Council — Linkage Program for industry-university R&D."""
    logger.info("Scraping ARC Linkage Program...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "ARC Linkage Projects — Industry-University R&D Grants",
            "url": "https://www.arc.gov.au/funding-research/funding-schemes/linkage-program/linkage-projects",
            "description": "ARC Linkage Projects fund collaborative research between Australian universities and industry/end-user organisations. Two rounds per year. Industry partners must provide at least equal cash or in-kind contributions. Projects address practical challenges while advancing knowledge.",
            "eligibility": "Australian universities partnered with one or more Australian or international industry/end-user organisations. Industry partner must provide matching cash or in-kind co-investment.",
            "amount_text": "$50,000 to $5 million over 1-5 years",
            "industries": ["Research", "Technology", "Manufacturing", "Healthcare", "Agriculture"],
            "sizes": ["Small", "Medium", "Large"],
        },
        {
            "title": "ARC Linkage Infrastructure, Equipment and Facilities (LIEF)",
            "url": "https://www.arc.gov.au/funding-research/funding-schemes/linkage-program/linkage-infrastructure-equipment-and-facilities",
            "description": "Supports the acquisition of research infrastructure, equipment and facilities that are shared among multiple Australian institutions and industry partners to support collaborative research.",
            "eligibility": "Australian universities and research institutions with industry partners. Must involve collaboration across at least 2 institutions.",
            "amount_text": "$150,000 to $3 million",
            "industries": ["Research", "Technology"],
            "sizes": ["All"],
        },
        {
            "title": "ARC Industrial Transformation Training Centres",
            "url": "https://www.arc.gov.au/funding-research/funding-schemes/linkage-program/industrial-transformation-training-centres",
            "description": "Creates collaborative training environments to develop the next generation of researchers with industry-relevant skills. Involves universities, industry and sometimes international partners.",
            "eligibility": "Australian universities partnered with at least 3 industry organisations. Centres must train postgraduate students and postdoctoral fellows.",
            "amount_text": "Up to $3 million over 5 years",
            "industries": ["Research", "Manufacturing", "Technology"],
            "sizes": ["All"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="arc",
            title=p["title"],
            url=p["url"],
            source="arc.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="research",
            states=["National"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
        ))

    # Live scraping
    r = get("https://www.arc.gov.au/funding-research/funding-schemes/linkage-program")
    if r:
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15 or title in seen:
                continue
            if any(kw in (title + href).lower() for kw in ["linkage", "grant", "program", "fund", "scheme"]):
                full_url = href if href.startswith("http") else urljoin("https://www.arc.gov.au", href)
                if "arc.gov.au" not in full_url:
                    continue
                seen.add(title)
                grants.append(make_grant(
                    prefix="arc",
                    title=title,
                    url=full_url,
                    source="arc.gov.au",
                    status="open",
                    category="research",
                    states=["National"],
                    industries=["Research"],
                ))

    logger.info(f"  ARC: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 3. Australian Apprenticeships Incentive System
# ════════════════════════════════════════════════════════════════════════════

def scrape_apprenticeships() -> List[Dict]:
    """Australian Apprenticeships employer incentives and wage subsidies."""
    logger.info("Scraping Australian Apprenticeships...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "Australian Apprenticeships — Key Apprenticeship Program (KAP) Employer Incentive",
            "url": "https://www.dewr.gov.au/australian-apprenticeships",
            "description": "Employers who hire eligible Australian Apprentices in priority housing construction and clean energy occupations can receive a $5,000 employer incentive payment. Extended to December 2026.",
            "eligibility": "Employers hiring apprentices in eligible housing construction or clean energy trade occupations. Apprentice must be in an eligible occupation and under a training contract.",
            "amount_text": "$5,000 per eligible apprentice",
            "industries": ["Construction", "Energy", "Manufacturing"],
            "sizes": ["Small", "Medium", "Large"],
            "grant_type": "subsidy",
        },
        {
            "title": "Australian Apprenticeships — Commencement and Recommencement Incentive",
            "url": "https://www.dewr.gov.au/australian-apprenticeships/resources/australian-apprenticeships-incentive-system-factsheet",
            "description": "Employers can receive incentive payments when they hire a new Australian Apprentice in a priority occupation or from a priority cohort (Indigenous Australians, mature-age workers, people with disability).",
            "eligibility": "Employers hiring new Australian Apprentices in designated priority occupations or from priority cohorts",
            "amount_text": "$1,500 to $5,000 depending on occupation and apprentice cohort",
            "industries": ["General"],
            "sizes": ["Small", "Medium", "Large"],
            "grant_type": "subsidy",
        },
        {
            "title": "Australian Apprenticeships — Completion Incentive",
            "url": "https://www.dewr.gov.au/australian-apprenticeships",
            "description": "Employers receive a completion incentive payment when an apprentice in a priority occupation successfully completes their qualification.",
            "eligibility": "Employers of Australian Apprentices in priority occupations who complete their training contract",
            "amount_text": "$750 to $2,500 per completion",
            "industries": ["General"],
            "sizes": ["All"],
            "grant_type": "subsidy",
        },
        {
            "title": "Australian Apprenticeships — Hiring Incentive (Mature Age Workers)",
            "url": "https://www.dewr.gov.au/australian-apprenticeships",
            "description": "Additional employer incentives for hiring mature-age Australian Apprentices (45 years and over) to support workforce participation and skills development for older Australians.",
            "eligibility": "Employers hiring Australian Apprentices aged 45 years and over",
            "amount_text": "Up to $4,000",
            "industries": ["General"],
            "sizes": ["All"],
            "grant_type": "subsidy",
        },
        {
            "title": "Australian Apprenticeships — Indigenous Australian Incentive",
            "url": "https://www.dewr.gov.au/australian-apprenticeships",
            "description": "Employer incentives for hiring Aboriginal and Torres Strait Islander Australian Apprentices to support greater Indigenous participation in trade and vocational education.",
            "eligibility": "Employers hiring Aboriginal or Torres Strait Islander Australian Apprentices",
            "amount_text": "Up to $5,000",
            "industries": ["General"],
            "sizes": ["All"],
            "grant_type": "subsidy",
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="apprentice",
            title=p["title"],
            url=p["url"],
            source="dewr.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="federal",
            states=["National"],
            industries=p.get("industries", ["General"]),
            sizes=p.get("sizes", ["All"]),
            grant_type=p.get("grant_type", "subsidy"),
        ))

    # Live scraping
    r = get("https://www.dewr.gov.au/australian-apprenticeships")
    if r:
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15 or title in seen:
                continue
            if any(kw in (title + href).lower() for kw in ["incentive", "grant", "support", "program", "subsidy", "payment"]):
                full_url = href if href.startswith("http") else urljoin("https://www.dewr.gov.au", href)
                if "dewr.gov.au" not in full_url:
                    continue
                seen.add(title)
                grants.append(make_grant(
                    prefix="apprentice",
                    title=title,
                    url=full_url,
                    source="dewr.gov.au",
                    status="open",
                    category="federal",
                    states=["National"],
                    industries=["General"],
                    grant_type="subsidy",
                ))

    logger.info(f"  Australian Apprenticeships: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 4. Growing Regions Program (successor to BBRF)
# ════════════════════════════════════════════════════════════════════════════

def scrape_regional_programs() -> List[Dict]:
    """Federal regional development programs — Growing Regions, Regional Connectivity."""
    logger.info("Scraping Regional Programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "Growing Regions Program",
            "url": "https://www.infrastructure.gov.au/territories-regions/regional-australia/growing-regions-program",
            "description": "The Growing Regions Program funds community infrastructure projects in regional, rural and remote Australia. Supports construction of community infrastructure such as halls, facilities, sporting grounds, cultural and arts facilities, and economic infrastructure.",
            "eligibility": "Local governments, not-for-profit organisations, and for-profit entities in regional, rural or remote Australia. Projects must deliver community infrastructure.",
            "amount_text": "$500,000 to $15 million",
            "category": "regional",
            "industries": ["General", "Transport", "Sport", "Arts"],
            "sizes": ["All"],
        },
        {
            "title": "Regional Connectivity Program",
            "url": "https://www.infrastructure.gov.au/territories-regions/regional-australia/regional-connectivity-program",
            "description": "Funds digital infrastructure projects that improve mobile and internet connectivity in regional, rural and remote Australia, enabling businesses and communities to participate in the digital economy.",
            "eligibility": "Telecommunications providers, local governments and other organisations delivering connectivity infrastructure in regional areas",
            "amount_text": "Up to $10 million per project",
            "category": "regional",
            "industries": ["Technology", "General"],
            "sizes": ["All"],
        },
        {
            "title": "Regional Investment Corporation (RIC) Farm Business Loans",
            "url": "https://www.ric.gov.au/farm-business-loans",
            "description": "The RIC provides concessional loans to farm businesses and agricultural cooperatives for on-farm investment. Lower interest rates than commercial loans to support farm business development.",
            "eligibility": "Australian farm businesses and agricultural cooperatives with an eligible farming project and need for capital",
            "amount_text": "Up to $2 million",
            "category": "agriculture",
            "industries": ["Agriculture"],
            "sizes": ["Small", "Medium"],
            "grant_type": "loan",
        },
        {
            "title": "Regional Acceleration Program",
            "url": "https://www.infrastructure.gov.au/territories-regions",
            "description": "Supports regional communities to identify, develop and deliver economic development opportunities. Provides funding for projects that attract investment, create jobs and diversify regional economies.",
            "eligibility": "Regional local governments, businesses and organisations with projects that drive economic development",
            "amount_text": "Variable — see website",
            "category": "regional",
            "industries": ["General"],
            "sizes": ["All"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="regional",
            title=p["title"],
            url=p["url"],
            source="infrastructure.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category=p.get("category", "regional"),
            states=["National"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
            grant_type=p.get("grant_type", "grant"),
        ))

    # Live scraping
    r = get("https://www.infrastructure.gov.au/territories-regions/regional-australia")
    if r:
        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            title = clean(a.get_text())
            if len(title) < 15 or title in seen:
                continue
            if any(kw in (title + href).lower() for kw in ["program", "fund", "grant", "initiative", "investment"]):
                full_url = href if href.startswith("http") else urljoin("https://www.infrastructure.gov.au", href)
                if "infrastructure.gov.au" not in full_url:
                    continue
                seen.add(title)
                grants.append(make_grant(
                    prefix="regional",
                    title=title,
                    url=full_url,
                    source="infrastructure.gov.au",
                    status="open",
                    category="regional",
                    states=["National"],
                    industries=["General"],
                ))

    logger.info(f"  Regional Programs: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 5. CRC-P and Entrepreneurs' Programme
# ════════════════════════════════════════════════════════════════════════════

def scrape_industry_programs() -> List[Dict]:
    """CRC-P, Entrepreneurs' Programme and other AusIndustry programs."""
    logger.info("Scraping Industry Programs (CRC-P, Entrepreneurs)...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "Cooperative Research Centres Projects (CRC-P)",
            "url": "https://business.gov.au/grants-and-programs/cooperative-research-centres-projects-crc-p",
            "description": "CRC-P grants support short-term industry-led research collaborations addressing specific industry problems. Projects are led by an industry organisation and must include research organisations. Provides up to $3M in Commonwealth funding with matched industry investment.",
            "eligibility": "Industry-led consortia including at least one Australian research organisation (university, CSIRO, etc.) and one industry organisation. The industry organisation must be the lead applicant.",
            "amount_text": "Up to $3 million over 3 years",
            "industries": ["Research", "Manufacturing", "Technology", "Agriculture", "Healthcare"],
            "sizes": ["Small", "Medium", "Large"],
        },
        {
            "title": "Entrepreneurs' Programme — Business Growth Service",
            "url": "https://business.gov.au/grants-and-programs/entrepreneurs-programme",
            "description": "Connects eligible businesses with experienced business advisers (Business Advisers and Facilitators) to help improve management, capabilities, and growth potential. Access to matched funding for projects that improve competitiveness.",
            "eligibility": "Australian businesses with 20+ employees and $1.5M+ in sales or $1.5M+ in assets. Also open to some smaller businesses in priority sectors.",
            "amount_text": "Business Growth grants up to $20,000 (matched)",
            "industries": ["General"],
            "sizes": ["Small", "Medium"],
        },
        {
            "title": "Entrepreneurs' Programme — Innovation Connections",
            "url": "https://business.gov.au/grants-and-programs/entrepreneurs-programme-innovation-connections",
            "description": "Supports businesses to access knowledge and expertise from publicly-funded research organisations to solve specific business problems and develop innovative new products and processes.",
            "eligibility": "Australian businesses with fewer than 200 employees wanting to work with a research organisation on an innovation project",
            "amount_text": "Up to $50,000 (matched)",
            "industries": ["Research", "Technology", "Manufacturing"],
            "sizes": ["Small", "Medium"],
        },
        {
            "title": "National Reconstruction Fund — Loans and Equity",
            "url": "https://www.nrfc.gov.au/",
            "description": "The National Reconstruction Fund provides concessional loans and equity investments of $5M-$250M to manufacturers and value-adding industries in seven priority areas including resources, agriculture, medical, defence, transport, clean energy and enabling capabilities.",
            "eligibility": "Australian manufacturers and value-adding businesses in priority sectors. Must be primarily Australian-owned or have significant Australian operations.",
            "amount_text": "$5 million to $250 million",
            "industries": ["Manufacturing", "Agriculture", "Healthcare", "Defence", "Energy"],
            "sizes": ["Medium", "Large"],
            "grant_type": "loan",
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="industry_prog",
            title=p["title"],
            url=p["url"],
            source="business.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="federal",
            states=["National"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
            grant_type=p.get("grant_type", "grant"),
        ))

    logger.info(f"  Industry Programs: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 6. NSW Additional Programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_nsw_additional() -> List[Dict]:
    """NSW state programs not covered in statescrapers.py."""
    logger.info("Scraping NSW additional programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "NSW Jobs Plus Program",
            "url": "https://www.nsw.gov.au/business-and-economy/industry-and-investment/jobs-plus-program",
            "description": "Supports businesses that create 30 or more new jobs in NSW with a package of concessions including land tax concessions, payroll tax relief, fast-tracked planning approvals and support from a dedicated government contact.",
            "eligibility": "Businesses investing in NSW and creating 30 or more net new full-time jobs within two years",
            "amount_text": "Payroll tax concession worth $75,000+ per year",
            "industries": ["General", "Manufacturing", "Technology"],
            "sizes": ["Medium", "Large"],
            "grant_type": "tax_incentive",
        },
        {
            "title": "NSW Regional Job Creation Fund",
            "url": "https://www.nsw.gov.au/business-and-economy/industry-and-investment/regional-job-creation-fund",
            "description": "Co-investment fund supporting private businesses to expand operations and create jobs in regional NSW. Targets industries including agribusiness, manufacturing, tourism and technology.",
            "eligibility": "Private businesses investing in regional NSW and creating at least 10 net new full-time jobs",
            "amount_text": "Up to $10 million",
            "industries": ["Agriculture", "Manufacturing", "Tourism", "Technology"],
            "sizes": ["Medium", "Large"],
        },
        {
            "title": "NSW Digital Restart Fund",
            "url": "https://www.digital.nsw.gov.au/policy/digital-restart-fund",
            "description": "Investment in digital transformation projects for NSW government agencies. Also supports industry partnerships to deliver innovative digital solutions for government services.",
            "eligibility": "NSW government agencies (primary) and technology companies partnering with agencies",
            "amount_text": "$100 million+ total fund",
            "industries": ["Technology"],
            "sizes": ["Small", "Medium", "Large"],
        },
        {
            "title": "NSW Small Business Month Grants",
            "url": "https://www.business.nsw.gov.au/grants-and-programs",
            "description": "Annual grants for small businesses in NSW across various categories, available during NSW Small Business Month (October). Categories vary each year.",
            "eligibility": "NSW small businesses — specific eligibility varies by grant category each year",
            "amount_text": "Up to $10,000",
            "industries": ["General"],
            "sizes": ["Small"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="nsw_add",
            title=p["title"],
            url=p["url"],
            source="nsw.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="state",
            states=["NSW"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
            grant_type=p.get("grant_type", "grant"),
        ))

    # Live scraping
    for url in ["https://www.business.nsw.gov.au/grants-and-programs"]:
        live = scrape_links(url, "https://www.business.nsw.gov.au", "nsw.gov.au",
                            "nsw_add", ["NSW"], "state", ["General"], ["Small", "Medium"])
        for g in live:
            if g["title"] not in seen:
                seen.add(g["title"])
                grants.append(g)

    logger.info(f"  NSW additional: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 7. QLD Additional Programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_qld_additional() -> List[Dict]:
    """QLD programs not covered in statescrapers.py."""
    logger.info("Scraping QLD additional programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "Works for Queensland Program",
            "url": "https://www.dlgrningp.qld.gov.au/local-government/programs-and-initiatives/works-for-queensland",
            "description": "Provides funding to non-metropolitan councils to plan and deliver local infrastructure and maintenance works that create jobs in regional and remote Queensland.",
            "eligibility": "Non-metropolitan Queensland local governments (councils outside SEQ). For infrastructure and maintenance works that employ local workers.",
            "amount_text": "$200 million+ total (allocations by council)",
            "industries": ["Construction", "Transport"],
            "sizes": ["All"],
        },
        {
            "title": "Queensland Regional Economic Development Grants",
            "url": "https://www.business.qld.gov.au/starting-business/advice-support/grants",
            "description": "Grants supporting businesses in regional Queensland to establish, grow and create jobs. Supports industries including agriculture, manufacturing, tourism and resources.",
            "eligibility": "Businesses operating in regional Queensland (outside SEQ) creating employment and economic activity",
            "amount_text": "Up to $500,000",
            "industries": ["General", "Agriculture", "Manufacturing", "Tourism"],
            "sizes": ["Small", "Medium"],
        },
        {
            "title": "Queensland Small Business Grants",
            "url": "https://www.business.qld.gov.au/starting-business/advice-support/grants",
            "description": "Range of Queensland Government grants for small businesses covering areas including skills, innovation, export, sustainability and business development.",
            "eligibility": "Queensland small businesses — specific criteria vary by individual program",
            "amount_text": "Varies by program",
            "industries": ["General"],
            "sizes": ["Small"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="qld_add",
            title=p["title"],
            url=p["url"],
            source="qld.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="state",
            states=["QLD"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
        ))

    logger.info(f"  QLD additional: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 8. WA Additional Programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_wa_additional() -> List[Dict]:
    """WA programs not covered in statescrapers.py."""
    logger.info("Scraping WA additional programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "WA Regional Economic Development (RED) Grants",
            "url": "https://www.rdl.wa.gov.au/funding/red-grants",
            "description": "RED Grants support economic development activities in regional Western Australia. Fund projects that create jobs, support industry development, improve infrastructure and build community capacity in regional WA.",
            "eligibility": "Local governments, industry bodies, not-for-profit organisations and businesses in regional WA",
            "amount_text": "$20,000 to $2 million",
            "industries": ["General", "Agriculture", "Tourism", "Manufacturing"],
            "sizes": ["All"],
        },
        {
            "title": "WA Clean Energy Future Fund",
            "url": "https://www.wa.gov.au/government/document-collections/clean-energy-future-fund",
            "description": "Invests in clean energy projects across Western Australia to reduce emissions and develop WA's renewable energy sector. Includes grants, loans and equity investments.",
            "eligibility": "Businesses, research organisations and other entities with clean energy projects in Western Australia",
            "amount_text": "$5 million to $50 million",
            "industries": ["Energy"],
            "sizes": ["Medium", "Large"],
        },
        {
            "title": "WA Jobs Action Plan — Industry Attraction",
            "url": "https://www.wa.gov.au/government/publications/jobs-and-economy/wa-jobs-action-plan",
            "description": "Supports attracting new businesses and investment to Western Australia and growing existing WA businesses. Includes targeted industry support packages and co-investment grants.",
            "eligibility": "Businesses investing in Western Australia and creating significant employment",
            "amount_text": "Variable — case-by-case co-investment",
            "industries": ["General", "Manufacturing", "Technology", "Mining"],
            "sizes": ["Medium", "Large"],
        },
        {
            "title": "WA Landcare, Biodiversity and Agriculture Grants",
            "url": "https://www.wa.gov.au/government/topics/farming-and-primary-industries",
            "description": "Grants for WA landholders, farmers and community groups to undertake environmental and agricultural improvement projects including revegetation, soil health, and sustainable farming practices.",
            "eligibility": "WA farmers, landholders and natural resource management groups with land-based projects",
            "amount_text": "$5,000 to $500,000",
            "industries": ["Agriculture", "Environment"],
            "sizes": ["Small", "Medium"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="wa_add",
            title=p["title"],
            url=p["url"],
            source="wa.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="state",
            states=["WA"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
        ))

    logger.info(f"  WA additional: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 9. VIC Additional Programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_vic_additional() -> List[Dict]:
    """VIC programs not covered in statescrapers.py."""
    logger.info("Scraping VIC additional programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "VIC Regional Jobs and Infrastructure Fund",
            "url": "https://www.rdv.vic.gov.au/business-programs/regional-jobs-fund",
            "description": "Co-investment fund for projects that create significant employment and economic activity in regional Victoria. Supports business investment, infrastructure development and community projects.",
            "eligibility": "Businesses, local governments and organisations in regional Victoria with projects creating jobs and economic activity",
            "amount_text": "$1 million to $20 million",
            "industries": ["General", "Manufacturing", "Agriculture", "Tourism"],
            "sizes": ["Medium", "Large"],
        },
        {
            "title": "VIC Small Business Digital Adaptation Program",
            "url": "https://www.business.vic.gov.au/grants-and-programs/small-business-digital-adaptation-program",
            "description": "Supports eligible Victorian small businesses to access and adopt digital tools and platforms to improve their business management and operations.",
            "eligibility": "Victorian businesses with fewer than 20 employees and an annual turnover under $3 million",
            "amount_text": "Up to $1,200 rebate",
            "industries": ["General"],
            "sizes": ["Small", "Startup"],
            "grant_type": "rebate",
        },
        {
            "title": "VIC Sustainability Fund — Business Grants",
            "url": "https://www.sustainability.vic.gov.au/",
            "description": "Sustainability Victoria provides grants to businesses to implement energy efficiency measures, reduce waste and improve environmental performance.",
            "eligibility": "Victorian businesses investing in energy efficiency, waste reduction or other sustainability improvements",
            "amount_text": "$10,000 to $500,000",
            "industries": ["Energy", "Environment", "Manufacturing"],
            "sizes": ["Small", "Medium"],
        },
        {
            "title": "LaunchVic — Startup Investment Programs",
            "url": "https://launchvic.org/programs/",
            "description": "LaunchVic runs multiple programs to support Victoria's startup ecosystem including accelerator funding, founder support grants, female founder programs, and regional startup support.",
            "eligibility": "Victorian startups, accelerators, incubators and startup ecosystem organisations",
            "amount_text": "Various — $10,000 to $3 million",
            "industries": ["Technology", "Research"],
            "sizes": ["Startup", "Small"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="vic_add",
            title=p["title"],
            url=p["url"],
            source="vic.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="state",
            states=["VIC"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
            grant_type=p.get("grant_type", "grant"),
        ))

    logger.info(f"  VIC additional: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# 10. SA Additional Programs
# ════════════════════════════════════════════════════════════════════════════

def scrape_sa_additional() -> List[Dict]:
    """SA programs not covered in statescrapers.py."""
    logger.info("Scraping SA additional programs...")
    grants = []
    seen = set()

    core_programs = [
        {
            "title": "SA Jobs Action Scheme",
            "url": "https://www.sa.gov.au/topics/business-and-trade/taxation/payroll-tax/jobs-action-scheme",
            "description": "Payroll tax rebate for SA businesses that hire new employees and grow their South Australian workforce. Eligible employers receive a payroll tax rebate of up to $4,000 per new employee.",
            "eligibility": "South Australian businesses that pay payroll tax and hire new employees (net increase in headcount)",
            "amount_text": "Up to $4,000 per new employee",
            "industries": ["General"],
            "sizes": ["Small", "Medium", "Large"],
            "grant_type": "rebate",
        },
        {
            "title": "SA Skilling South Australia",
            "url": "https://www.skills.sa.gov.au/skillingSA",
            "description": "South Australian government initiative to increase the number of apprentices and trainees in SA, with employer subsidies and support for training in priority industries.",
            "eligibility": "SA employers hiring apprentices or trainees in priority industries and occupations",
            "amount_text": "Up to $6,000 per apprentice",
            "industries": ["General", "Construction", "Manufacturing"],
            "sizes": ["Small", "Medium"],
            "grant_type": "subsidy",
        },
        {
            "title": "SA Regional Development Fund",
            "url": "https://www.sa.gov.au/topics/business-and-trade/industry-and-trade/regional-development",
            "description": "Co-investment grants for projects that drive economic growth in regional South Australia, including business development, infrastructure, tourism and agriculture projects.",
            "eligibility": "Businesses, local governments and organisations in regional South Australia",
            "amount_text": "Up to $2 million",
            "industries": ["General", "Agriculture", "Tourism", "Manufacturing"],
            "sizes": ["Small", "Medium"],
        },
    ]

    for p in core_programs:
        seen.add(p["title"])
        grants.append(make_grant(
            prefix="sa_add",
            title=p["title"],
            url=p["url"],
            source="sa.gov.au",
            description=p["description"],
            eligibility=p.get("eligibility", ""),
            amount_text=p["amount_text"],
            status="open",
            category="state",
            states=["SA"],
            industries=p.get("industries"),
            sizes=p.get("sizes"),
            grant_type=p.get("grant_type", "grant"),
        ))

    logger.info(f"  SA additional: {len(grants)} grants")
    return grants


# ════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════

SCRAPERS = [
    ("Screen Australia", scrape_screen_australia),
    ("ARC Linkage Projects", scrape_arc),
    ("Australian Apprenticeships", scrape_apprenticeships),
    ("Regional Programs (Growing Regions etc.)", scrape_regional_programs),
    ("CRC-P & Entrepreneurs Programme", scrape_industry_programs),
    ("NSW Additional Programs", scrape_nsw_additional),
    ("QLD Additional Programs", scrape_qld_additional),
    ("WA Additional Programs", scrape_wa_additional),
    ("VIC Additional Programs", scrape_vic_additional),
    ("SA Additional Programs", scrape_sa_additional),
]


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    print("\n" + "=" * 60)
    print("AGENCY & STATE SCRAPERS — Supplementary Programs")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    all_grants: List[Dict] = []
    seen_titles: set = set()
    source_counts: Dict[str, int] = {}

    for name, fn in SCRAPERS:
        print(f"\n--- {name} ---")
        try:
            results = fn()
            added = 0
            for g in results:
                key = g["title"].lower().strip()
                if key and key not in seen_titles:
                    seen_titles.add(key)
                    all_grants.append(g)
                    added += 1
            source_counts[name] = added
        except Exception as e:
            logger.error(f"  {name} failed: {e}")
            source_counts[name] = 0

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(all_grants)} unique grants from {len(SCRAPERS)} sources")
    print(f"{'=' * 60}")
    for name, count in source_counts.items():
        print(f"  {name:<45} {count:>4}")

    out_file = "agencyscrapers_data.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_grants, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to {out_file}")

    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        print(f"\nPushing {len(all_grants)} grants to Supabase...")
        pushed = push_to_supabase(all_grants)
        print(f"Pushed {pushed}/{len(all_grants)} grants")
    else:
        print("\nNo Supabase credentials — skipped push")

    print(f"\nDone: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
