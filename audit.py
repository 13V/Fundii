import requests, json
from collections import Counter

URL = 'https://gdyjewqeippfnfgyhtkx.supabase.co'
KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeWpld3FlaXBwZm5mZ3lodGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NTU1NCwiZXhwIjoyMDg4MDUxNTU0fQ.ZKEqRtEXocqmhW1cmDLFe3ICl4U-R7pY11MJ5vjXO4E'
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

# Fetch all grants
all_grants = []
offset = 0
while True:
    r = requests.get(URL + '/rest/v1/grants', headers={**H, 'Range': f'{offset}-{offset+999}'}, params={'select': 'id,title,description,industries,states,business_sizes,amount_min,amount_max,source,status,eligibility'})
    batch = r.json()
    if not batch: break
    all_grants.extend(batch)
    if len(batch) < 1000: break
    offset += 1000

print(f"Total grants: {len(all_grants)}")

# 1. Vague landing pages (no amount + generic description)
vague = [g for g in all_grants if
    not g.get('amount_max') and not g.get('amount_min') and
    any((g.get('description') or '').lower().startswith(p) for p in ['find out how to', 'find out about', 'learn how to', 'learn about'])]
print(f"\n1. Vague landing pages (no amount + generic desc): {len(vague)}")
for g in vague[:10]:
    print(f"   [{g['source']}] {g['title'][:60]} | {(g['description'] or '')[:60]}")

# 2. Very short descriptions (< 80 chars)
short_desc = [g for g in all_grants if len((g.get('description') or '').strip()) < 80]
print(f"\n2. Short description < 80 chars: {len(short_desc)}")
for g in short_desc[:10]:
    print(f"   [{g['source']}] {g['title'][:50]} | '{(g['description'] or '').strip()[:60]}'")

# 3. Grants with NT in states - check if they make sense
nt_grants = [g for g in all_grants if 'NT' in (g.get('states') or [])]
print(f"\n3. Grants with NT in states: {len(nt_grants)}")
# Sample ones that also have other states mixed in unexpectedly
weird_nt = [g for g in nt_grants if 'NT' in (g.get('states') or []) and len(g.get('states') or []) >= 3 and 'National' not in (g.get('states') or [])]
print(f"   With 3+ states including NT (possible false positive): {len(weird_nt)}")
for g in weird_nt[:8]:
    print(f"   {g['title'][:50]} | states={g['states']} | [{g['source']}]")

# 4. Over-tagged industries (5+ specific industries)
over_tagged = [g for g in all_grants if len([i for i in (g.get('industries') or []) if i not in ('General','All')]) >= 5]
print(f"\n4. Over-tagged industries (5+ specific): {len(over_tagged)}")
for g in over_tagged[:8]:
    print(f"   {g['title'][:50]} | inds={g['industries']}")

# 5. Construction-tagged grants audit - are they legit?
construction = [g for g in all_grants if 'Construction' in (g.get('industries') or [])]
print(f"\n5. Construction-tagged grants: {len(construction)}")
# Show ones where Construction seems wrong
suspicious = [g for g in construction if not any(k in (g.get('title','') + ' ' + (g.get('description') or '')).lower()
    for k in ['construct', 'build', 'tradie', 'trade', 'plumb', 'electric', 'carpent', 'mechanic', 'automotive', 'civil', 'residential', 'commercial build'])]
print(f"   Possibly false Construction tags: {len(suspicious)}")
for g in suspicious[:15]:
    print(f"   {g['title'][:60]} | inds={g['industries']} | desc: {(g['description'] or '')[:80]}")

# 6. Source breakdown
sources = Counter(g['source'] for g in all_grants)
print(f"\n6. Source breakdown:")
for src, cnt in sources.most_common():
    print(f"   {src:<40} {cnt:>4}")

# 7. Status breakdown
statuses = Counter(g['status'] for g in all_grants)
print(f"\n7. Status breakdown: {dict(statuses)}")

# 8. Grants with amount_min or amount_max of 1-9 (likely millions not converted)
tiny_amounts = [g for g in all_grants if (g.get('amount_min') and 1 <= g['amount_min'] <= 9) or (g.get('amount_max') and 1 <= g['amount_max'] <= 9)]
print(f"\n8. Grants with suspiciously small amounts (1-9, likely millions): {len(tiny_amounts)}")
for g in tiny_amounts[:10]:
    print(f"   {g['title'][:55]} | min={g['amount_min']} max={g['amount_max']}")
