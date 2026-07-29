
-- ============================================================
-- PHASE 1: Dashboard core schema
-- ============================================================

-- Helper: shared updated_at trigger function already exists (public.update_updated_at_column)

-- ----------------------------------------------------------------
-- 1. agent_activity
-- ----------------------------------------------------------------
CREATE TABLE public.agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  related_id uuid,
  action_label text,
  action_route text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_activity TO authenticated;
GRANT ALL ON public.agent_activity TO service_role;
ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_select_own" ON public.agent_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "aa_insert_own" ON public.agent_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aa_update_own" ON public.agent_activity FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "aa_delete_own" ON public.agent_activity FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX agent_activity_user_created_idx ON public.agent_activity (user_id, created_at DESC);

-- ----------------------------------------------------------------
-- 2. notifications
-- ----------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  action_route text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ----------------------------------------------------------------
-- 3. approvals
-- ----------------------------------------------------------------
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  approval_type text NOT NULL,
  brand_name text,
  related_id uuid,
  related_table text,
  amount numeric,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  risk_note text,
  ai_recommendation text,
  what_happens_next text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_select_own" ON public.approvals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "approvals_insert_own" ON public.approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "approvals_update_own" ON public.approvals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "approvals_delete_own" ON public.approvals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX approvals_user_status_idx ON public.approvals (user_id, status, created_at DESC);
CREATE TRIGGER approvals_set_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- 4. deals
-- ----------------------------------------------------------------
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_match_id uuid,
  brand_name text NOT NULL,
  package_name text,
  deal_value numeric,
  deliverables text,
  usage_rights text,
  timeline_days integer,
  exclusivity text,
  revision_limit integer,
  payment_terms text,
  escrow_terms text,
  contract_status text NOT NULL DEFAULT 'pending',
  escrow_status text NOT NULL DEFAULT 'awaiting',
  invoice_status text NOT NULL DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_select_own" ON public.deals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deals_insert_own" ON public.deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deals_update_own" ON public.deals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deals_delete_own" ON public.deals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX deals_user_status_idx ON public.deals (user_id, status, created_at DESC);
CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- 5. outreach_emails
-- ----------------------------------------------------------------
CREATE TABLE public.outreach_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_match_id uuid,
  subject text NOT NULL,
  body text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  ai_generated boolean NOT NULL DEFAULT true,
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  replied boolean NOT NULL DEFAULT false,
  opened boolean NOT NULL DEFAULT false,
  performance_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_emails TO authenticated;
GRANT ALL ON public.outreach_emails TO service_role;
ALTER TABLE public.outreach_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oe_select_own" ON public.outreach_emails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "oe_insert_own" ON public.outreach_emails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "oe_update_own" ON public.outreach_emails FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "oe_delete_own" ON public.outreach_emails FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX oe_user_brand_idx ON public.outreach_emails (user_id, brand_match_id);

-- ----------------------------------------------------------------
-- 6. ai_replies
-- ----------------------------------------------------------------
CREATE TABLE public.ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outreach_id uuid,
  brand_reply_text text,
  suggested_reply text,
  sentiment_read text,
  recommended_package text,
  risk_note text,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_replies TO authenticated;
GRANT ALL ON public.ai_replies TO service_role;
ALTER TABLE public.ai_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_select_own" ON public.ai_replies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ar_insert_own" ON public.ai_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ar_update_own" ON public.ai_replies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ar_delete_own" ON public.ai_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. contracts
-- ----------------------------------------------------------------
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid,
  brand_name text,
  brand_signer_name text,
  contract_text text,
  key_clauses text[] DEFAULT '{}',
  risk_notes text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_select_own" ON public.contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "contracts_insert_own" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contracts_update_own" ON public.contracts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "contracts_delete_own" ON public.contracts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- 8. deliverables
-- ----------------------------------------------------------------
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid,
  brand_name text,
  deliverable_type text,
  file_url text,
  caption_draft text,
  post_date date,
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables TO authenticated;
GRANT ALL ON public.deliverables TO service_role;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliv_select_own" ON public.deliverables FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deliv_insert_own" ON public.deliverables FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deliv_update_own" ON public.deliverables FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "deliv_delete_own" ON public.deliverables FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER deliverables_set_updated_at BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- 9. follow_up_sequences
-- ----------------------------------------------------------------
CREATE TABLE public.follow_up_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outreach_id uuid,
  brand_name text,
  sequence_number integer NOT NULL,
  body_strategy text,
  scheduled_at timestamptz,
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_sequences TO authenticated;
GRANT ALL ON public.follow_up_sequences TO service_role;
ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fus_select_own" ON public.follow_up_sequences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fus_insert_own" ON public.follow_up_sequences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fus_update_own" ON public.follow_up_sequences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fus_delete_own" ON public.follow_up_sequences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 10. negotiation_messages
-- ----------------------------------------------------------------
CREATE TABLE public.negotiation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid,
  sender text NOT NULL,
  message_text text NOT NULL,
  ai_recommendation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiation_messages TO authenticated;
GRANT ALL ON public.negotiation_messages TO service_role;
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nm_select_own" ON public.negotiation_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "nm_insert_own" ON public.negotiation_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nm_update_own" ON public.negotiation_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "nm_delete_own" ON public.negotiation_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX nm_deal_idx ON public.negotiation_messages (deal_id, created_at);

-- ----------------------------------------------------------------
-- 11. learning_insights
-- ----------------------------------------------------------------
CREATE TABLE public.learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  insight_title text NOT NULL,
  evidence text,
  expected_impact text,
  recommendation text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_insights TO authenticated;
GRANT ALL ON public.learning_insights TO service_role;
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_select_own" ON public.learning_insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "li_insert_own" ON public.learning_insights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "li_update_own" ON public.learning_insights FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "li_delete_own" ON public.learning_insights FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 12. usage_tracking
-- ----------------------------------------------------------------
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  month_year text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_type, month_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_tracking TO authenticated;
GRANT ALL ON public.usage_tracking TO service_role;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_select_own" ON public.usage_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ut_insert_own" ON public.usage_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ut_update_own" ON public.usage_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Security fix: profiles.email is currently world-readable.
-- Tighten the SELECT policy to authenticated owner only.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE SELECT ON public.profiles FROM anon;
