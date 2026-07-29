
ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS match_label text,
  ADD COLUMN IF NOT EXISTS why_creator_fits text,
  ADD COLUMN IF NOT EXISTS why_brand_cares text,
  ADD COLUMN IF NOT EXISTS suggested_deliverables jsonb,
  ADD COLUMN IF NOT EXISTS best_outreach_channel text,
  ADD COLUMN IF NOT EXISTS contact_path text,
  ADD COLUMN IF NOT EXISTS what_to_avoid text,
  ADD COLUMN IF NOT EXISTS top_reasons jsonb;
