import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { finalizeCheckout } from "@/lib/payments.functions";
import { FullScreenLoader } from "@/components/dashboard/PageLoader";

type Search = { session_id?: string };

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = useSearch({ from: "/checkout/return" });
  const navigate = useNavigate();
  const finalize = useServerFn(finalizeCheckout);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("Confirming your payment…");

  useEffect(() => {
    if (!session_id) {
      setError("Missing session id.");
      return;
    }
    let cancelled = false;

    // Auth race: right after sign-up + checkout the Supabase session cookie
    // may not be committed yet, which would 401 finalizeCheckout. Retry a few
    // times with back-off before falling back.
    const attempt = async (tryNum: number): Promise<void> => {
      try {
        const res = await finalize({ data: { sessionId: session_id } });
        if (cancelled) return;
        if (res.status === "active") {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setError("Payment was not completed.");
      } catch (e) {
        if (cancelled) return;
        if (tryNum < 4) {
          setLabel("Verifying with our payment provider…");
          const delay = 600 * Math.pow(2, tryNum); // 600, 1200, 2400, 4800 ms
          await new Promise((r) => setTimeout(r, delay));
          if (!cancelled) await attempt(tryNum + 1);
          return;
        }
        setError(e instanceof Error ? e.message : "Could not verify checkout.");
      }
    };
    attempt(0);
    return () => {
      cancelled = true;
    };
  }, [session_id, finalize, navigate]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold">Checkout issue</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            If you completed payment, your plan will activate within a minute. You can also reload your dashboard.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="rounded-lg border border-border bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Go to dashboard
            </button>
            <button
              onClick={() => navigate({ to: "/", hash: "pricing" })}
              className="rounded-lg border border-border bg-card-inner/60 px-4 py-2 text-sm"
            >
              Back to pricing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <FullScreenLoader label={label} />;
}
