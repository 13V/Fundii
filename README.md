# 🇦🇺 Australian Grant Scraper v2 — Comprehensive

Scrapes grants from **17+ sources** across all levels of Australian government plus industry-specific portals.

## Sources (17+)

### Federal
| Source | URL | What it covers |
|---|---|---|
| business.gov.au | business.gov.au/grants-and-programs | Main federal grants finder (200+ programs) |
| GrantConnect | grants.gov.au | Official centralised federal grant opportunities |
| Community Grants Hub | communitygrants.gov.au | Community & social sector grants |

### All 8 States & Territories
| State | Portal | URL |
|---|---|---|
| NSW | NSW Grants & Funding | nsw.gov.au/grants-and-funding |
| VIC | Business Victoria | business.vic.gov.au/grants-and-programs |
| QLD | Business Queensland | business.qld.gov.au/.../grants |
| SA | SA.gov.au | sa.gov.au/.../business-grants |
| WA | Small Business WA + WA Grants Register | smallbusiness.wa.gov.au/grants |
| TAS | Business Tasmania + State Growth | business.tas.gov.au/funding |
| NT | NT Business Grants | nt.gov.au/industry/business-grants-funding |
| ACT | ACT Business Support | act.gov.au/business/business-support-and-grants |

### Industry-Specific
| Source | Focus |
|---|---|
| ARENA | Renewable energy grants |
| CSIRO Kick-Start | R&D matched funding for SMEs |
| Austrade | Export & international trade |
| QLD Innovation | Innovation & R&D grants |

## Quick Start

```bash
pip install -r requirements.txt

# Scrape everything (takes 10-30 mins depending on site response times)
python scraper.py

# Scrape with enrichment (visits detail pages — slower but much better data)
python scraper.py --enrich

# Scrape just federal sources
python scraper.py --source federal

# Scrape just one state
python scraper.py --state SA

# Scrape just industry sources
python scraper.py --source industry

# Combine flags
python scraper.py --state QLD --enrich --max-enrich 50
```

## Output Schema

| Field | Type | Example |
|---|---|---|
| `id` | string | `bga_048215` |
| `title` | string | `Export Market Development Grant` |
| `description` | string | Summary of the grant |
| `source` | string | `business.gov.au` |
| `source_url` | string | Direct link to grant page |
| `amount_min` | int/null | `5000` |
| `amount_max` | int/null | `50000` |
| `amount_text` | string | `$5,000 to $50,000` |
| `eligibility_summary` | string | Who can apply |
| `industries` | string | `Technology,Export` |
| `states` | string | `SA`, `National` |
| `business_sizes` | string | `Small,Startup` |
| `grant_type` | string | `grant`, `loan`, `rebate`, `tax_incentive`, `voucher` |
| `status` | string | `open`, `closed`, `ongoing`, `upcoming`, `unknown` |
| `open_date` | string | When applications opened |
| `close_date` | string | Application deadline |
| `application_url` | string | Where to apply |
| `category` | string | `federal`, `state`, `community`, `energy`, `research`, `export` |
| `funding_body` | string | Which department/agency |
| `scraped_at` | string | ISO 8601 timestamp |

## Outputs

- `grants_data.csv` — Open in Excel/Sheets, import into Airtable
- `grants_data.json` — Feed into your API/database
- `scraper.log` — Full log of what was scraped

## Adding More Sources

Create a new scraper class or use the generic `StateGrantScraper`:

```python
# Quick: Use the generic state scraper
new_scraper = StateGrantScraper(
    name="My New Source",
    base_url="https://example.gov.au",
    grants_url="https://example.gov.au/grants",
    state_code="NSW"
)
grants = new_scraper.scrape()

# Or: Create a custom scraper class for complex sites
class MyCustomScraper:
    def scrape(self) -> List[Grant]:
        # Your custom logic here
        pass
```

### More sources to consider adding:
- Local council grants (200+ councils across Australia)
- ARC (Australian Research Council) grants
- NHMRC (medical research)
- Philanthropy / foundation grants (Ian Potter, Myer, etc.)
- Business incubator/accelerator programs
- Regional Development Australia grants

## Automation with n8n

```
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

Suggested workflow:
1. **Cron trigger** → daily or weekly
2. **Execute Command** → `python scraper.py --enrich`
3. **Read JSON** → load `grants_data.json`
4. **Compare** → diff against previous run to find new/changed grants
5. **Alert** → email/Slack/webhook for new matching grants
6. **Database** → upsert to Supabase/Airtable/Postgres

## Notes

- Rate limited to 1 request per 2 seconds (respectful scraping)
- Exponential backoff on failures
- Government sites change HTML structure — selectors may need updates
- Some sites (GrantConnect) may require registration for full access
- Run `--enrich` periodically for best data quality
- The `--state` flag is useful for testing individual sources
