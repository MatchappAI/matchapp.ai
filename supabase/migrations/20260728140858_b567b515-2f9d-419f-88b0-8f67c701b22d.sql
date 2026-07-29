-- 1) Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autonomy_level smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS autopilot_daily_send_cap int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS autopilot_daily_spend_cents int NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS unsubscribe_footer_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_autonomy_level_chk CHECK (autonomy_level BETWEEN 0 AND 3);

-- 2) agent_audit_log
CREATE TABLE public.agent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id text,
  autonomy_level smallint NOT NULL DEFAULT 2,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_audit_log_user_created_idx ON public.agent_audit_log (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.agent_audit_log TO authenticated;
GRANT ALL ON public.agent_audit_log TO service_role;
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_own" ON public.agent_audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_update_own" ON public.agent_audit_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Inserts happen server-side via service_role; no anon/authenticated insert policy.

-- 3) suppression_list
CREATE TABLE public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE INDEX suppression_list_user_idx ON public.suppression_list (user_id);

GRANT SELECT, INSERT, DELETE ON public.suppression_list TO authenticated;
GRANT ALL ON public.suppression_list TO service_role;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supp_select_own" ON public.suppression_list FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "supp_insert_own" ON public.suppression_list FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supp_delete_own" ON public.suppression_list FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) payout_attempts
CREATE TABLE public.payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_transfer_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_attempts_user_created_idx ON public.payout_attempts (user_id, created_at DESC);

GRANT SELECT ON public.payout_attempts TO authenticated;
GRANT ALL ON public.payout_attempts TO service_role;
ALTER TABLE public.payout_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_attempts_select_own" ON public.payout_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);