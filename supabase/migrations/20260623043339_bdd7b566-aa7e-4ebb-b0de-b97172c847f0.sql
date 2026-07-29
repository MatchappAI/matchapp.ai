
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner','admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'))
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "owners manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- Usage events
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_name text NOT NULL,
  route text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_user_idx ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_name_idx ON public.usage_events(event_name, created_at DESC);
GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT INSERT ON public.usage_events TO anon;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can log usage" ON public.usage_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "staff read all usage" ON public.usage_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR auth.uid() = user_id);

-- Product feedback (ICP, painpoints, features, desires, pricing)
DO $$ BEGIN
  CREATE TYPE public.feedback_type AS ENUM ('icp','painpoint','feature_request','desire','feedback','pricing','sentiment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.feedback_type NOT NULL,
  content text NOT NULL,
  sentiment int,
  source text,
  route text,
  tags text[] DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_feedback_type_idx ON public.product_feedback(type, created_at DESC);
GRANT SELECT, INSERT ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;
ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own feedback" ON public.product_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users read own feedback" ON public.product_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Pricing signals
CREATE TABLE IF NOT EXISTS public.pricing_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model_preference text,
  willingness_to_pay_cents int,
  billing_cadence text,
  rationale text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pricing_signals TO authenticated;
GRANT ALL ON public.pricing_signals TO service_role;
ALTER TABLE public.pricing_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own pricing signal" ON public.pricing_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "staff read all pricing" ON public.pricing_signals FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR auth.uid() = user_id);
