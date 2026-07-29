-- Cancel older duplicates, keep newest per (user_id, brand_match_id)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, brand_match_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.outreach_emails
  WHERE cancelled = false AND brand_match_id IS NOT NULL
)
UPDATE public.outreach_emails oe
SET cancelled = true
FROM ranked
WHERE oe.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS outreach_emails_one_active_per_brand
  ON public.outreach_emails (user_id, brand_match_id)
  WHERE cancelled = false AND brand_match_id IS NOT NULL;