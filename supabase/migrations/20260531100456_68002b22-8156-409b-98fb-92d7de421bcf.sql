
CREATE TABLE public.platform_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  handle text NOT NULL,
  verification_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','failed','expired','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  failed_at timestamptz,
  apify_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_verifications TO authenticated;
GRANT ALL ON public.platform_verifications TO service_role;

ALTER TABLE public.platform_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_select_own" ON public.platform_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pv_insert_own" ON public.platform_verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pv_update_own" ON public.platform_verifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pv_delete_own" ON public.platform_verifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_pv_user_platform_status
  ON public.platform_verifications (user_id, platform, status);
CREATE INDEX idx_pv_user_created
  ON public.platform_verifications (user_id, created_at DESC);

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','failed','skipped')),
  ADD COLUMN IF NOT EXISTS verified_platform text,
  ADD COLUMN IF NOT EXISTS verified_handle text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_skipped boolean NOT NULL DEFAULT false;

ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS creator_verified boolean NOT NULL DEFAULT false;
