import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Shield, Lock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { getPublicEscrowSummary, startPublicEscrowCheckout } from "@/lib/public-pay.functions";
import { Button } from "@/components/ui/button";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

const searchSchema = z.object({
  status: z.enum(["funded", "cancelled"]).optional(),
});

export const Route = createFileRoute("/pay/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Secure payment — MatchAI" },
      {
        name: "description",
        content:
          "Fund a MatchAI protected payment. Held securely until the creator delivers, released on approval, refunded on dispute.",
      },
      { property: "og:title", content: "Secure payment — MatchAI" },
      {
        property: "og:description",
        content: "Protected creator payment powered by MatchAI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayPage,
});

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function PayPage() {
  const { id } = Route.useParams();
  const { status } = useSearch({ from: "/pay/$id" });
  const fetchSummary = useServerFn(getPublicEscrowSummary);
  const startCheckout = useServerFn(startPublicEscrowCheckout);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);

  const summary = useQuery({
    queryKey: ["public-escrow", id],
    queryFn: () => fetchSummary({ data: { escrow_id: id } }),
  });

  const canPay =
    !busy &&
    agreed &&
    /.+@.+\..+/.test(email) &&
    summary.data?.status !== "funded";

  const onPay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await startCheckout({
        data: {
          escrow_id: id,
          origin: window.location.origin,
          terms_accepted: true,
          brand_email: email,
        },
      });
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/[0.06]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <MatchAILogo className="h-8" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Secure checkout
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {status === "funded" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-foreground">Payment received</p>
              <p className="text-sm text-muted-foreground">
                Funds are protected in escrow. The creator has been notified.
              </p>
            </div>
          </div>
        )}
        {status === "cancelled" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <p className="text-sm text-foreground">
              Checkout cancelled. You can try again below.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.02] p-8 sm:p-10">
          {summary.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payment…
            </div>
          ) : !summary.data ? (
            <div>
              <h1 className="text-xl font-semibold">Payment link not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This link may have expired. Contact the creator for a new one.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Shield className="h-3.5 w-3.5" />
                Protected payment
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                Fund your deal with {summary.data.creatorName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.data.brandName ? `${summary.data.brandName} → ` : ""}
                MatchAI holds these funds until the creator delivers. Released
                on approval, refunded on dispute.
              </p>

              <div className="mt-8 rounded-2xl border border-foreground/[0.06] bg-background p-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-3xl font-semibold tabular-nums">
                    {formatMoney(summary.data.amountCents, summary.data.currency)}
                  </span>
                </div>
              </div>

              <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Funds held in Stripe-managed escrow — never touched by MatchAI.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Released only when you approve the deliverables (or auto-released 3 days after delivery if you don't respond).
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Full refund if the creator doesn't deliver as agreed.
                </li>
              </ul>

              {summary.data.status !== "funded" && (
                <div className="mt-8 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Your work email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@brand.com"
                      className="w-full rounded-xl border border-foreground/10 bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      We'll send the receipt and release notifications here.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-foreground/10 bg-background p-4 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="leading-relaxed text-muted-foreground">
                      I agree to MatchAI's{" "}
                      <a href="/trust" className="text-primary underline underline-offset-2">
                        Protected Payment Terms
                      </a>
                      : funds are held in escrow, released to the creator upon my approval or automatically 3 days after delivery, and refunded in full if the creator fails to deliver as agreed. The brand is never charged a MatchAI platform fee — any success fee comes out of the creator's side only, and is capped at $99 per deal (0% on repeat deals or paid plans).
                    </span>
                  </label>
                </div>
              )}

              {err && (
                <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                  {err}
                </p>
              )}

              <Button
                onClick={onPay}
                disabled={!canPay}
                size="lg"
                className="mt-6 w-full rounded-xl"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {summary.data.status === "funded"
                  ? "Already funded"
                  : `Pay ${formatMoney(summary.data.amountCents, summary.data.currency)} securely`}
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Payment secured &amp; processed by Stripe. Stripe payment-processing fees (~2.9% + $0.30) apply and go to Stripe — not MatchAI. MatchAI success fees, when applicable, are shown separately on the creator&apos;s deal.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
