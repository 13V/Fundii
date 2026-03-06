-- ============================================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state            TEXT,
  industries       TEXT[] DEFAULT '{}',
  business_size    TEXT,
  revenue_range    TEXT,
  funding_purposes TEXT[] DEFAULT '{}',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  plan                    TEXT CHECK (plan IN ('starter', 'growth', 'enterprise')),
  subscription_status     TEXT,
  subscription_ends_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan                   TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ends_at   TIMESTAMPTZ;

-- SAVED GRANTS
CREATE TABLE IF NOT EXISTS saved_grants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applying','applied','awarded')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, grant_id)
);

-- DRAFTS
CREATE TABLE IF NOT EXISTS drafts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id      TEXT NOT NULL,
  draft_content TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALERT SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  frequency    TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','fortnightly')),
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- AUTO-CREATE PROFILE WHEN USER SIGNS UP
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
DROP POLICY IF EXISTS "Users manage own saved grants" ON saved_grants;
DROP POLICY IF EXISTS "Users manage own drafts" ON drafts;
DROP POLICY IF EXISTS "Users manage own alerts" ON alert_subscriptions;

CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own saved grants" ON saved_grants FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own drafts" ON drafts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own alerts" ON alert_subscriptions FOR ALL USING (auth.uid() = user_id);
