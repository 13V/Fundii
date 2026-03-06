-- =====================================================
-- Migration 002: Leads, Purchases, Applications
-- Run in Supabase SQL Editor
-- =====================================================

-- TABLE: leads
-- Email captures from the quiz funnel (unauthenticated)
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  state           TEXT,
  industry        TEXT,
  business_size   TEXT,
  purposes        TEXT[] DEFAULT '{}',
  matched_count   INTEGER,
  source          TEXT DEFAULT 'quiz',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public insert allowed (quiz is unauthenticated)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert a lead" ON leads FOR INSERT WITH CHECK (true);
-- Only service role can read leads (for email sending)


-- TABLE: purchases
-- Stripe payment records for the $199 application drafter
CREATE TABLE IF NOT EXISTS purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id),
  grant_id            TEXT,                         -- references grants(id) which is TEXT
  tier                TEXT CHECK (tier IN ('apply', 'apply_pro')),
  amount_cents        INTEGER NOT NULL,
  stripe_session_id   TEXT UNIQUE,
  stripe_payment_id   TEXT,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);
-- Inserts/updates done by service role via webhook


-- TABLE: applications
-- AI-generated grant application drafts (paid feature)
CREATE TABLE IF NOT EXISTS applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  grant_id        TEXT,
  purchase_id     UUID REFERENCES purchases(id),
  business_name   TEXT,
  intake_data     JSONB,
  generated_text  TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own applications" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own applications" ON applications FOR UPDATE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
