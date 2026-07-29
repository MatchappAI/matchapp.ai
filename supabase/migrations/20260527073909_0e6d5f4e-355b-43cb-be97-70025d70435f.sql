
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS creator_handle text,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Shared updated_at trigger fn already exists (update_updated_at_column)

-- creator_profiles
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  platforms text[] NOT NULL DEFAULT '{}',
  primary_platform text,
  follower_count integer,
  niche text,
  content_style text,
  tone text,
  target_audience text,
  posting_frequency text,
  past_brand_deals integer,
  average_deal_size integer,
  deal_type_preference text,
  gifted_products_accepted boolean,
  monthly_income_goal integer,
  deals_per_month integer,
  availability_hours integer,
  approval_preference text,
  auto_outreach_comfort boolean,
  min_deal_value integer,
  bio text,
  creator_notes text,
  location text,
  preferred_industries text,
  blocked_industries text,
  media_kit_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_profiles TO authenticated;
GRANT ALL ON public.creator_profiles TO service_role;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp select own" ON public.creator_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cp insert own" ON public.creator_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cp update own" ON public.creator_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_creator_profiles_updated BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- platform_stats
CREATE TABLE IF NOT EXISTS public.platform_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  handle text,
  follower_count integer,
  avg_views integer,
  avg_likes integer,
  engagement_rate numeric,
  top_content_categories text[],
  posting_cadence text,
  recent_post_snapshot text,
  audience_fit text,
  best_post_views integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_stats TO authenticated;
GRANT ALL ON public.platform_stats TO service_role;
ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps select own" ON public.platform_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ps insert own" ON public.platform_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ps update own" ON public.platform_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ps delete own" ON public.platform_stats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_platform_stats_updated BEFORE UPDATE ON public.platform_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_rules
CREATE TABLE IF NOT EXISTS public.agent_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  minimum_rate integer,
  target_rate integer,
  walk_away_rate integer,
  auto_outreach boolean DEFAULT false,
  auto_follow_up boolean DEFAULT false,
  auto_negotiate boolean DEFAULT false,
  approval_before_send boolean DEFAULT true,
  approval_money_terms boolean DEFAULT true,
  approval_contracts boolean DEFAULT true,
  approval_deliverables boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_rules TO authenticated;
GRANT ALL ON public.agent_rules TO service_role;
ALTER TABLE public.agent_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar select own" ON public.agent_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ar insert own" ON public.agent_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ar update own" ON public.agent_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_agent_rules_updated BEFORE UPDATE ON public.agent_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- brand_preferences
CREATE TABLE IF NOT EXISTS public.brand_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  preferred_categories text,
  blocked_categories text,
  worked_with_before text,
  dream_brands text,
  brand_size_preference text,
  values_to_avoid text,
  location_restrictions text,
  additional_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_preferences TO authenticated;
GRANT ALL ON public.brand_preferences TO service_role;
ALTER TABLE public.brand_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp select own" ON public.brand_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bp insert own" ON public.brand_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp update own" ON public.brand_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_brand_preferences_updated BEFORE UPDATE ON public.brand_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  rate_floor integer,
  target_rate integer,
  walk_away_rate integer,
  usage_rights_fee numeric,
  exclusivity_fee numeric,
  rush_fee numeric,
  bundle_discount numeric,
  revision_fee integer,
  creator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr select own" ON public.pricing_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pr insert own" ON public.pricing_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pr update own" ON public.pricing_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payment_accounts
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_connected boolean NOT NULL DEFAULT false,
  stripe_account_id text,
  payout_method text DEFAULT 'bank_transfer',
  escrow_default boolean DEFAULT true,
  invoice_name text,
  invoice_details text,
  tax_info_status text DEFAULT 'needed',
  tax_form_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa select own" ON public.payment_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pa insert own" ON public.payment_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pa update own" ON public.payment_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_payment_accounts_updated BEFORE UPDATE ON public.payment_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ai_analysis
CREATE TABLE IF NOT EXISTS public.ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  creator_score integer,
  recommended_floor integer,
  high_fit_deal_types integer,
  best_brand_categories text[],
  recommended_packages jsonb,
  first_brand_opportunities text[],
  analysis_summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analysis TO authenticated;
GRANT ALL ON public.ai_analysis TO service_role;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa select own" ON public.ai_analysis FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "aa insert own" ON public.ai_analysis FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aa update own" ON public.ai_analysis FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_ai_analysis_updated BEFORE UPDATE ON public.ai_analysis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
