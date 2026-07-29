-- Unified Discovery Engine
-- Internal, manual-first discovery data model for creator_to_brand and brand_to_creator.

CREATE TABLE IF NOT EXISTS public.discovery_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL
    CHECK (source_type IN ('manual', 'csv', 'onboarding', 'analysis', 'match', 'review', 'system')),
  source_name text NOT NULL DEFAULT '',
  source_ref text,
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discovery_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_sources TO authenticated;
GRANT ALL ON public.discovery_sources TO service_role;
CREATE POLICY discovery_sources_owner_all ON public.discovery_sources
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS discovery_sources_user_created_idx
  ON public.discovery_sources (user_id, created_at DESC);
CREATE TRIGGER discovery_sources_set_updated_at
  BEFORE UPDATE ON public.discovery_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.creator_content_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_profile_id uuid REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  niches text[] NOT NULL DEFAULT '{}',
  content_tags text[] NOT NULL DEFAULT '{}',
  audience_tags text[] NOT NULL DEFAULT '{}',
  tone_tags text[] NOT NULL DEFAULT '{}',
  platform_tags text[] NOT NULL DEFAULT '{}',
  followers_total integer NOT NULL DEFAULT 0,
  followers_by_platform jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement_rate numeric,
  rate_floor integer,
  rate_target integer,
  rate_walk_away integer,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_summary text,
  discovery_source_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_content_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_content_profiles TO authenticated;
GRANT ALL ON public.creator_content_profiles TO service_role;
CREATE POLICY creator_content_profiles_owner_all ON public.creator_content_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS creator_content_profiles_creator_idx
  ON public.creator_content_profiles (creator_profile_id);
CREATE TRIGGER creator_content_profiles_set_updated_at
  BEFORE UPDATE ON public.creator_content_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.brand_content_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_match_id uuid NOT NULL UNIQUE REFERENCES public.brand_matches(id) ON DELETE CASCADE,
  category text,
  product_tags text[] NOT NULL DEFAULT '{}',
  audience_tags text[] NOT NULL DEFAULT '{}',
  tone_tags text[] NOT NULL DEFAULT '{}',
  campaign_tags text[] NOT NULL DEFAULT '{}',
  platform_tags text[] NOT NULL DEFAULT '{}',
  public_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_summary text,
  discovery_source_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_content_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_content_profiles TO authenticated;
GRANT ALL ON public.brand_content_profiles TO service_role;
CREATE POLICY brand_content_profiles_owner_all ON public.brand_content_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS brand_content_profiles_user_idx
  ON public.brand_content_profiles (user_id, created_at DESC);
CREATE TRIGGER brand_content_profiles_set_updated_at
  BEFORE UPDATE ON public.brand_content_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL
    CHECK (direction IN ('creator_to_brand', 'brand_to_creator')),
  creator_profile_id uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL,
  brand_match_id uuid NOT NULL REFERENCES public.brand_matches(id) ON DELETE CASCADE,
  creator_content_profile_id uuid REFERENCES public.creator_content_profiles(id) ON DELETE SET NULL,
  brand_content_profile_id uuid REFERENCES public.brand_content_profiles(id) ON DELETE SET NULL,
  fit_score integer NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  reasons text[] NOT NULL DEFAULT '{}',
  risks text[] NOT NULL DEFAULT '{}',
  pitch_angle text,
  next_action text,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, direction, brand_match_id, creator_content_profile_id, brand_content_profile_id)
);
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_scores TO authenticated;
GRANT ALL ON public.match_scores TO service_role;
CREATE POLICY match_scores_owner_all ON public.match_scores
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS match_scores_user_direction_idx
  ON public.match_scores (user_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS match_scores_review_status_idx
  ON public.match_scores (user_id, review_status, created_at DESC);
CREATE TRIGGER match_scores_set_updated_at
  BEFORE UPDATE ON public.match_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.campaign_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL
    CHECK (direction IN ('creator_to_brand', 'brand_to_creator')),
  title text NOT NULL,
  summary text,
  objective text,
  audience text,
  deliverables text[] NOT NULL DEFAULT '{}',
  budget_min integer,
  budget_max integer,
  pitch_angle text,
  contact_hint text,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  creator_content_profile_id uuid REFERENCES public.creator_content_profiles(id) ON DELETE SET NULL,
  brand_content_profile_id uuid REFERENCES public.brand_content_profiles(id) ON DELETE SET NULL,
  match_score_id uuid UNIQUE REFERENCES public.match_scores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_briefs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefs TO authenticated;
GRANT ALL ON public.campaign_briefs TO service_role;
CREATE POLICY campaign_briefs_owner_all ON public.campaign_briefs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS campaign_briefs_user_idx
  ON public.campaign_briefs (user_id, created_at DESC);
CREATE TRIGGER campaign_briefs_set_updated_at
  BEFORE UPDATE ON public.campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL
    CHECK (direction IN ('creator_to_brand', 'brand_to_creator')),
  name text NOT NULL,
  description text,
  match_score_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  source_discovery_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlists TO authenticated;
GRANT ALL ON public.shortlists TO service_role;
CREATE POLICY shortlists_owner_all ON public.shortlists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS shortlists_user_idx
  ON public.shortlists (user_id, created_at DESC);
CREATE TRIGGER shortlists_set_updated_at
  BEFORE UPDATE ON public.shortlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL
    CHECK (direction IN ('creator_to_brand', 'brand_to_creator')),
  queue_type text NOT NULL
    CHECK (queue_type IN ('match', 'campaign_brief', 'analysis', 'shortlist')),
  match_score_id uuid REFERENCES public.match_scores(id) ON DELETE CASCADE,
  campaign_brief_id uuid REFERENCES public.campaign_briefs(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  reason text,
  next_action text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_queue TO authenticated;
GRANT ALL ON public.review_queue TO service_role;
CREATE POLICY review_queue_owner_all ON public.review_queue
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS review_queue_user_status_idx
  ON public.review_queue (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS review_queue_user_direction_idx
  ON public.review_queue (user_id, direction, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS review_queue_match_score_unique
  ON public.review_queue (match_score_id)
  WHERE match_score_id IS NOT NULL;
CREATE TRIGGER review_queue_set_updated_at
  BEFORE UPDATE ON public.review_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL
    CHECK (job_type IN ('creator_analysis', 'brand_analysis', 'match_scoring', 'shortlist_refresh', 'review_publish')),
  direction text
    CHECK (direction IN ('creator_to_brand', 'brand_to_creator')),
  source_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  entity_id uuid,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_jobs TO authenticated;
GRANT ALL ON public.discovery_jobs TO service_role;
CREATE POLICY discovery_jobs_owner_all ON public.discovery_jobs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS discovery_jobs_user_status_idx
  ON public.discovery_jobs (user_id, status, created_at DESC);
CREATE TRIGGER discovery_jobs_set_updated_at
  BEFORE UPDATE ON public.discovery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
