
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS tracking_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_provider text NOT NULL DEFAULT 'gmail',
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS outreach_emails_tracking_id_key
  ON public.outreach_emails(tracking_id);

ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS funding_url text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

CREATE UNIQUE INDEX IF NOT EXISTS escrow_transactions_public_token_key
  ON public.escrow_transactions(public_token);
