
-- P1 batch: terms acceptance, auto-release, deliverable proof gate
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip text,
  ADD COLUMN IF NOT EXISTS terms_accepted_email text,
  ADD COLUMN IF NOT EXISTS release_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_release_days integer NOT NULL DEFAULT 3;

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Schedule auto-release cron (every 5 minutes)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret FROM public.cron_secret WHERE id = true;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'cron_secret missing, skipping auto-release schedule';
    RETURN;
  END IF;

  -- Remove any prior version so re-runs are idempotent
  BEGIN
    PERFORM cron.unschedule('auto-release-escrow');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'auto-release-escrow',
    '*/5 * * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://project--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app/api/public/hooks/auto-release-escrow',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, v_secret)
  );
END $$;
