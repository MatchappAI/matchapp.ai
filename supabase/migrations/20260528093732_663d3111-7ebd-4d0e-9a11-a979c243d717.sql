
-- 1. Brand matches: secondary scoring column
ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS fit_quality_score integer;

-- 2. Outreach emails: send + reply detection columns
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS gmail_message_id text,
  ADD COLUMN IF NOT EXISTS gmail_thread_id text,
  ADD COLUMN IF NOT EXISTS brand_reply_text text,
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;

-- 3. Follow-up sequences: content + approval + cancellation
ALTER TABLE public.follow_up_sequences
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;

-- 4. Deliverables: revision notes
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS revision_notes text;

-- 5. Escrow transactions
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid,
  brand_name text,
  gross_amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  net_payout numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'awaiting',
  funded_at timestamptz,
  released_at timestamptz,
  payout_method text,
  expected_payout_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escrow_transactions TO authenticated;
GRANT ALL ON public.escrow_transactions TO service_role;

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "et_select_own" ON public.escrow_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "et_insert_own" ON public.escrow_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "et_update_own" ON public.escrow_transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "et_delete_own" ON public.escrow_transactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_escrow_transactions_updated_at
  BEFORE UPDATE ON public.escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Auto-activity triggers
CREATE OR REPLACE FUNCTION public.trg_brand_match_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.agent_activity
    (user_id, activity_type, title, description, related_id, action_label, action_route)
  VALUES (
    NEW.user_id, 'brand_found',
    'AI found a new brand match',
    NEW.brand_name || ' — ' || COALESCE(NEW.fit_score, 0)::text || '% fit',
    NEW.id, 'Review', '/dashboard/brands'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_match_activity ON public.brand_matches;
CREATE TRIGGER trg_brand_match_activity
  AFTER INSERT ON public.brand_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_brand_match_activity();

CREATE OR REPLACE FUNCTION public.trg_outreach_sent_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sent = true AND COALESCE(OLD.sent, false) = false THEN
    INSERT INTO public.agent_activity
      (user_id, activity_type, title, description, related_id, action_label, action_route)
    VALUES (
      NEW.user_id, 'outreach_sent',
      'Outreach sent',
      'Email "' || NEW.subject || '" sent.',
      NEW.id, 'View', '/dashboard/approvals'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_sent_activity ON public.outreach_emails;
CREATE TRIGGER trg_outreach_sent_activity
  AFTER UPDATE ON public.outreach_emails
  FOR EACH ROW EXECUTE FUNCTION public.trg_outreach_sent_activity();

CREATE OR REPLACE FUNCTION public.trg_outreach_replied_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.replied = true AND COALESCE(OLD.replied, false) = false THEN
    INSERT INTO public.agent_activity
      (user_id, activity_type, title, description, related_id, action_label, action_route)
    VALUES (
      NEW.user_id, 'brand_replied',
      'Brand replied — review needed',
      'A brand replied to your outreach.',
      NEW.id, 'Review', '/dashboard/approvals'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_replied_activity ON public.outreach_emails;
CREATE TRIGGER trg_outreach_replied_activity
  AFTER UPDATE ON public.outreach_emails
  FOR EACH ROW EXECUTE FUNCTION public.trg_outreach_replied_activity();

CREATE OR REPLACE FUNCTION public.trg_deal_escrow_funded_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.escrow_status = 'funded' AND COALESCE(OLD.escrow_status, '') <> 'funded' THEN
    INSERT INTO public.agent_activity
      (user_id, activity_type, title, description, related_id, action_label, action_route)
    VALUES (
      NEW.user_id, 'escrow_funded',
      'Escrow funded',
      COALESCE(NEW.brand_name, 'Brand') || ' funded escrow.',
      NEW.id, 'Open deal', '/dashboard/deals'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_escrow_funded_activity ON public.deals;
CREATE TRIGGER trg_deal_escrow_funded_activity
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deal_escrow_funded_activity();

CREATE OR REPLACE FUNCTION public.trg_deal_paid_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_status = 'paid' AND COALESCE(OLD.invoice_status, '') <> 'paid' THEN
    INSERT INTO public.agent_activity
      (user_id, activity_type, title, description, related_id, action_label, action_route)
    VALUES (
      NEW.user_id, 'payment_released',
      'Payment released',
      COALESCE(NEW.brand_name, 'Brand') || ' — payment marked paid.',
      NEW.id, 'View', '/dashboard/payments'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_paid_activity ON public.deals;
CREATE TRIGGER trg_deal_paid_activity
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deal_paid_activity();
