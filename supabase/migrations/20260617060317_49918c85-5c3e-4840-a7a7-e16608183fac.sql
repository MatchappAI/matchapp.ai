
-- 1) brand_contacts: restrict policy to authenticated role
DROP POLICY IF EXISTS "Users manage their own brand contacts" ON public.brand_contacts;
CREATE POLICY "Users manage their own brand contacts"
  ON public.brand_contacts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Add WITH CHECK to every UPDATE policy missing it
ALTER POLICY "aa_update_own" ON public.agent_activity WITH CHECK (auth.uid() = user_id);
ALTER POLICY "am_update_own" ON public.agent_messages WITH CHECK (auth.uid() = user_id);
ALTER POLICY "ar update own" ON public.agent_rules WITH CHECK (auth.uid() = user_id);
ALTER POLICY "aa update own" ON public.ai_analysis WITH CHECK (auth.uid() = user_id);
ALTER POLICY "ar_update_own" ON public.ai_replies WITH CHECK (auth.uid() = user_id);
ALTER POLICY "ar_runs update own" ON public.apify_runs WITH CHECK (auth.uid() = user_id);
ALTER POLICY "approvals_update_own" ON public.approvals WITH CHECK (auth.uid() = user_id);
ALTER POLICY "bm update own" ON public.brand_matches WITH CHECK (auth.uid() = user_id);
ALTER POLICY "bp update own" ON public.brand_preferences WITH CHECK (auth.uid() = user_id);
ALTER POLICY "ca_update_own" ON public.connected_accounts WITH CHECK (auth.uid() = user_id);
ALTER POLICY "contracts_update_own" ON public.contracts WITH CHECK (auth.uid() = user_id);
ALTER POLICY "cp update own" ON public.creator_profiles WITH CHECK (auth.uid() = user_id);
ALTER POLICY "deals_update_own" ON public.deals WITH CHECK (auth.uid() = user_id);
ALTER POLICY "deliv_update_own" ON public.deliverables WITH CHECK (auth.uid() = user_id);
ALTER POLICY "et_update_own" ON public.escrow_transactions WITH CHECK (auth.uid() = user_id);
ALTER POLICY "fus_update_own" ON public.follow_up_sequences WITH CHECK (auth.uid() = user_id);
ALTER POLICY "li_update_own" ON public.learning_insights WITH CHECK (auth.uid() = user_id);
ALTER POLICY "nm_update_own" ON public.negotiation_messages WITH CHECK (auth.uid() = user_id);
ALTER POLICY "notif_update_own" ON public.notifications WITH CHECK (auth.uid() = user_id);
ALTER POLICY "om_update_own" ON public.onboarding_messages WITH CHECK (auth.uid() = user_id);
ALTER POLICY "oe_update_own" ON public.outreach_emails WITH CHECK (auth.uid() = user_id);
ALTER POLICY "pa update own" ON public.payment_accounts WITH CHECK (auth.uid() = user_id);
ALTER POLICY "ps update own" ON public.platform_stats WITH CHECK (auth.uid() = user_id);
ALTER POLICY "pv_update_own" ON public.platform_verifications WITH CHECK (auth.uid() = user_id);
ALTER POLICY "pr update own" ON public.pricing_rules WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update their own profile" ON public.profiles WITH CHECK (auth.uid() = user_id);

-- 3) subscriptions: deny user-initiated writes (service role bypasses RLS for billing logic)
CREATE POLICY "subscriptions_no_user_insert"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "subscriptions_no_user_update"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "subscriptions_no_user_delete"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (false);
