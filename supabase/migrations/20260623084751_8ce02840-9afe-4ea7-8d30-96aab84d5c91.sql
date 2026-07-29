
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_secret (
  id boolean PRIMARY KEY DEFAULT true,
  secret text NOT NULL,
  CONSTRAINT cron_secret_singleton CHECK (id = true)
);

INSERT INTO private.cron_secret (id, secret)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON private.cron_secret FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.cron_secret TO service_role;

CREATE OR REPLACE FUNCTION private.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = private
AS $$ SELECT secret FROM private.cron_secret WHERE id = true $$;

REVOKE ALL ON FUNCTION private.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_cron_secret() TO service_role;

-- Tighten owner-write policy: block by role name (text), future-proof against
-- new privileged roles like 'staff' being added to the enum later.
DROP POLICY IF EXISTS "owners manage non-elevated roles" ON public.user_roles;
CREATE POLICY "owners manage non-elevated roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    private.has_role(auth.uid(), 'owner'::public.app_role)
    AND lower(role::text) <> ALL (ARRAY['owner','admin','staff'])
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'owner'::public.app_role)
    AND lower(role::text) <> ALL (ARRAY['owner','admin','staff'])
  );

DO $$ BEGIN PERFORM cron.unschedule('matchai-poll-replies'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('matchai-process-follow-ups'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'matchai-poll-replies',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app/api/public/hooks/poll-replies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', private.get_cron_secret()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

SELECT cron.schedule(
  'matchai-process-follow-ups',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app/api/public/hooks/process-follow-ups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', private.get_cron_secret()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
