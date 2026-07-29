CREATE UNIQUE INDEX IF NOT EXISTS outreach_emails_one_active_per_brand
  ON public.outreach_emails (user_id, brand_match_id)
  WHERE cancelled = false AND brand_match_id IS NOT NULL;