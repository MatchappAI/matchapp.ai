-- Provider-ready internal outreach and buying-intent model.
-- The UI and server actions write here first; paid providers can attach later
-- without changing product behavior.

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN ('creator', 'brand', 'contact', 'opportunity', 'campaign')),
  outreach_direction text NOT NULL
    CHECK (outreach_direction IN ('creator_to_brand', 'matchai_to_creator', 'matchai_to_brand', 'brand_to_creator')),
  source_record_type text,
  source_record_id uuid,
  display_name text NOT NULL DEFAULT '',
  company_name text,
  email text,
  cc jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform text,
  audience_tags text[] NOT NULL DEFAULT '{}',
  tone_tags text[] NOT NULL DEFAULT '{}',
  notes text,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suppressed', 'delivered', 'failed', 'unsubscribed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
CREATE POLICY contacts_owner_all ON public.contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS contacts_user_target_idx
  ON public.contacts (user_id, target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS contacts_user_email_idx
  ON public.contacts (user_id, lower(email));
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.buying_intent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_match_id uuid REFERENCES public.brand_matches(id) ON DELETE SET NULL,
  source_record_type text NOT NULL DEFAULT 'manual',
  source_record_id uuid,
  signal_type text NOT NULL
    CHECK (signal_type IN (
      'product_drop',
      'new_launch',
      'ugc_ads',
      'creator_repost',
      'ambassador_program',
      'tiktok_shop',
      'hiring',
      'founder_post',
      'funding',
      'competitor_ugc',
      'manual_research'
    )),
  signal_name text NOT NULL DEFAULT '',
  signal_summary text NOT NULL DEFAULT '',
  signal_date timestamptz,
  source_url text,
  brand_name text,
  website text,
  product_name text,
  audience_tags text[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  urgency_score integer NOT NULL DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  ease_to_close_score integer NOT NULL DEFAULT 50 CHECK (ease_to_close_score >= 0 AND ease_to_close_score <= 100),
  fast_pay_score integer NOT NULL DEFAULT 50 CHECK (fast_pay_score >= 0 AND fast_pay_score <= 100),
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.buying_intent_signals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buying_intent_signals TO authenticated;
GRANT ALL ON public.buying_intent_signals TO service_role;
CREATE POLICY buying_intent_signals_owner_all ON public.buying_intent_signals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS buying_intent_signals_user_status_idx
  ON public.buying_intent_signals (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS buying_intent_signals_brand_idx
  ON public.buying_intent_signals (user_id, brand_match_id, created_at DESC);
CREATE TRIGGER buying_intent_signals_set_updated_at
  BEFORE UPDATE ON public.buying_intent_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.brand_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_match_id uuid REFERENCES public.brand_matches(id) ON DELETE SET NULL,
  buying_intent_signal_id uuid REFERENCES public.buying_intent_signals(id) ON DELETE SET NULL,
  source_record_type text NOT NULL DEFAULT 'manual',
  source_record_id uuid,
  outreach_direction text NOT NULL DEFAULT 'creator_to_brand'
    CHECK (outreach_direction IN ('creator_to_brand', 'matchai_to_creator', 'matchai_to_brand', 'brand_to_creator')),
  brand_name text NOT NULL DEFAULT '',
  website text,
  opportunity_title text NOT NULL DEFAULT '',
  opportunity_type text NOT NULL DEFAULT 'partnership'
    CHECK (opportunity_type IN ('partnership', 'ugc', 'sponsorship', 'ambassador', 'licensing', 'retainer', 'recruiting')),
  signal_type text,
  signal_summary text,
  why_now text,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_pay_min integer,
  estimated_pay_max integer,
  fit_score integer NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  cash_likelihood_score integer NOT NULL DEFAULT 0 CHECK (cash_likelihood_score >= 0 AND cash_likelihood_score <= 100),
  fast_pay_score integer NOT NULL DEFAULT 0 CHECK (fast_pay_score >= 0 AND fast_pay_score <= 100),
  pitch_angle text,
  contact_readiness integer NOT NULL DEFAULT 0 CHECK (contact_readiness >= 0 AND contact_readiness <= 100),
  risks text[] NOT NULL DEFAULT '{}',
  competition_risk integer NOT NULL DEFAULT 50 CHECK (competition_risk >= 0 AND competition_risk <= 100),
  creator_preference_fit integer NOT NULL DEFAULT 50 CHECK (creator_preference_fit >= 0 AND creator_preference_fit <= 100),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'pursued', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_opportunities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_opportunities TO authenticated;
GRANT ALL ON public.brand_opportunities TO service_role;
CREATE POLICY brand_opportunities_owner_all ON public.brand_opportunities
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS brand_opportunities_user_status_idx
  ON public.brand_opportunities (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_opportunities_user_brand_idx
  ON public.brand_opportunities (user_id, brand_name, created_at DESC);
CREATE TRIGGER brand_opportunities_set_updated_at
  BEFORE UPDATE ON public.brand_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.outreach_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN ('creator', 'brand', 'contact', 'opportunity', 'campaign')),
  outreach_direction text NOT NULL
    CHECK (outreach_direction IN ('creator_to_brand', 'matchai_to_creator', 'matchai_to_brand', 'brand_to_creator')),
  source_record_type text NOT NULL DEFAULT 'manual',
  source_record_id uuid,
  display_name text NOT NULL DEFAULT '',
  company_name text,
  email text,
  cc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  personalization_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sending', 'sent', 'failed', 'suppressed', 'retry')),
  bounce_state text NOT NULL DEFAULT 'none'
    CHECK (bounce_state IN ('none', 'soft_bounce', 'hard_bounce', 'retrying')),
  compliance_footer boolean NOT NULL DEFAULT true,
  follow_up_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_readiness integer NOT NULL DEFAULT 50 CHECK (contact_readiness >= 0 AND contact_readiness <= 100),
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  notes text,
  review_queue_id uuid REFERENCES public.review_queue(id) ON DELETE SET NULL,
  inbox_draft_id uuid REFERENCES public.email_drafts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.outreach_targets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_targets TO authenticated;
GRANT ALL ON public.outreach_targets TO service_role;
CREATE POLICY outreach_targets_owner_all ON public.outreach_targets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS outreach_targets_user_status_idx
  ON public.outreach_targets (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_targets_user_type_idx
  ON public.outreach_targets (user_id, target_type, created_at DESC);
CREATE TRIGGER outreach_targets_set_updated_at
  BEFORE UPDATE ON public.outreach_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
