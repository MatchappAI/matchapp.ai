
-- 1) Pin search_path on pgmq wrapper functions (and re-assert on others to be safe)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from client-facing roles.
--    Keep has_role / is_staff callable by authenticated (used inside RLS policies).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_brand_match_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deal_escrow_funded_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deal_paid_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_outreach_replied_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_outreach_sent_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Make sure service_role retains access to all of the above (it normally does, this is explicit).
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- has_role / is_staff are referenced inside RLS policies on user-facing tables,
-- so authenticated must keep EXECUTE on them. Revoke from anon (no need).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 3) Block privilege escalation on user_roles with a BEFORE trigger.
--    Allows: service_role (server-side admin code), or a real owner granting roles.
--    Blocks: any authenticated user inserting/updating themselves (or anyone) into 'owner'/'admin'
--    when they don't already hold the owner role.
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text := current_setting('request.jwt.claims', true)::jsonb->>'role';
BEGIN
  -- Service role / admin paths bypass this guard.
  IF caller_role IS NULL OR caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Only owners can mint owner/admin roles. Non-owners get rejected even if
  -- they somehow satisfy the permissive RLS policy.
  IF NEW.role IN ('owner'::app_role, 'admin'::app_role) THEN
    IF NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
      RAISE EXCEPTION 'Not allowed to assign elevated role %', NEW.role
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_role_self_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_role_self_escalation_ins ON public.user_roles;
DROP TRIGGER IF EXISTS prevent_role_self_escalation_upd ON public.user_roles;

CREATE TRIGGER prevent_role_self_escalation_ins
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

CREATE TRIGGER prevent_role_self_escalation_upd
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();
