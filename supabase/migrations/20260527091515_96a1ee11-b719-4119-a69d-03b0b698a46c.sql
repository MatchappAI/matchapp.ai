-- creator_profiles
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS min_deal_value integer;

ALTER TABLE public.creator_profiles
  ALTER COLUMN deal_type_preference TYPE text[] USING
    CASE
      WHEN deal_type_preference IS NULL THEN NULL
      WHEN deal_type_preference = '' THEN NULL
      ELSE ARRAY[deal_type_preference]
    END;

-- agent_rules
ALTER TABLE public.agent_rules
  ADD COLUMN IF NOT EXISTS rules_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_follow_up boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_negotiate boolean NOT NULL DEFAULT true;

-- pricing_rules
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS configured boolean NOT NULL DEFAULT false;

-- payment_accounts
ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS setup_skipped boolean NOT NULL DEFAULT false;

-- brand_preferences
ALTER TABLE public.brand_preferences
  ADD COLUMN IF NOT EXISTS configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dream_brands_text text,
  ADD COLUMN IF NOT EXISTS brand_values text;

-- ai_analysis
ALTER TABLE public.ai_analysis
  ADD COLUMN IF NOT EXISTS pricing_insight text;

-- brand_matches
CREATE TABLE IF NOT EXISTS public.brand_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text NOT NULL,
  brand_industry text,
  fit_score integer,
  fit_reasoning text,
  estimated_deal_min integer,
  estimated_deal_max integer,
  suggested_package text,
  outreach_angle text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_matches TO authenticated;
GRANT ALL ON public.brand_matches TO service_role;
ALTER TABLE public.brand_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm select own" ON public.brand_matches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bm insert own" ON public.brand_matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bm update own" ON public.brand_matches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bm delete own" ON public.brand_matches FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS brand_matches_user_id_idx ON public.brand_matches(user_id);

-- apify_runs
CREATE TABLE IF NOT EXISTS public.apify_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  handle text NOT NULL,
  run_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.apify_runs TO authenticated;
GRANT ALL ON public.apify_runs TO service_role;
ALTER TABLE public.apify_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_runs select own" ON public.apify_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ar_runs insert own" ON public.apify_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ar_runs update own" ON public.apify_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS apify_runs_user_id_idx ON public.apify_runs(user_id);