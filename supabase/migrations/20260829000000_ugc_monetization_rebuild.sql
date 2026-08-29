-- MatchAI UGC Creator AI Monetization rebuild (Aug 28, 2026 build packet).
--
-- New tables are prefixed ugc_ deliberately: public.creator_profiles already
-- exists for the old brand-deal-marketplace product with a different shape
-- (niches/content_tags/rate_floor etc. for brand matching, not AI-agent
-- concept generation) and must not be overwritten or collided with while
-- both products coexist. Per the build packet: inventory and archive the
-- old surface, don't delete production data until the new app is proven.
--
-- FK relationships and RLS are NOT specified in the build packet (confirmed
-- on a full re-read) - both follow this repo's existing convention: tables
-- reference auth.users(id) directly via a *_id column (not profiles.id),
-- RLS is owner-scoped via auth.uid(), and service_role gets full access for
-- server-side routes. No anon/public grants - public-facing reads (the
-- published agent page, the follower chat) go through service-role server
-- routes, matching src/routes/api.chat.agent.ts's existing pattern, not
-- direct anon table access.

CREATE EXTENSION IF NOT EXISTS vector;

-- Extend the existing identity table rather than creating a second one.
-- public.profiles already has creator_handle (text, no uniqueness enforced
-- yet) - reused here as the public /@handle identifier rather than adding a
-- second, confusingly-similar column.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ugc_role text CHECK (ugc_role IN ('creator', 'follower')),
  ADD COLUMN IF NOT EXISTS country text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_creator_handle_unique
  ON public.profiles (creator_handle) WHERE creator_handle IS NOT NULL;

-- 1. Per-creator profile for the AI-concept generator (distinct from the
--    old public.creator_profiles, which serves brand matching).
CREATE TABLE IF NOT EXISTS public.ugc_creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text,
  sub_niches text[] NOT NULL DEFAULT '{}',
  follower_range text,
  platforms text[] NOT NULL DEFAULT '{}',
  bio text,
  extracted_tone text,
  expertise_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  exclusions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_creator_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_creator_profiles TO authenticated;
GRANT ALL ON public.ugc_creator_profiles TO service_role;
CREATE POLICY ugc_creator_profiles_owner_all ON public.ugc_creator_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ugc_creator_profiles_set_updated_at
  BEFORE UPDATE ON public.ugc_creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Uploaded/imported content a creator's agents are built from.
CREATE TABLE IF NOT EXISTS public.ugc_content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video', 'post', 'pdf', 'url', 'other')),
  storage_path text,
  url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_content_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_content_sources TO authenticated;
GRANT ALL ON public.ugc_content_sources TO service_role;
CREATE POLICY ugc_content_sources_owner_all ON public.ugc_content_sources
  FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE INDEX ugc_content_sources_creator_idx ON public.ugc_content_sources (creator_id);

-- 3. Chunked + embedded content for RAG. Chunk size and embedding
--    model/dimension are NOT specified in the build packet - 1536 here
--    matches OpenAI text-embedding-3-small as a starting default; change
--    this column's dimension (and re-embed) if a different model is chosen.
CREATE TABLE IF NOT EXISTS public.ugc_content_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.ugc_content_sources(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(1536),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_content_chunks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.ugc_content_chunks TO authenticated;
GRANT ALL ON public.ugc_content_chunks TO service_role;
CREATE POLICY ugc_content_chunks_owner_all ON public.ugc_content_chunks
  FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE INDEX ugc_content_chunks_source_idx ON public.ugc_content_chunks (source_id);
CREATE INDEX ugc_content_chunks_embedding_idx ON public.ugc_content_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 4. One row per Reddit/demand-research pass for a creator's niche.
CREATE TABLE IF NOT EXISTS public.ugc_demand_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text,
  query_set_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_links_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_demand_research_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ugc_demand_research_runs TO authenticated;
GRANT ALL ON public.ugc_demand_research_runs TO service_role;
CREATE POLICY ugc_demand_research_runs_owner_all ON public.ugc_demand_research_runs
  FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- 5. The 3 ranked AI-product concepts generated per creator.
CREATE TABLE IF NOT EXISTS public.ugc_agent_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  job_to_be_done text,
  rationale text,
  scores_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_price_cents integer,
  status text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'selected', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_agent_opportunities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.ugc_agent_opportunities TO authenticated;
GRANT ALL ON public.ugc_agent_opportunities TO service_role;
CREATE POLICY ugc_agent_opportunities_owner_all ON public.ugc_agent_opportunities
  FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- 6. A creator's published (or draft) AI agent.
CREATE TABLE IF NOT EXISTS public.ugc_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  price_model text NOT NULL DEFAULT 'subscription'
    CHECK (price_model IN ('subscription', 'one_time')),
  price_cents integer NOT NULL DEFAULT 0,
  free_quota integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  -- No voice/likeness cloning, ever - see the build packet's explicit safety
  -- rule. This column exists so that rule is enforced in data, not just docs.
  safety_json jsonb NOT NULL DEFAULT '{"voice_cloning": false, "likeness_cloning": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_agents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugc_agents TO authenticated;
GRANT ALL ON public.ugc_agents TO service_role;
CREATE POLICY ugc_agents_owner_all ON public.ugc_agents
  FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE INDEX ugc_agents_creator_idx ON public.ugc_agents (creator_id);
CREATE TRIGGER ugc_agents_set_updated_at
  BEFORE UPDATE ON public.ugc_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Which content sources ground which agent (many-to-many).
CREATE TABLE IF NOT EXISTS public.ugc_agent_sources (
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.ugc_content_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, source_id)
);
ALTER TABLE public.ugc_agent_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.ugc_agent_sources TO authenticated;
GRANT ALL ON public.ugc_agent_sources TO service_role;
CREATE POLICY ugc_agent_sources_owner_all ON public.ugc_agent_sources
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ugc_agents a WHERE a.id = agent_id AND a.creator_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.ugc_agents a WHERE a.id = agent_id AND a.creator_id = auth.uid())
  );

-- 8. Marketing-consent flag for a follower identity (the follower's own
--    account is an auth.users row, same as a creator's).
CREATE TABLE IF NOT EXISTS public.ugc_followers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_followers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.ugc_followers TO authenticated;
GRANT ALL ON public.ugc_followers TO service_role;
CREATE POLICY ugc_followers_owner_all ON public.ugc_followers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. A follower's paid/trial relationship to one agent.
CREATE TABLE IF NOT EXISTS public.ugc_agent_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  entitlement_status text NOT NULL DEFAULT 'trial'
    CHECK (entitlement_status IN ('trial', 'active', 'past_due', 'canceled')),
  subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, follower_id)
);
ALTER TABLE public.ugc_agent_customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_agent_customers TO authenticated;
GRANT ALL ON public.ugc_agent_customers TO service_role;
CREATE POLICY ugc_agent_customers_follower_select ON public.ugc_agent_customers
  FOR SELECT TO authenticated USING (auth.uid() = follower_id);
CREATE POLICY ugc_agent_customers_creator_select ON public.ugc_agent_customers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ugc_agents a WHERE a.id = agent_id AND a.creator_id = auth.uid())
  );
-- Inserts/updates happen server-side (Stripe webhook) via service_role only.

-- 10. One conversation per follower per agent.
CREATE TABLE IF NOT EXISTS public.ugc_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, follower_id)
);
ALTER TABLE public.ugc_conversations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_conversations TO authenticated;
GRANT ALL ON public.ugc_conversations TO service_role;
CREATE POLICY ugc_conversations_follower_select ON public.ugc_conversations
  FOR SELECT TO authenticated USING (auth.uid() = follower_id);
CREATE POLICY ugc_conversations_creator_select ON public.ugc_conversations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ugc_agents a WHERE a.id = agent_id AND a.creator_id = auth.uid())
  );

-- 11. Messages within a conversation.
CREATE TABLE IF NOT EXISTS public.ugc_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ugc_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  token_usage integer,
  cost_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_messages TO authenticated;
GRANT ALL ON public.ugc_messages TO service_role;
CREATE POLICY ugc_messages_participant_select ON public.ugc_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ugc_conversations c
      LEFT JOIN public.ugc_agents a ON a.id = c.agent_id
      WHERE c.id = conversation_id AND (c.follower_id = auth.uid() OR a.creator_id = auth.uid())
    )
  );
CREATE INDEX ugc_messages_conversation_idx ON public.ugc_messages (conversation_id, created_at);

-- 12. Long-lived per-follower memory an agent draws on across conversations.
CREATE TABLE IF NOT EXISTS public.ugc_follower_memory (
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, follower_id)
);
ALTER TABLE public.ugc_follower_memory ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ugc_follower_memory TO service_role;
-- Server-side only (the chat route reads/writes this with service_role);
-- no direct client access in either direction.

-- 13. Every dollar moved: gross, MatchAI's cut, processor fee, creator net.
CREATE TABLE IF NOT EXISTS public.ugc_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  processor_fee_cents integer NOT NULL DEFAULT 0,
  creator_net_cents integer NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'refunded', 'disputed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_transactions TO authenticated;
GRANT ALL ON public.ugc_transactions TO service_role;
CREATE POLICY ugc_transactions_creator_select ON public.ugc_transactions
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE INDEX ugc_transactions_creator_idx ON public.ugc_transactions (creator_id, created_at DESC);

-- 14. Stripe Connect Express onboarding state per creator.
CREATE TABLE IF NOT EXISTS public.ugc_payout_accounts (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text,
  onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'complete')),
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_payout_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_payout_accounts TO authenticated;
GRANT ALL ON public.ugc_payout_accounts TO service_role;
CREATE POLICY ugc_payout_accounts_owner_select ON public.ugc_payout_accounts
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE TRIGGER ugc_payout_accounts_set_updated_at
  BEFORE UPDATE ON public.ugc_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. One referral per referred creator; 25% of MatchAI's platform revenue
--     (= 5% of referred GMV) to the referrer for 12 months from attribution.
CREATE TABLE IF NOT EXISTS public.ugc_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_creator_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 months')
);
ALTER TABLE public.ugc_referrals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_referrals TO authenticated;
GRANT ALL ON public.ugc_referrals TO service_role;
CREATE POLICY ugc_referrals_referrer_select ON public.ugc_referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_creator_id);

-- 16. Per-transaction referral payout, so earnings are never double-attributed.
CREATE TABLE IF NOT EXISTS public.ugc_referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.ugc_referrals(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.ugc_transactions(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_referral_earnings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ugc_referral_earnings TO authenticated;
GRANT ALL ON public.ugc_referral_earnings TO service_role;
CREATE POLICY ugc_referral_earnings_referrer_select ON public.ugc_referral_earnings
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ugc_referrals r WHERE r.id = referral_id AND r.referrer_creator_id = auth.uid())
  );

-- 17. Creator or follower feedback on a specific agent message.
CREATE TABLE IF NOT EXISTS public.ugc_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ugc_agents(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ugc_messages(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  correction_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(creator_id, follower_id) = 1)
);
ALTER TABLE public.ugc_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ugc_feedback TO authenticated;
GRANT ALL ON public.ugc_feedback TO service_role;
CREATE POLICY ugc_feedback_author_all ON public.ugc_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = follower_id)
  WITH CHECK (auth.uid() = creator_id OR auth.uid() = follower_id);

-- 18. Background job queue (content processing, embedding, concept generation).
CREATE TABLE IF NOT EXISTS public.ugc_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ugc_jobs TO service_role;
-- Server-side only - no authenticated/anon grants.
CREATE TRIGGER ugc_jobs_set_updated_at
  BEFORE UPDATE ON public.ugc_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 19. Audit trail for the rebuild's own actions (separate from the existing
--     agent_audit_log, which is scoped to the old brand-deal agent).
CREATE TABLE IF NOT EXISTS public.ugc_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ugc_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ugc_audit_logs TO service_role;
CREATE INDEX ugc_audit_logs_entity_idx ON public.ugc_audit_logs (entity_type, entity_id, created_at DESC);

-- Retrieval for the follower-facing chat agent: nearest chunks for one
-- creator's content only (never cross-creator - see the packet's own
-- acceptance test on data isolation). security definer so it can run under
-- the caller's own role while still reading ugc_content_chunks, which has
-- no anon/authenticated SELECT grant.
CREATE OR REPLACE FUNCTION public.match_ugc_content_chunks(
  p_creator_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer DEFAULT 6
)
RETURNS TABLE (id uuid, chunk_text text, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, chunk_text, 1 - (embedding <=> p_query_embedding) AS similarity
  FROM public.ugc_content_chunks
  WHERE creator_id = p_creator_id
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_ugc_content_chunks(uuid, vector, integer) TO service_role;
