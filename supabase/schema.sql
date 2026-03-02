-- =====================================================
-- Fundii — Supabase Schema
-- Run this in Supabase SQL Editor (or via CLI)
-- =====================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================
-- TABLE: grants
-- The scraped grant database (populated by scraper)
-- =====================================================
CREATE TABLE IF NOT EXISTS grants (
  id            TEXT PRIMARY KEY,              -- e.g. "g1", or scraper-generated ID
  title         TEXT NOT NULL,
  source        TEXT NOT NULL,                 -- e.g. "business.gov.au"
  source_url    TEXT NOT NULL,
  amount_min    INTEGER,
  amount_max    INTEGER,
  amount_text   TEXT,                          -- Human-readable e.g. "$5,000–$150,000"
  states        TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ARRAY['NSW', 'VIC'] or ARRAY['National']
  industries    TEXT[] NOT NULL DEFAULT '{}',
  business_sizes TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'unknown'
                CHECK (status IN ('open', 'closed', 'ongoing', 'upcoming', 'unknown')),
  close_date    TEXT,
  description   TEXT,
  eligibility   TEXT,
  grant_type    TEXT NOT NULL DEFAULT 'grant'
                CHECK (grant_type IN ('grant', 'loan', 'rebate', 'tax_incentive', 'voucher', 'subsidy', 'scholarship')),
  category      TEXT,
  url           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grants_updated_at
  BEFORE UPDATE ON grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_grants_status ON grants(status);
CREATE INDEX IF NOT EXISTS idx_grants_states ON grants USING GIN(states);
CREATE INDEX IF NOT EXISTS idx_grants_industries ON grants USING GIN(industries);
CREATE INDEX IF NOT EXISTS idx_grants_close_date ON grants(close_date);


-- =====================================================
-- TABLE: profiles
-- Extended user data (linked to auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state            TEXT,                       -- e.g. "SA"
  industries       TEXT[] DEFAULT '{}',
  business_size    TEXT,                       -- e.g. "Small"
  revenue_range    TEXT,                       -- e.g. "500k_2m"
  funding_purposes TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =====================================================
-- TABLE: saved_grants
-- User's saved/tracked grants
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_grants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id   TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'saved'
             CHECK (status IN ('saved', 'applying', 'applied', 'awarded')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, grant_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_grants_user ON saved_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_grants_grant ON saved_grants(grant_id);


-- =====================================================
-- TABLE: drafts
-- AI-generated application drafts
-- =====================================================
CREATE TABLE IF NOT EXISTS drafts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id       TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  draft_content  TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_grant ON drafts(grant_id);


-- =====================================================
-- TABLE: alert_subscriptions
-- Weekly email alert subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  frequency   TEXT NOT NULL DEFAULT 'weekly'
              CHECK (frequency IN ('daily', 'weekly', 'fortnightly')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_active ON alert_subscriptions(active, frequency);


-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- grants: public read, no public write (only service role from scraper)
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grants are publicly readable"
  ON grants FOR SELECT
  USING (true);

-- Only service role (scraper) can insert/update grants
-- (No policy needed — service role bypasses RLS by default)


-- profiles: users can only read/write their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- saved_grants: users can only see/manage their own
ALTER TABLE saved_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved grants"
  ON saved_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their saved grants"
  ON saved_grants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved grants"
  ON saved_grants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved grants"
  ON saved_grants FOR DELETE
  USING (auth.uid() = user_id);


-- drafts: users can only see/manage their own
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their drafts"
  ON drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their drafts"
  ON drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their drafts"
  ON drafts FOR DELETE
  USING (auth.uid() = user_id);


-- alert_subscriptions: users can only manage their own
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their alert subscriptions"
  ON alert_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their alert subscription"
  ON alert_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their alert subscription"
  ON alert_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their alert subscription"
  ON alert_subscriptions FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================
-- SEED: Insert the 16 MVP grants
-- (Run after schema setup to pre-populate the database)
-- =====================================================

INSERT INTO grants (id, title, source, source_url, amount_min, amount_max, amount_text, states, industries, business_sizes, status, close_date, description, eligibility, grant_type, category, url)
VALUES
('g1','Small Business Growth Grants Program WA','business.gov.au','https://business.gov.au/grants-and-programs/small-business-growth-grants-program-wa',2000,10000,'$2,000–$10,000',ARRAY['WA'],ARRAY['General'],ARRAY['Small','Startup'],'open','Ongoing','Matched funding to help eligible small business owners invest in expert advice and services to grow their business, build capability and strengthen long-term success.','Must be a WA-based small business with fewer than 20 FTE employees and turnover under $5M.','voucher','state','https://business.gov.au/grants-and-programs/small-business-growth-grants-program-wa'),
('g2','Export Market Development Grant (EMDG)','business.gov.au','https://business.gov.au/grants-and-programs/export-market-development-grants',5000,150000,'$5,000–$150,000',ARRAY['National'],ARRAY['Export','Manufacturing','Technology','Agriculture','Food & Beverage'],ARRAY['Small','Medium'],'open','Round-based','Reimburses up to 50% of eligible export marketing and promotion expenses to help Australian businesses expand into international markets.','Australian business with income under $20M. Must have spent at least $15,000 on eligible export promotion activities.','grant','export','https://business.gov.au/grants-and-programs/export-market-development-grants'),
('g3','R&D Tax Incentive','business.gov.au','https://business.gov.au/grants-and-programs/research-and-development-tax-incentive',0,0,'Tax offset up to 43.5%',ARRAY['National'],ARRAY['Technology','Manufacturing','Healthcare','Agriculture','Energy','Research'],ARRAY['Small','Medium','Startup'],'open','Ongoing (annual)','Provides a tax offset to encourage Australian companies to invest in research and development activities that might not otherwise be undertaken.','Incorporated company conducting eligible R&D activities in Australia. Must register with AusIndustry within 10 months of income year end.','tax_incentive','federal','https://business.gov.au/grants-and-programs/research-and-development-tax-incentive'),
('g4','Industry Growth Program','business.gov.au','https://business.gov.au/grants-and-programs/industry-growth-program',50000,5000000,'$50,000–$5,000,000',ARRAY['National'],ARRAY['Manufacturing','Technology','Healthcare','Energy','Defence','Agriculture'],ARRAY['Small','Medium','Startup'],'open','Apply anytime (advisory stage)','Supports innovative SMEs to commercialise novel products, processes and services.','Australian SME with innovative product/process in National Reconstruction Fund priority areas.','grant','federal','https://business.gov.au/grants-and-programs/industry-growth-program'),
('g5','CSIRO Kick-Start','business.gov.au','https://business.gov.au/grants-and-programs/csiro-kickstart',10000,50000,'$10,000–$50,000 (matched)',ARRAY['National'],ARRAY['Technology','Manufacturing','Healthcare','Agriculture','Energy','Research'],ARRAY['Small','Startup'],'open','Ongoing','Matched funding for Australian startups and small SMEs to access CSIRO research expertise and capabilities.','Australian startup or SME with fewer than 20 employees and annual turnover under $5M.','grant','research','https://business.gov.au/grants-and-programs/csiro-kickstart'),
('g6','Innovation Connect (ICON) Grants ACT','act.gov.au','https://www.act.gov.au/business/apply-for-grants-and-funding',10000,30000,'$10,000–$30,000 (matched)',ARRAY['ACT'],ARRAY['Technology','General'],ARRAY['Startup','Small'],'open','Ongoing','Matched funding grants for early-stage entrepreneurs and start-ups in the ACT.','ACT-based early-stage business or startup.','grant','state','https://www.act.gov.au/business/apply-for-grants-and-funding'),
('g7','Business Growth Loan Scheme TAS','business.tas.gov.au','https://www.business.tas.gov.au/funding',50000,5000000,'$50,000–$5,000,000',ARRAY['TAS'],ARRAY['General'],ARRAY['Small','Medium'],'open','Ongoing','Low-interest loans to assist Tasmanian businesses to develop, expand or undertake new projects.','Tasmanian business that can demonstrate the project will create jobs and economic growth.','loan','state','https://www.business.tas.gov.au/funding'),
('g8','Innovation Booster Grant WA','business.gov.au','https://business.gov.au/grants-and-programs/innovation-booster-grant-wa',5000,50000,'Up to $50,000 (matched)',ARRAY['WA'],ARRAY['Technology','Manufacturing','Research'],ARRAY['Startup','Small'],'open','Ongoing','Funding for WA start-ups and small businesses to commercialise innovative ideas.','WA-based startup or small business with an innovative product or service to commercialise.','grant','state','https://business.gov.au/grants-and-programs/innovation-booster-grant-wa'),
('g9','Future Made in Australia Innovation Fund','arena.gov.au','https://arena.gov.au/funding/future-made-in-australia-innovation-fund/',500000,50000000,'Up to $1.5 billion total pool',ARRAY['National'],ARRAY['Energy','Manufacturing'],ARRAY['Medium','Small'],'open','Ongoing until exhausted','ARENA-administered fund providing grants for renewable energy and low emission technologies.','Australian entity with project in green metals or renewable energy technology manufacturing.','grant','energy','https://arena.gov.au/funding/future-made-in-australia-innovation-fund/'),
('g10','Regional Economic Development Grants WA','business.gov.au','https://business.gov.au/grants-and-programs/regional-economic-development-grants-wa',25000,250000,'$25,000–$250,000',ARRAY['WA'],ARRAY['General','Agriculture','Tourism','Manufacturing'],ARRAY['Small','Medium'],'open','Round-based','Funding for businesses undertaking projects in regional Western Australia.','Must be a legal entity operating in regional WA. Minimum 50% cash co-contribution required.','grant','state','https://business.gov.au/grants-and-programs/regional-economic-development-grants-wa'),
('g11','Instant Asset Write-Off','ato.gov.au','https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business',0,20000,'Up to $20,000 per asset',ARRAY['National'],ARRAY['General'],ARRAY['Small','Startup','Sole Trader'],'open','30 June 2025 (may extend)','Allows small businesses to immediately deduct the cost of eligible assets under $20,000.','Small business with aggregated annual turnover under $10M.','tax_incentive','federal','https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business'),
('g12','Advance Queensland Industry Research Fellowships','business.qld.gov.au','https://www.business.qld.gov.au/running-business/growing-business/becoming-innovative/grants',50000,200000,'Up to $200,000',ARRAY['QLD'],ARRAY['Technology','Research','Healthcare','Manufacturing','Energy'],ARRAY['Small','Medium','Startup'],'open','Round-based','Supports collaborative research between Queensland businesses and universities.','Queensland-based business partnering with a QLD university.','grant','innovation','https://www.business.qld.gov.au/running-business/growing-business/becoming-innovative/grants'),
('g13','SA Small Business Strategy Grant','sa.gov.au','https://www.sa.gov.au/topics/business-and-trade/business-grants',1000,5000,'$1,000–$5,000',ARRAY['SA'],ARRAY['General'],ARRAY['Small','Startup','Sole Trader'],'open','Ongoing','Helps South Australian small businesses access professional business advice.','SA-based small business. Must use funding for professional advisory services.','grant','state','https://www.sa.gov.au/topics/business-and-trade/business-grants'),
('g14','Defence Industry Development Grant','business.gov.au','https://business.gov.au/grants-and-programs',10000,50000,'$10,000–$50,000',ARRAY['National'],ARRAY['Defence','Manufacturing','Technology'],ARRAY['Small','Medium'],'open','Ongoing','Supports Australian businesses in the defence sector to enhance capabilities.','Australian SME operating in or seeking to enter the defence supply chain.','grant','federal','https://business.gov.au/grants-and-programs'),
('g15','NSW Small Business Fees and Charges Rebate','nsw.gov.au','https://www.nsw.gov.au/grants-and-funding',500,2000,'Up to $2,000',ARRAY['NSW'],ARRAY['General'],ARRAY['Small','Startup','Sole Trader'],'open','Until funds exhausted','Rebate for eligible NSW small businesses to offset the cost of government fees and charges.','NSW small business with total Australian wages below the payroll tax threshold.','rebate','state','https://www.nsw.gov.au/grants-and-funding'),
('g16','Business Victoria Energy Efficiency Grants','business.vic.gov.au','https://business.vic.gov.au/grants-and-programs',5000,20000,'$5,000–$20,000',ARRAY['VIC'],ARRAY['General','Manufacturing','Retail','Tourism'],ARRAY['Small','Medium'],'open','Round-based','Helps Victorian businesses invest in energy-efficient equipment and processes.','Victorian business with an ABN. Must demonstrate how funding will reduce energy consumption.','grant','state','https://business.vic.gov.au/grants-and-programs')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  eligibility = EXCLUDED.eligibility,
  status = EXCLUDED.status,
  updated_at = NOW();
