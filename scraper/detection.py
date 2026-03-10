"""
Shared Detection Utilities for All GrantMate Scrapers
======================================================
Single source of truth for industry, state, size, status and grant-type
detection. All scrapers import from here so keywords stay consistent.

Key fixes over the old per-file versions:
 - "trade" removed from Construction (was false-matching Export grants)
 - All short state codes space-padded (" sa ", " act ", " wa ", " nt ", etc.)
 - Energy also covers Environment keywords (matches quiz "Energy & Environment")
 - Agriculture also covers Food & Beverage keywords
 - Research absorbs Space/Aerospace
 - Education, Transport, Sport removed — those grants now return "General"
 - All labels now match quiz-compatible values used in matching.ts
 - Consolidated Indigenous size detection (was only in federalscrapers.py)
"""

from typing import List, Optional


# ── Industry Detection ────────────────────────────────────────────────────────
# IMPORTANT: "trade" is NOT in Construction — it false-matches "international
# trade" and "trade mission" which belong to Export. Use specific phrases.

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    # "Agriculture" also covers Food & Beverage (food production is a primary industry)
    "Agriculture": [
        "agriculture", "farming", "horticulture", "aquaculture",
        "agrifood", "agribusiness", "livestock", "pastoral",
        "fisheries", "fishing industry", "crop production",
        "viticulture", "broadacre", "agri-",
        "food production", "food manufacturing", "beverage manufacturing",
        "wine industry", "brewery", "distillery", "winery",
    ],
    "Manufacturing": [
        "manufacturing", "manufacturer", "made in australia",
        "industrial production", "fabrication", "advanced manufacturing",
    ],
    # "technology" alone is too broad — appears in "using technology to improve"
    # on almost every modern grant. Use specific phrases only.
    "Technology": [
        "software", "digital transformation", "cybersecurity", "cyber security",
        "artificial intelligence", " ai ", "ict ", "data science",
        "machine learning", "saas", "app development", "tech startup",
        "deep tech", "digital technology", "information technology",
        "software development", "platform development",
    ],
    "Construction": [
        "construction", "building industry", "building work",
        "tradie", "tradesperson", "building trades", "trade contractor",
        "trade qualified", "civil engineering", "residential building",
        "commercial building", "construction industry",
        "builder", "plumber", "electrician", "carpenter",
        "automotive", "mechanic", "panel beater", "auto electrician",
        "motor vehicle repair", "smash repair", "automotive industry",
        "automotive trade", "vehicle repair",
    ],
    # "health" alone false-matches "workplace health and safety", "department of health"
    # on virtually every government grant. Use specific healthcare terms only.
    "Healthcare": [
        "healthcare", "medical ", "biotech", "biotechnology",
        "pharmaceutical", "aged care", "disability support",
        "clinical trial", "hospital ", "allied health", "mental health services",
        "health sector", "health industry", "health service",
        "medical research", "health research",
    ],
    "Tourism": [
        "tourism", "hospitality", "visitor economy",
        "accommodation provider", "travel industry", "events tourism",
    ],
    "Retail": [
        "retail", "e-commerce", "ecommerce", "consumer goods",
        "online store", "brick and mortar",
    ],
    # "Energy" covers energy efficiency AND genuine environmental programs.
    # REMOVED: "environment", "sustainability", "climate change", "conservation",
    # "biodiversity", "waste management", "recycling", "landcare" — these appear
    # in the boilerplate of virtually every Australian government grant and cause
    # false Energy tags on unrelated grants.
    "Energy": [
        "energy efficiency", "renewable energy", "solar panel",
        "solar power", "clean energy", "hydrogen energy", "battery storage",
        "wind power", "grid connection", "decarbonisation",
        "net zero", "emissions reduction", "electrification",
        "clean technology", "green energy", "energy audit",
        "solar farm", "energy storage", "power generation",
        # Genuine environmental programs (specific enough to avoid boilerplate)
        "environmental remediation", "pollution reduction",
        "circular economy", "biodiversity offset", "habitat restoration",
        "environmental restoration", "land rehabilitation",
        "waste reduction program", "recycling facility",
    ],
    "Mining": [
        "mining", "resources sector", "minerals processing",
        "extractive industry", "geology", "quarrying",
    ],
    "Defence": [
        "defence industry", "defense industry", "military",
        " aps ", " dsp ", "defence supply chain",
    ],
    "Export": [
        "export", "international trade", "trade mission",
        "export market", "austrade", "emdg",
        "exporting", "overseas market",
    ],
    # "research" alone false-matches "research your eligibility", "research shows"
    # in grant description boilerplate. Use specific R&D phrases only.
    # "science" alone false-matches "food science", "Department of Education and Science".
    "Research": [
        "research and development", "r&d", "research grant",
        "research program", "research project", "scientific research",
        "csiro", "commercialisation", "university research",
        "space industry", "satellite", "aerospace",
        "medical research", "applied research", "industry research",
    ],
    "Arts": [
        " arts ", "arts,", "arts.", "creative industry", " cultural ",
        "screen australia", " film ", "music grant", "theatre",
        "performing arts", "visual arts",
    ],
}


def detect_industries(text: str) -> List[str]:
    """Detect industries from grant text. Returns ['General'] if nothing matches."""
    t = f" {text.lower()} "  # pad so word-boundary keywords work
    found = []
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(kw in t for kw in keywords):
            found.append(industry)
    return found if found else ["General"]


# ── State Detection ────────────────────────────────────────────────────────────
# Short codes are space-padded to avoid substring false-matches.
# IMPORTANT: " act " and " nt " are NOT used — they are far too common in
# government grant text ("the Act and", "the Act is", "act now", "nt government").
# ACT: use "australian capital territory" / "act government" / "canberra" only.
# NT:  use "northern territory" / "nt government" / "darwin" only.
# " sa " / " wa " / " vic " / " tas " / " qld " are short enough to be safe.

STATE_KEYWORDS: dict[str, list[str]] = {
    "NSW": ["nsw", "new south wales"],
    "VIC": [" vic ", "victoria"],
    "QLD": [" qld ", "queensland"],
    "SA":  ["south australia", " sa "],
    "WA":  ["western australia", " wa "],
    "TAS": ["tasmania", " tas "],
    "NT":  ["northern territory", "nt government", "darwin "],
    "ACT": ["australian capital territory", "act government", "canberra"],
}


def detect_states(text: str, explicit_state: Optional[str] = None) -> List[str]:
    """
    Detect Australian states mentioned in text.
    Pass explicit_state to force a single state (e.g. when scraper knows state).
    Pads text with spaces so padded keywords match at start/end of string.
    """
    if explicit_state:
        return [explicit_state]
    t = f" {text.lower()} "
    found = []
    for state, kws in STATE_KEYWORDS.items():
        if any(kw in t for kw in kws):
            found.append(state)
    # If all 8 states match (or none), treat as National
    return found if found and len(found) < 8 else ["National"]


# ── Size Detection ─────────────────────────────────────────────────────────────

def detect_sizes(text: str) -> List[str]:
    """Detect eligible business sizes from grant text."""
    t = text.lower()
    sizes = []
    if any(k in t for k in ["sole trader", "sole proprietor"]):
        sizes.append("Sole Trader")
    if any(k in t for k in ["startup", "start-up", "early stage", "pre-revenue"]):
        sizes.append("Startup")
    if any(k in t for k in [
        "small business", "small to medium", "sme", "small and medium",
        "small and family", "small family business",
    ]):
        sizes.append("Small")
    if any(k in t for k in ["medium business", "medium enterprise", "mid-size"]):
        sizes.append("Medium")
    if any(k in t for k in [
        "non-profit", "not-for-profit", "charity", "charities",
        " nfp ", "community organisation", "community organization",
    ]):
        sizes.append("Non-profit")
    # "Large" removed — no quiz option maps to it, and large-business-only
    # government grants are extremely rare. Those grants default to "All".
    # "Indigenous" removed from sizes — it is an activity flag in the quiz,
    # not a size category. The keyword guard in matching.ts handles restriction.
    return sizes if sizes else ["All"]


# ── Status Detection ───────────────────────────────────────────────────────────

def detect_status(text: str) -> str:
    """Detect whether a grant is open, closed, or ongoing."""
    t = text.lower()
    if any(k in t for k in [
        "applications closed", "program closed", "no longer accepting",
        "closed to applications", "funding exhausted", "not currently open",
    ]):
        return "closed"
    if any(k in t for k in [
        "ongoing", "open year-round", "apply at any time",
        "rolling basis", "open anytime", "no closing date",
    ]):
        return "ongoing"
    if any(k in t for k in [
        "apply now", "applications open", "currently open",
        "accepting applications", "applications are open",
    ]):
        return "open"
    return "open"  # Default to open if status unclear


# ── Grant Type Detection ───────────────────────────────────────────────────────

def detect_grant_type(text: str) -> str:
    """Detect whether funding is a grant, loan, rebate, etc."""
    t = text.lower()[:3000]
    if any(k in t for k in ["loan ", "lending", "finance facility"]):
        return "loan"
    if any(k in t for k in ["tax incentive", "tax offset", "tax concession"]):
        return "tax_incentive"
    if any(k in t for k in ["rebate", "reimbursement"]):
        return "rebate"
    if any(k in t for k in ["voucher"]):
        return "voucher"
    if any(k in t for k in ["subsidy", "subsidies", "wage subsidy"]):
        return "subsidy"
    if any(k in t for k in ["scholarship", "bursary"]):
        return "scholarship"
    return "grant"
