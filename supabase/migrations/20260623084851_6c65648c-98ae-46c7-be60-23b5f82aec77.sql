
-- Recreate cron_secret in public so service_role can reach it via PostgREST.
CREATE TABLE IF NOT EXISTS public.cron_secret (
  id boolean PRIMARY KEY DEFAULT true,
  secret text NOT NULL,
  CONSTRAINT cron_secret_singleton CHECK (id = true)
);

-- Seed from private.cron_secret (preserves any value already generated)
INSERT INTO public.cron_secret (id, secret)
SELECT true, secret FROM private.cron_secret WHERE id = true
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cron_secret (id, secret)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.cron_secret FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cron_secret TO service_role;

ALTER TABLE public.cron_secret ENABLE ROW LEVEL SECURITY;
-- No policies: authenticated/anon are denied even if they obtained table grants.

-- Update helper to read from public so cron continues to work
CREATE OR REPLACE FUNCTION private.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT secret FROM public.cron_secret WHERE id = true $$;
