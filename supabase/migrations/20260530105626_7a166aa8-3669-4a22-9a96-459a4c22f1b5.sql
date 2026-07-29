
-- Restrict realtime channel subscriptions: only allow users to subscribe to their own notification topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own notification channel" ON realtime.messages;
CREATE POLICY "Users can read their own notification channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'notifications:%'
    AND split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
  );
