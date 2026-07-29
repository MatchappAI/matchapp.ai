
-- 1) Restrict avatar listing: drop overly broad SELECT, allow owner-only listing.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Users can list their own avatar files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2) Realtime: scope agent_messages topic to the owning user.
CREATE POLICY "Users can read their own agent_messages channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'agent_messages:%'
  AND split_part(realtime.topic(), ':', 2) = (SELECT auth.uid())::text
);

-- 3) usage_tracking: lock UPDATE so users cannot rewrite to another user_id.
DROP POLICY IF EXISTS ut_update_own ON public.usage_tracking;
CREATE POLICY ut_update_own ON public.usage_tracking
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
