-- Dedupe existing rows first: keep the most-advanced funnel per (user, normalized brand name)
WITH ranked AS (
  SELECT id, user_id, lower(btrim(brand_name)) AS n,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(btrim(brand_name))
      ORDER BY CASE status
        WHEN 'negotiating' THEN 0
        WHEN 'replied' THEN 1
        WHEN 'pitched' THEN 2
        WHEN 'queued' THEN 3
        WHEN 'new' THEN 4
        ELSE 5 END,
        updated_at DESC
    ) AS rn
  FROM public.brand_matches
)
DELETE FROM public.brand_matches bm USING ranked r
WHERE bm.id = r.id AND r.rn > 1;

-- Enforce: one funnel per (user, brand) — case/whitespace insensitive
CREATE UNIQUE INDEX IF NOT EXISTS brand_matches_user_brand_unique
  ON public.brand_matches (user_id, lower(btrim(brand_name)));