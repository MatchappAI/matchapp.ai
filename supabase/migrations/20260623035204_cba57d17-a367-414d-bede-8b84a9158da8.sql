
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('matchai-poll-replies');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('matchai-process-follow-ups');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'matchai-poll-replies',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app/api/public/hooks/poll-replies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqd3dodGt3dHh1Y3NsamVpa3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjY3MDQsImV4cCI6MjA5NTQwMjcwNH0.XxeqbVVC165kq8s8sTeEHEWXQYTwzp9sZygjpDShVlE'
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
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqd3dodGt3dHh1Y3NsamVpa3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjY3MDQsImV4cCI6MjA5NTQwMjcwNH0.XxeqbVVC165kq8s8sTeEHEWXQYTwzp9sZygjpDShVlE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
