"""
Cleanup Bad Grant Data in Supabase
====================================
Finds and deletes grants in the database that have scraped navigation/page
content instead of real grant descriptions.

Run with:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python cleanup_bad_grants.py

Use --dry-run to preview without deleting.
"""

import os
import sys
import json
import time
import argparse
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Phrases in description that indicate scraped nav/template content
NAV_GARBAGE = [
    "skip navigation",
    "toggle high contrast",
    "accessibility options",
    "more language options",
    "skip to content",
    "high contrast mode",
    "more options more sites",
]

# Phrases in description that indicate scraped sidebar link lists
SIDEBAR_GARBAGE = [
    "migration.sa.gov.au",
    "scienceawards.sa.gov.au",
    "whyallasupport.sa.gov.au",
]

# Title patterns that indicate non-grant pages
NON_GRANT_TITLE_PATTERNS = [
    "small business week",
    "mental health and wellbeing program",
    "algal bloom event",
    "business awards",
    "events calendar",
    "workshop registration",
    "webinar",
]

# Minimum description length — descriptions shorter than this are stub entries
MIN_DESCRIPTION_LENGTH = 50


def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_all_grants():
    """Fetch all grants from Supabase in batches."""
    print("Fetching all grants from Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/grants"
    headers = {**get_headers(), "Range-Unit": "items"}
    all_grants = []
    offset = 0
    batch = 1000

    while True:
        resp = requests.get(
            url,
            headers={**headers, "Range": f"{offset}-{offset + batch - 1}"},
            params={"select": "id,title,description,source"},
            timeout=30,
        )
        if resp.status_code not in (200, 206):
            print(f"Error fetching grants: {resp.status_code} {resp.text[:200]}")
            break
        data = resp.json()
        if not data:
            break
        all_grants.extend(data)
        print(f"  Fetched {len(all_grants)} so far...")
        if len(data) < batch:
            break
        offset += batch
        time.sleep(0.5)

    return all_grants


def is_bad_grant(grant: dict) -> tuple[bool, str]:
    """Return (is_bad, reason) for a grant."""
    title = (grant.get("title") or "").lower()
    description = (grant.get("description") or "")
    desc_lower = description.lower()

    # Check for nav garbage in description
    for phrase in NAV_GARBAGE:
        if phrase in desc_lower:
            return True, f"Nav garbage in description: '{phrase}'"

    # Check for sidebar link lists (SA gov sites)
    for phrase in SIDEBAR_GARBAGE:
        if phrase in desc_lower:
            return True, f"Sidebar content in description: '{phrase}'"

    # Check for non-grant titles
    for pattern in NON_GRANT_TITLE_PATTERNS:
        if pattern in title:
            return True, f"Non-grant title pattern: '{pattern}'"

    # Check for descriptions that are just the page title repeated or too short
    if len(description.strip()) < MIN_DESCRIPTION_LENGTH:
        return True, f"Description too short ({len(description.strip())} chars)"

    return False, ""


def delete_grants(ids: list[str], dry_run: bool):
    """Delete grants by ID list."""
    if not ids:
        return 0

    deleted = 0
    batch_size = 50
    for i in range(0, len(ids), batch_size):
        batch = ids[i:i + batch_size]
        id_list = ",".join(batch)

        if dry_run:
            print(f"  [DRY RUN] Would delete IDs: {id_list[:120]}...")
            deleted += len(batch)
            continue

        resp = requests.delete(
            f"{SUPABASE_URL}/rest/v1/grants",
            headers=get_headers(),
            params={"id": f"in.({id_list})"},
            timeout=30,
        )
        if resp.status_code in (200, 204):
            deleted += len(batch)
            print(f"  Deleted batch of {len(batch)} grants")
        else:
            print(f"  Delete failed: {resp.status_code} {resp.text[:200]}")
        time.sleep(0.3)

    return deleted


def main():
    parser = argparse.ArgumentParser(description="Clean up bad grant data in Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Preview without deleting")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required")
        sys.exit(1)

    grants = fetch_all_grants()
    print(f"\nTotal grants in DB: {len(grants)}")

    bad = []
    for g in grants:
        is_bad, reason = is_bad_grant(g)
        if is_bad:
            bad.append((g["id"], g.get("title", ""), reason))

    print(f"\nFound {len(bad)} bad grants to remove:\n")
    for gid, title, reason in bad[:50]:
        print(f"  [{gid}] {title[:60]}")
        print(f"         Reason: {reason}")

    if len(bad) > 50:
        print(f"  ... and {len(bad) - 50} more")

    if not bad:
        print("Nothing to clean up.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Would delete {len(bad)} grants. Run without --dry-run to apply.")
    else:
        confirm = input(f"\nDelete {len(bad)} grants? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("Aborted.")
            return

    ids_to_delete = [g[0] for g in bad]
    deleted = delete_grants(ids_to_delete, dry_run=args.dry_run)
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Removed {deleted} bad grants.")
    print(f"Remaining: ~{len(grants) - deleted} grants")


if __name__ == "__main__":
    main()
