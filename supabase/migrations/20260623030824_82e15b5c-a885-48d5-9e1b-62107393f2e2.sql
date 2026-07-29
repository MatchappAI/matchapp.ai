
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS personalization_used text,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS category_style text,
  ADD COLUMN IF NOT EXISTS quality_check jsonb;

ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS my_take text,
  ADD COLUMN IF NOT EXISTS partnership_angle text,
  ADD COLUMN IF NOT EXISTS potential_risk text,
  ADD COLUMN IF NOT EXISTS recommended_next_move text;
