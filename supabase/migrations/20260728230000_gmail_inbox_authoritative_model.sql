-- Authoritative Gmail Inbox model.
-- Gmail is the source of truth for creator outreach. Resend is not used here.

CREATE TABLE IF NOT EXISTS public.gmail_oauth_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  token_version integer NOT NULL DEFAULT 1,
  revoked_at timestamptz,
  last_refresh_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_oauth_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gmail_oauth_credentials FROM anon, authenticated;
GRANT ALL ON public.gmail_oauth_credentials TO service_role;

CREATE TABLE IF NOT EXISTS public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL,
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  folder text NOT NULL DEFAULT 'inbox'
    CHECK (folder IN ('inbox', 'sent', 'drafts', 'archive', 'trash')),
  is_unread boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_message_at timestamptz,
  brand_match_id uuid REFERENCES public.brand_matches(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.brand_contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS email_threads_user_folder_last_idx
  ON public.email_threads (user_id, folder, last_message_at DESC);
CREATE INDEX IF NOT EXISTS email_threads_user_unread_idx
  ON public.email_threads (user_id, is_unread) WHERE is_unread;

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address text NOT NULL,
  to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL DEFAULT '',
  text_body text,
  html_body text,
  sent_at timestamptz,
  received_at timestamptz,
  gmail_label_ids text[] NOT NULL DEFAULT '{}',
  in_reply_to text,
  references_header text,
  sync_status text NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS email_messages_thread_time_idx
  ON public.email_messages (thread_id, (COALESCE(received_at, sent_at, created_at)));

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.email_threads(id) ON DELETE SET NULL,
  gmail_draft_id text,
  from_address text NOT NULL,
  to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  html_body text,
  in_reply_to text,
  references_header text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_confirmation', 'sending', 'sent', 'discarded', 'failed')),
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, gmail_draft_id)
);

CREATE TABLE IF NOT EXISTS public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.email_messages(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.email_drafts(id) ON DELETE CASCADE,
  gmail_attachment_id text,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  content_base64 text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((message_id IS NOT NULL) <> (draft_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.email_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'send', 'reply', 'reply_all', 'forward', 'archive', 'trash',
      'discard_draft', 'change_recipients', 'associate_deal'
    )
  ),
  draft_id uuid REFERENCES public.email_drafts(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES public.email_threads(id) ON DELETE SET NULL,
  confirmation_snapshot jsonb NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'executing', 'completed', 'failed', 'cancelled')),
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS email_action_requests_user_status_idx
  ON public.email_action_requests (user_id, status, created_at DESC);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_action_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.email_threads, public.email_messages, public.email_drafts,
  public.email_attachments, public.email_action_requests TO authenticated;
GRANT ALL ON public.email_threads, public.email_messages, public.email_drafts,
  public.email_attachments, public.email_action_requests TO service_role;

CREATE POLICY email_threads_select_own ON public.email_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY email_messages_select_own ON public.email_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY email_drafts_select_own ON public.email_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY email_attachments_select_own ON public.email_attachments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY email_action_requests_select_own ON public.email_action_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- All writes happen through authenticated server actions using service_role.
-- This prevents clients from bypassing confirmation and idempotency.

CREATE TRIGGER gmail_oauth_credentials_set_updated_at
  BEFORE UPDATE ON public.gmail_oauth_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER email_threads_set_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER email_drafts_set_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dormant legacy finance tables remain for migration compatibility, but no
-- authenticated client receives direct access after this migration.
REVOKE ALL ON public.escrow_transactions, public.wallet_ledger,
  public.payout_attempts FROM anon, authenticated;
