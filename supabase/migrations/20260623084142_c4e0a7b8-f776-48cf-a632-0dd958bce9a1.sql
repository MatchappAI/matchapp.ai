
-- =====================================================================
-- 1. Move SECURITY DEFINER helpers (has_role, is_staff) to private schema
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'))
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

-- Recreate policies to reference private.* helpers
DROP POLICY IF EXISTS "staff read all pricing" ON public.pricing_signals;
CREATE POLICY "staff read all pricing" ON public.pricing_signals
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "users read own feedback" ON public.product_feedback;
CREATE POLICY "users read own feedback" ON public.product_feedback
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff read all usage" ON public.usage_events;
CREATE POLICY "staff read all usage" ON public.usage_events
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "owners manage non-elevated roles" ON public.user_roles;
CREATE POLICY "owners manage non-elevated roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.app_role) AND (role <> ALL (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.app_role) AND (role <> ALL (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.is_staff(auth.uid()));

-- Update trigger function that previously referenced public.has_role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text := current_setting('request.jwt.claims', true)::jsonb->>'role';
BEGIN
  IF caller_role IS NULL OR caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IN ('owner'::public.app_role, 'admin'::public.app_role) THEN
    IF NOT private.has_role(auth.uid(), 'owner'::public.app_role) THEN
      RAISE EXCEPTION 'Not allowed to assign elevated role %', NEW.role
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the public-schema copies now that nothing depends on them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);

-- =====================================================================
-- 2. Restrict escrow_transactions: only service_role can INSERT/DELETE
-- =====================================================================
DROP POLICY IF EXISTS et_insert_own ON public.escrow_transactions;
DROP POLICY IF EXISTS et_delete_own ON public.escrow_transactions;

-- =====================================================================
-- 3. Hide stripe_account_id on payment_accounts from clients (column-level)
-- =====================================================================
REVOKE SELECT ON public.payment_accounts FROM authenticated;
GRANT SELECT (
  id, user_id, stripe_connected, payout_method, escrow_default,
  invoice_name, invoice_details, tax_info_status, tax_form_type,
  created_at, updated_at, setup_skipped
) ON public.payment_accounts TO authenticated;

-- =====================================================================
-- 4. Hide stripe_customer_id / stripe_subscription_id on subscriptions
-- =====================================================================
REVOKE SELECT ON public.subscriptions FROM authenticated;
GRANT SELECT (
  id, user_id, plan, status, current_period_end, created_at, updated_at
) ON public.subscriptions TO authenticated;
