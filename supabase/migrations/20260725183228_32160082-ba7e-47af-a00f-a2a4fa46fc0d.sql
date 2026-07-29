-- 1) Outreach campaigns (bounded pre-approval rules)
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'approve_each' CHECK (mode IN ('manual','approve_each','pre_approved')),
  brand_match_ids uuid[] NOT NULL DEFAULT '{}',
  daily_send_cap int NOT NULL DEFAULT 10 CHECK (daily_send_cap >= 0 AND daily_send_cap <= 500),
  follow_up_count int NOT NULL DEFAULT 2 CHECK (follow_up_count >= 0 AND follow_up_count <= 5),
  min_deal_value_cents int NOT NULL DEFAULT 0 CHECK (min_deal_value_cents >= 0),
  max_deal_value_cents int,
  allow_package_offers boolean NOT NULL DEFAULT true,
  stop_on_reply boolean NOT NULL DEFAULT true,
  stop_on_bounce boolean NOT NULL DEFAULT true,
  stop_on_unsubscribe boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT ALL ON public.outreach_campaigns TO service_role;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator can read own campaigns"
  ON public.outreach_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "creator can insert own campaigns"
  ON public.outreach_campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "creator can update own campaigns"
  ON public.outreach_campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "creator can delete own campaigns"
  ON public.outreach_campaigns FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER outreach_campaigns_updated_at
  BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS outreach_campaigns_user_active_idx
  ON public.outreach_campaigns(user_id, active);

-- 2) Reply classification + bounce tracking on outreach_emails
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS reply_classification text
    CHECK (reply_classification IN ('genuine','autoresponder','bounce','unsubscribe','spam','unknown')),
  ADD COLUMN IF NOT EXISTS reply_classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

CREATE INDEX IF NOT EXISTS outreach_emails_reply_class_idx
  ON public.outreach_emails(user_id, reply_classification);