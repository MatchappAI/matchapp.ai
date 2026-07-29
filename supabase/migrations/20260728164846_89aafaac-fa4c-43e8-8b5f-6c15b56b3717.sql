
-- 1. Demo / data-source flags
ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS evidence jsonb;
ALTER TABLE public.brand_contacts
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_alternate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS wrong_contact_at timestamptz;
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS bounce_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source text;

-- 2. Multi-category + creator prefs on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_category text,
  ADD COLUMN IF NOT EXISTS secondary_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_category text,
  ADD COLUMN IF NOT EXISTS content_formats text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dream_brands text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_brands text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ugc_interest boolean,
  ADD COLUMN IF NOT EXISTS affiliate_gifting_prefs jsonb;

-- 3. Analytics events (admin-only reads; writes via service_role)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_events_admin_read" ON public.analytics_events;
CREATE POLICY "analytics_events_admin_read" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  area text NOT NULL,
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_events_admin_read" ON public.error_events;
CREATE POLICY "error_events_admin_read" ON public.error_events
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.demo_fallback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  reason text NOT NULL,
  attempted_real_count integer NOT NULL DEFAULT 0,
  fallback_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_fallback_events TO authenticated;
GRANT ALL ON public.demo_fallback_events TO service_role;
ALTER TABLE public.demo_fallback_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demo_fallback_events_admin_read" ON public.demo_fallback_events;
CREATE POLICY "demo_fallback_events_admin_read" ON public.demo_fallback_events
  FOR SELECT TO authenticated USING (public.is_admin());

-- 4. Structured negotiations
CREATE TABLE IF NOT EXISTS public.negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  brand_match_id uuid REFERENCES public.brand_matches(id) ON DELETE SET NULL,
  brand_intent text,
  campaign_type text,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  initial_offer numeric,
  creator_minimum numeric,
  recommended_target numeric,
  current_counter numeric,
  usage_rights text,
  exclusivity text,
  revision_rounds integer,
  payment_terms text,
  stage text NOT NULL DEFAULT 'discovery',
  last_message_at timestamptz,
  next_recommended_action text,
  awaiting_creator_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiations TO authenticated;
GRANT ALL ON public.negotiations TO service_role;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "negotiations_owner_all" ON public.negotiations;
CREATE POLICY "negotiations_owner_all" ON public.negotiations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS negotiations_updated_at ON public.negotiations;
CREATE TRIGGER negotiations_updated_at BEFORE UPDATE ON public.negotiations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
