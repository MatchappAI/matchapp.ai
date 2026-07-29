-- Add market scope intelligence
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS market_scope text NOT NULL DEFAULT 'both'
    CHECK (market_scope IN ('local','international','both'));

ALTER TABLE public.brand_matches
  ADD COLUMN IF NOT EXISTS market_type text
    CHECK (market_type IN ('local','international'));

CREATE INDEX IF NOT EXISTS brand_matches_user_market_idx
  ON public.brand_matches(user_id, market_type);
