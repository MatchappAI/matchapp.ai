
-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_access_status text NOT NULL DEFAULT 'unrestricted',
  ADD COLUMN IF NOT EXISTS monetization_choice text NOT NULL DEFAULT 'undecided',
  ADD COLUMN IF NOT EXISTS qualified_reply_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS creator_agreement_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_free_access_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_free_access_status_check
  CHECK (free_access_status IN ('unrestricted','pricing_decision_required','decided'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_monetization_choice_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_monetization_choice_check
  CHECK (monetization_choice IN ('undecided','stay_free_success_fee','starter_subscription','growth_subscription','pro_subscription'));

-- outreach_emails
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS qualification_confidence numeric,
  ADD COLUMN IF NOT EXISTS qualification_reason text;

-- deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_source text NOT NULL DEFAULT 'matchai_sourced',
  ADD COLUMN IF NOT EXISTS success_fee_rate_locked numeric,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS attribution_evidence jsonb,
  ADD COLUMN IF NOT EXISTS non_commissionable_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_deal_source_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_deal_source_check
  CHECK (deal_source IN ('matchai_sourced','creator_sourced','existing_relationship','manual'));

-- escrow_transactions
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS gross_cash_compensation numeric,
  ADD COLUMN IF NOT EXISTS success_fee_amount numeric,
  ADD COLUMN IF NOT EXISTS creator_net_v2 numeric,
  ADD COLUMN IF NOT EXISTS payment_processing_fee numeric,
  ADD COLUMN IF NOT EXISTS commission_status text NOT NULL DEFAULT 'not_applicable';

ALTER TABLE public.escrow_transactions
  DROP CONSTRAINT IF EXISTS escrow_transactions_commission_status_check;
ALTER TABLE public.escrow_transactions
  ADD CONSTRAINT escrow_transactions_commission_status_check
  CHECK (commission_status IN ('not_applicable','pending','charged','waived','refunded'));
