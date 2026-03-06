-- Migration: add subscription fields to profiles
-- Run this in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS plan                    TEXT CHECK (plan IN ('starter', 'growth', 'enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'cancelled', 'unpaid')),
  ADD COLUMN IF NOT EXISTS subscription_ends_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
