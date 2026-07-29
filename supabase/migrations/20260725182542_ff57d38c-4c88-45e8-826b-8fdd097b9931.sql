
-- 1. Webhook idempotency ledger
CREATE TABLE public.stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_processed_events TO service_role;
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (webhook) reads/writes.

-- 2. Dispute / freeze state on escrow
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;

-- Admin authorization helper: callable by authenticated users to check the caller's own admin/owner status.
-- Wraps private.has_role so the SECURITY DEFINER function keeps working
-- while giving server code a stable name.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'owner'::public.app_role);
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
