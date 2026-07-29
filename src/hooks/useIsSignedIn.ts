import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight client-side session flag for landing page session-aware CTAs.
 * Avoids needing the full auth context just to toggle a button label.
 */
export function useIsSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled) setSignedIn(!!data.session);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setSignedIn(!!session);
      });
      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    } catch (error) {
      console.warn("[Supabase] Landing auth state unavailable; rendering signed-out CTA.");
      if (!cancelled) setSignedIn(false);
      return () => {
        cancelled = true;
      };
    }
  }, []);

  return signedIn;
}
