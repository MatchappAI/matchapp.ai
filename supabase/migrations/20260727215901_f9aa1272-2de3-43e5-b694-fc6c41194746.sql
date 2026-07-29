
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_mode text NOT NULL DEFAULT 'manual'
    CHECK (payout_mode IN ('auto','manual'));

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  kind text NOT NULL,
  escrow_id uuid,
  stripe_transfer_id text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx
  ON public.wallet_ledger (user_id, created_at DESC);

GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_ledger_select_own"
  ON public.wallet_ledger FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
