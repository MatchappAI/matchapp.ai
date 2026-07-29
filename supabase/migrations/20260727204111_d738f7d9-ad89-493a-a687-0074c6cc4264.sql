ALTER TABLE public.platform_verifications
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'bio_code',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_email_mask text,
  ADD COLUMN IF NOT EXISTS email_code_hash text,
  ADD COLUMN IF NOT EXISTS email_code_sent_at timestamptz;

ALTER TABLE public.platform_verifications
  DROP CONSTRAINT IF EXISTS platform_verifications_method_check;
ALTER TABLE public.platform_verifications
  ADD CONSTRAINT platform_verifications_method_check
  CHECK (method IN ('bio_code','email_code'));