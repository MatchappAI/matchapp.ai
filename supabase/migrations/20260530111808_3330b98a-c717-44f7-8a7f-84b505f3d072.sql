-- Onboarding chat messages
CREATE TABLE public.onboarding_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  extracted_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_messages_user ON public.onboarding_messages(user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_messages TO authenticated;
GRANT ALL ON public.onboarding_messages TO service_role;
ALTER TABLE public.onboarding_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY om_select_own ON public.onboarding_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY om_insert_own ON public.onboarding_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY om_update_own ON public.onboarding_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY om_delete_own ON public.onboarding_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Agent chat messages (persistent agent conversation)
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  inline_card_type text,
  inline_card_data jsonb,
  action_triggered text,
  action_result jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  approval_status text DEFAULT 'none' CHECK (approval_status IN ('none','pending','approved','declined','executed','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_messages_user ON public.agent_messages(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY am_select_own ON public.agent_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY am_insert_own ON public.agent_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY am_update_own ON public.agent_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY am_delete_own ON public.agent_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_messages;

-- Per-user external service connections (Gmail, Stripe, social platforms)
CREATE TABLE public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  account_email text,
  connection_id text,
  account_metadata jsonb DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service)
);
CREATE INDEX idx_connected_accounts_user ON public.connected_accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ca_select_own ON public.connected_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ca_insert_own ON public.connected_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ca_update_own ON public.connected_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ca_delete_own ON public.connected_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_connected_accounts_updated
BEFORE UPDATE ON public.connected_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();