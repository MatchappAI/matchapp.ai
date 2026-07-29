CREATE TABLE public.brand_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_match_id uuid NOT NULL REFERENCES public.brand_matches(id) ON DELETE CASCADE,
  contact_name text,
  contact_title text,
  email text NOT NULL,
  domain text,
  source text NOT NULL CHECK (source IN ('pattern','department','ai_guess','manual')),
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')) DEFAULT 'low',
  alternate_emails jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_contacts TO authenticated;
GRANT ALL ON public.brand_contacts TO service_role;

ALTER TABLE public.brand_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own brand contacts" ON public.brand_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_brand_contacts_brand_match ON public.brand_contacts(brand_match_id);
CREATE INDEX idx_brand_contacts_user ON public.brand_contacts(user_id);

CREATE TRIGGER update_brand_contacts_updated_at
  BEFORE UPDATE ON public.brand_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();