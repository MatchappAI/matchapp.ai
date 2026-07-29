/**
 * Qualified Opportunity screen — shown after a qualifying paid reply
 * arrives. Presents Stay Free vs paid subscription paths and locks the
 * creator's monetization choice.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { lockMonetizationChoice } from "@/lib/qualification.functions";
import { createCheckoutSession } from "@/lib/payments.functions";
import { computeFeeBreakdown, MONETIZATION_COPY, FAIR_DEAL_GUARANTEE, SUCCESS_FEE_CAP_USD } from "@/lib/pricing-config";

type Props = {
  brandName?: string | null;
  replyBody?: string | null;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
  confidence?: number | null;
  reason?: string | null;
  onDecided?: () => void;
};

export function QualifiedOpportunityScreen({
  brandName, replyBody, estimatedMin, estimatedMax, confidence, reason, onDecided,
}: Props) {
  const lock = useServerFn(lockMonetizationChoice);
  const checkout = useServerFn(createCheckoutSession);
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const midGross = estimatedMin && estimatedMax ? (estimatedMin + estimatedMax) / 2 : 500;

  const stayFree = computeFeeBreakdown({
    gross: midGross, choice: "stay_free_success_fee", dealSource: "matchai_sourced",
  });
  const paid = computeFeeBreakdown({
    gross: midGross, choice: "starter_subscription", dealSource: "matchai_sourced",
  });

  const chooseFree = async () => {
    setLoading("free");
    try {
      await lock({ data: { choice: "stay_free_success_fee" } });
      onDecided?.();
    } finally { setLoading(null); }
  };

  const choosePaid = async (plan: "starter" | "growth" | "pro") => {
    setLoading(plan);
    try {
      const { url } = await checkout({ data: { plan, origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      console.error(e); setLoading(null);
      toast.error("Could not start checkout. Please try again.");
    }
  };

  const paidOptions: Array<{
    plan: "starter" | "growth" | "pro";
    label: string;
    price: string;
    fee: string;
    blurb: string;
    featured?: boolean;
  }> = [
    { plan: "starter", label: "Starter", price: "$49/mo", fee: "10% success fee", blurb: "For creators beginning to close paid deals." },
    { plan: "growth", label: "Growth", price: "$99/mo", fee: "5% success fee", blurb: "More opportunities and stronger support.", featured: true },
    { plan: "pro", label: "Pro", price: "$199/mo", fee: "0% MatchAI success fee", blurb: "Maximum outreach, no MatchAI success fee." },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Qualified opportunity</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">You landed a paid opportunity.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose how you want to pay for this MatchAI-sourced deal.
          {brandName && <> {" "}<span className="font-medium text-foreground">{brandName}</span> is interested in a paid collaboration.</>}
          {typeof confidence === "number" && (
            <> Confidence: <span className="font-medium text-foreground">{Math.round(confidence * 100)}%</span>.</>
          )}
        </p>
      </div>

      {replyBody && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reply</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{replyBody}</p>
          {reason && <p className="mt-3 text-xs text-muted-foreground">Why it qualified: {reason}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated deal potential</p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {estimatedMin && estimatedMax
            ? `$${estimatedMin.toLocaleString()}–$${estimatedMax.toLocaleString()}`
            : "Deal value not yet clear"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimate only — not a guarantee. Refined during negotiation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Stay Free */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stay on Free</p>
          <p className="mt-1 text-3xl font-bold text-foreground">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          <p className="mt-2 text-sm text-foreground/80">
            Pay a 20% success fee on this deal — only if it completes and pays.
            {stayFree.feeCapped && <> Capped at ${SUCCESS_FEE_CAP_USD}.</>}
          </p>
          <dl className="mt-4 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Gross</dt><dd className="font-medium">${stayFree.gross.toFixed(2)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MatchAI fee{stayFree.feeCapped ? " (capped)" : " (20%)"}</dt>
              <dd className="font-medium">−${stayFree.successFeeAmount.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Payment processing</dt><dd className="font-medium">−${stayFree.paymentProcessingFee.toFixed(2)}</dd></div>
            <div className="flex justify-between border-t border-border pt-1.5"><dt className="font-semibold">Your net</dt><dd className="font-semibold text-foreground">${stayFree.creatorNet.toFixed(2)}</dd></div>
          </dl>
          <button
            onClick={chooseFree}
            disabled={loading === "free"}
            className="mt-5 w-full rounded-xl border border-border bg-card-inner px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loading === "free" ? "Saving…" : "Pay 20% on this deal"}
          </button>
        </div>

        {/* Paid — 3 options */}
        <div className="rounded-2xl border border-purple-300/60 bg-purple-50/40 p-5 ring-1 ring-purple-300/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-800">Upgrade — lower or zero success fee</p>
          <p className="mt-1 text-sm text-foreground/80">Monthly subscription. Fee rate locks on this deal at upgrade.</p>
          <div className="mt-4 space-y-2">
            {paidOptions.map((opt) => (
              <button
                key={opt.plan}
                onClick={() => choosePaid(opt.plan)}
                disabled={!!loading}
                className={`w-full rounded-xl px-4 py-3 text-left transition disabled:opacity-60 ${
                  opt.featured
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {opt.label} <span className="opacity-70">— {opt.price}</span>
                  </span>
                  <span className="text-xs font-medium opacity-90">{opt.fee}</span>
                </div>
                <p className={`mt-0.5 text-[12px] ${opt.featured ? "opacity-90" : "text-muted-foreground"}`}>
                  {loading === opt.plan ? "Opening checkout…" : opt.blurb}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">{FAIR_DEAL_GUARANTEE.title}</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 text-[12.5px] text-foreground/85">
          {FAIR_DEAL_GUARANTEE.items.map((it) => (
            <li key={it.label}>· <span className="font-medium text-foreground">{it.label}.</span> {it.body}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Your choice locks the fee rate for this deal at acceptance — upgrading later won't change
        the economics of already-accepted deals, and downgrading later won't either. Success fees apply
        only to completed and paid MatchAI-sourced deals. Replies, conversations, proposals, and unsigned
        opportunities are always free. Standard Stripe payment-processing fees apply separately.
      </p>
    </div>
  );
}
