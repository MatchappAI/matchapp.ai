
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS audience_age_band text,
  ADD COLUMN IF NOT EXISTS content_themes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS top_brands_mentioned text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS enrichment_source jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
