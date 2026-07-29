CREATE TABLE public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_memory TO authenticated;
GRANT ALL ON public.agent_memory TO service_role;

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent memory"
ON public.agent_memory FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_agent_memory_user_key ON public.agent_memory(user_id, key);

CREATE TRIGGER trg_agent_memory_updated_at
BEFORE UPDATE ON public.agent_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pending chat approvals (single-use tokens for approve/reject flow)
CREATE TABLE public.chat_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_pending_actions TO authenticated;
GRANT ALL ON public.chat_pending_actions TO service_role;

ALTER TABLE public.chat_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending actions"
ON public.chat_pending_actions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_pending_user_status ON public.chat_pending_actions(user_id, status);