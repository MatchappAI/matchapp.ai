
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS voice_formality text,
  ADD COLUMN IF NOT EXISTS voice_length text,
  ADD COLUMN IF NOT EXISTS voice_warmth text,
  ADD COLUMN IF NOT EXISTS explanation_level text,
  ADD COLUMN IF NOT EXISTS autonomy_level text,
  ADD COLUMN IF NOT EXISTS pricing_aggressiveness text,
  ADD COLUMN IF NOT EXISTS growth_stage text,
  ADD COLUMN IF NOT EXISTS confidence_level text,
  ADD COLUMN IF NOT EXISTS cta_style text,
  ADD COLUMN IF NOT EXISTS agent_memory jsonb NOT NULL DEFAULT '[]'::jsonb;
