# GrantMate — AI-Powered Grant Finder for Australian SMEs

## What This Project Is
GrantMate is a SaaS product that helps Australian small businesses find government grants they're eligible for, matches them with a scoring algorithm, and uses AI to draft grant applications. Think "Canva for grants" — dead simple, fast, affordable.

## Business Context
- **Market**: $90B+ in Australian grants annually across 7,000+ programs, fragmented across 40+ government websites
- **Problem**: SMEs either miss grants entirely or pay consultants $5K-$15K per application
- **Solution**: AI matching + AI application drafting at $79-199/mo
- **Competitors**: Grant'd (AI matching but no drafting), The Grants Hub (manual database), GrantGuru (dated UX)
- **Our edge**: Only platform combining AI matching WITH AI application drafting for Australian SMEs
- **Target users**: Australian SMEs (1-200 employees), tradies, construction, manufacturing, tech, agriculture, retail, hospitality — primarily SA/QLD initially
- **Secondary target**: Accountants/bookkeepers managing grants for clients (channel partner play)

## Tech Stack
- **Frontend**: React (Next.js) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Hosting**: Vercel (free tier to start)
- **AI**: Anthropic Claude API (Sonnet) for application drafting
- **Scraper**: Python (requests + BeautifulSoup) running on cron/n8n for grant data collection
- **Payments**: Stripe (when ready)

## Brand Identity
- **Name**: GrantMate
- **Tagline**: "Free money, found fast" / "Your AI grant assistant"
- **Tone**: Straight-talking, friendly, no bullshit — like a mate who knows grants
- **Colors**: Deep teal (#00897B) for trust/growth, Navy (#1B2A4A) for professionalism, Gold (#F5A623) for money/success
- **Visual style**: Clean, modern, fast (think Canva/Xero aesthetic)

## Project Structure
```
grantmate/
├── CLAUDE.md              # This file — project context
├── docs/                  # Business docs and research
│   └── Grant_Finder_Competitive_Analysis.docx
├── scraper/               # Python grant scraper
│   ├── scraper.py         # Scrapes 40+ AU government grant sources
│   └── requirements.txt
├── app/                   # React frontend (to be converted to Next.js)
│   └── GrantMate.jsx      # Current MVP component
├── supabase/              # Database schema and edge functions (to build)
└── public/                # Static assets (to add)
```

## Key Features (MVP)
1. **Matching Quiz** — 5 questions (state, industry, size, revenue, purpose) → personalised grant results with % match scores
2. **Grant Database** — Scraped from 40+ government sources, auto-updated
3. **User Accounts** — Save grants, track applications, persistent profiles (Supabase Auth)
4. **AI Application Drafter** — Claude API generates tailored first draft per grant using user profile + grant criteria
5. **Weekly Email Alerts** — New matching grants delivered to inbox (Supabase Edge Functions + Resend/Postmark)

## Database Schema (Supabase)
Key tables needed:
- `grants` — id, title, source, source_url, amount_min, amount_max, amount_text, states[], industries[], business_sizes[], status, close_date, description, eligibility, grant_type, category, created_at, updated_at
- `profiles` — id (FK auth.users), state, industries[], business_size, revenue_range, funding_purposes[], created_at
- `saved_grants` — id, user_id (FK), grant_id (FK), status (saved/applying/applied/awarded), notes, created_at
- `drafts` — id, user_id (FK), grant_id (FK), draft_content, version, created_at
- `alert_subscriptions` — id, user_id (FK), email, frequency, active, last_sent_at

## Matching Algorithm
Weighted scoring across 5 dimensions:
- State match: 30 points (national grants always match)
- Industry match: 25 points
- Business size match: 20 points
- Revenue/amount relevance: 15 points
- Funding purpose alignment: 10 points
Grants below 30% match are filtered out. Results sorted by match score descending.

## Scraper Sources (44 categories)
Federal: business.gov.au, GrantConnect, Community Grants Hub, ARENA, CSIRO Kick-Start, Austrade
State: NSW, VIC, QLD, SA, WA (×2), TAS (×2), NT, ACT portals
Industry-specific: Defence, agriculture, energy, health, education sources

## Revenue Model
- Free tier: Quiz + see top 3 matches (lead gen)
- Starter ($49/mo): Full matches + weekly alerts
- Pro ($79/mo): Everything + AI application drafter (5 drafts/mo)
- Business ($199/mo): Unlimited drafts + priority support + accountant dashboard

## Current Status
- [x] Competitive analysis complete
- [x] Scraper built (needs deployment)
- [x] React MVP built (needs Next.js conversion)
- [ ] Supabase schema + auth setup
- [ ] Deploy scraper on schedule
- [ ] Stripe integration
- [ ] Landing page SEO
- [ ] Email alert system

## Development Priorities
1. Convert MVP React component to Next.js app with proper routing
2. Set up Supabase project (schema, auth, RLS policies)
3. Deploy scraper and populate grants table
4. Wire up AI drafter to Claude API via edge function (keep API key server-side)
5. Add Stripe for paid tiers
6. Build email alert cron job

## Important Notes
- Keep API keys server-side only (Supabase Edge Functions or Next.js API routes)
- All grant data should be treated as public information (government sources)
- Scraper respects rate limits (2s delay between requests)
- Facebook Marketplace scraping is off-limits (ToS issues) — this is grants only
- Target launch: working MVP within 2-3 weeks
