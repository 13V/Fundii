#!/usr/bin/env python3
"""
GrantMate DB Cleanup Script
===========================
Fixes 8 categories of data quality issues found in audit:

1. Delete closed grants (410) — waste space, already filtered by match API
2. Delete portal nav pages — garbage scraper artefacts
3. Delete vague landing pages — no amount + generic "Find out how to" description
4. Fix amount parsing errors — amounts 1-9 that should be millions
5. Fix false Construction tags — no construction keywords in title/desc
6. Fix false NT/ACT state tags — " act " / " nt " matched generic text
7. Fix over-tagged industries — 5+ specific industries → treat as General
8. Report short descriptions (can't fix without original page text)

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python cleanup_db.py
"""
import os, sys, re, json
import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

BASE = f"{SUPABASE_URL}/rest/v1/grants"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def get_all_grants():
    """Fetch all grants from Supabase in batches of 1000."""
    all_grants = []
    offset = 0
    limit = 1000
    print("Fetching all grants...")
    while True:
        r = requests.get(BASE, headers=HEADERS, params={
            "select": "id,title,description,amount_min,amount_max,amount_text,industries,states,status",
            "limit": limit,
            "offset": offset,
        })
        if not r.ok:
            print(f"  ❌ Fetch error: {r.status_code} {r.text[:200]}")
            break
        batch = r.json()
        if not batch:
            break
        all_grants.extend(batch)
        offset += limit
        print(f"  Fetched {len(all_grants)} grants so far...")
        if len(batch) < limit:
            break
    print(f"  Total: {len(all_grants)} grants\n")
    return all_grants


def delete_grant(gid, reason):
    r = requests.delete(f"{BASE}?id=eq.{gid}", headers={**HEADERS, "Prefer": "return=minimal"})
    if not r.ok:
        print(f"  ⚠️  Failed to delete {gid}: {r.status_code}")
    return r.ok


def patch_grant(gid, updates):
    r = requests.patch(f"{BASE}?id=eq.{gid}", headers={**HEADERS, "Prefer": "return=minimal"}, json=updates)
    if not r.ok:
        print(f"  ⚠️  Failed to patch {gid}: {r.status_code} {r.text[:100]}")
    return r.ok


# ── Keywords for Construction detection (must be present to keep the tag) ──────

CONSTRUCTION_TERMS = [
    "construction", "building industry", "building work", "tradie",
    "tradesperson", "plumber", "electrician", "carpenter", "builder",
    "bricklayer", "cabinet maker", "concreter", "roofing",
    "mechanic", "automotive", "motor vehicle repair", "smash repair",
    "panel beater", "auto electrician", "vehicle repair",
    "civil engineering", "building contractor",
]

# ── State keywords (mirrors fixed detection.py) ─────────────────────────────

STATE_KW = {
    "NSW": ["nsw", "new south wales"],
    "VIC": [" vic ", "victoria"],
    "QLD": [" qld ", "queensland"],
    "SA":  ["south australia", " sa "],
    "WA":  ["western australia", " wa "],
    "TAS": ["tasmania", " tas "],
    "NT":  ["northern territory", "nt government", "darwin "],
    "ACT": ["australian capital territory", "act government", "canberra"],
}


def detect_states_strict(text):
    """Re-detect states using the FIXED (stricter) state keywords."""
    t = f" {text.lower()} "
    found = []
    for state, kws in STATE_KW.items():
        if any(kw in t for kw in kws):
            found.append(state)
    if not found or len(found) >= 8:
        return ["National"]
    return found


# ── Main cleanup ───────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("GrantMate DB Cleanup")
    print("=" * 60 + "\n")

    # ── Step 1: Delete closed grants ─────────────────────────────────────────
    print("── Step 1: Delete closed grants ──")
    r = requests.delete(f"{BASE}?status=eq.closed", headers={**HEADERS, "Prefer": "return=representation"})
    closed_deleted = len(r.json()) if r.ok and r.text.strip() != "" else 0
    print(f"  Deleted {closed_deleted} closed grants\n")

    # ── Step 2: Delete obvious portal/nav junk ───────────────────────────────
    print("── Step 2: Delete portal nav pages ──")
    nav_patterns = [
        ("title", "ilike", "Browse all information%"),
        ("title", "ilike", "Current Grant Opportunity View%"),
        ("title", "ilike", "Skip navigation%"),
        ("description", "ilike", "Skip navigation%"),
        ("description", "ilike", "%Toggle High Contrast%"),
    ]
    nav_deleted = 0
    for field, op, val in nav_patterns:
        r = requests.delete(f"{BASE}?{field}={op}.{val}", headers={**HEADERS, "Prefer": "return=representation"})
        n = len(r.json()) if r.ok and r.text.strip() not in ("", "[]") else 0
        if n:
            print(f"  Deleted {n} matching '{val[:40]}'")
        nav_deleted += n
    print(f"  Total nav deleted: {nav_deleted}\n")

    # ── Fetch all remaining grants ────────────────────────────────────────────
    grants = get_all_grants()

    deleted_vague = 0
    fixed_amounts = 0
    fixed_construction = 0
    fixed_states = 0
    fixed_overtagged = 0
    short_descs = 0
    skipped = []

    for g in grants:
        gid = g["id"]
        title = (g.get("title") or "").strip()
        desc = (g.get("description") or "").strip()
        desc_lower = desc.lower()
        amt_max = g.get("amount_max") or 0
        amt_min = g.get("amount_min") or 0
        amt_text = (g.get("amount_text") or "").lower()
        industries = g.get("industries") or []
        states = g.get("states") or []
        status = g.get("status") or ""
        combined = f"{title} {desc}".lower()

        # ── Step 3: Delete vague landing pages ───────────────────────────────
        is_no_amount = (amt_max == 0 or amt_max is None) and (amt_min == 0 or amt_min is None)
        is_vague_desc = (
            desc_lower.startswith("find out how to") or
            desc_lower.startswith("find out about") or
            desc_lower.startswith("browse the") or
            len(desc) < 50
        )
        if is_no_amount and is_vague_desc:
            if delete_grant(gid, "vague landing page"):
                deleted_vague += 1
            continue  # Skip further processing for deleted grant

        # ── Step 4: Fix amounts 1-9 that should be millions ──────────────────
        if amt_max is not None and 1 <= amt_max <= 9:
            # Check amount_text for explicit million reference
            m = re.search(r"(\d+(?:\.\d+)?)\s*million", amt_text, re.IGNORECASE)
            if m:
                new_max = int(float(m.group(1)) * 1_000_000)
                new_min_m = re.search(r"(\d+(?:\.\d+)?)\s*million", amt_text, re.IGNORECASE)
                new_min = int(float(new_min_m.group(1)) * 1_000_000) if new_min_m else None
                if patch_grant(gid, {"amount_max": new_max, **({"amount_min": new_min} if new_min else {})}):
                    fixed_amounts += 1
            else:
                # If no amount_text clue but the number is 1-9, it's almost certainly
                # a dollar amount that parsed wrong from something like "$5 million"
                # in the page body. Check combined text for "million".
                m2 = re.search(r"\$\s*(\d+(?:\.\d+)?)\s*(?:million|m\b)", combined, re.IGNORECASE)
                if m2:
                    new_max = int(float(m2.group(1)) * 1_000_000)
                    if patch_grant(gid, {"amount_max": new_max}):
                        fixed_amounts += 1

        # ── Step 5: Fix false Construction tags ──────────────────────────────
        if "Construction" in industries:
            has_construction_kw = any(term in combined for term in CONSTRUCTION_TERMS)
            if not has_construction_kw:
                # Remove Construction; if it was the only industry, use General
                new_inds = [i for i in industries if i != "Construction"]
                if not new_inds or new_inds == []:
                    new_inds = ["General"]
                if patch_grant(gid, {"industries": new_inds}):
                    fixed_construction += 1

        # ── Step 6: Fix false NT/ACT state tags ──────────────────────────────
        if ("NT" in states or "ACT" in states) and "National" not in states:
            correct_states = detect_states_strict(f"{title} {desc}")
            if set(correct_states) != set(states):
                # Only update if the correction actually removes NT or ACT
                removed = set(states) - set(correct_states)
                if removed & {"NT", "ACT"}:
                    if patch_grant(gid, {"states": correct_states}):
                        fixed_states += 1

        # ── Step 7: Fix over-tagged industries (5+ specific = set to General) ─
        # Note: matching already handles this with overTagged guard, but fix source data
        specific_inds = [i for i in industries if i not in ("General", "All")]
        if len(specific_inds) >= 6:
            if patch_grant(gid, {"industries": ["General"]}):
                fixed_overtagged += 1

        # ── Step 8: Report short descriptions ────────────────────────────────
        if 0 < len(desc) < 80:
            short_descs += 1

    print("\n" + "=" * 60)
    print("CLEANUP RESULTS")
    print("=" * 60)
    print(f"  Deleted closed grants:         {closed_deleted}")
    print(f"  Deleted nav/portal pages:      {nav_deleted}")
    print(f"  Deleted vague landing pages:   {deleted_vague}")
    print(f"  Fixed amounts (1-9→millions):  {fixed_amounts}")
    print(f"  Fixed false Construction tags: {fixed_construction}")
    print(f"  Fixed false NT/ACT states:     {fixed_states}")
    print(f"  Fixed over-tagged (5+→General):{fixed_overtagged}")
    print(f"  Short descriptions (<80 chars):{short_descs} (unfixable without rescrape)")
    print("=" * 60)
    total_deleted = closed_deleted + nav_deleted + deleted_vague
    total_fixed = fixed_amounts + fixed_construction + fixed_states + fixed_overtagged
    print(f"\n✅ Done. Deleted {total_deleted}, fixed {total_fixed} grants.")


if __name__ == "__main__":
    main()
