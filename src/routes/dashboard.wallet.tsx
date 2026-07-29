import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, Clock, CheckCircle2, Info, Loader2, Sparkles, AlertTriangle, RotateCw } from "lucide-react";
import { getWallet, requestPayout, setPayoutMode, listPayoutAttempts } from "@/lib/wallet.functions";
import { getConnectStatus, createConnectOnboardingLink } from "@/lib/payments.functions";
import { getBreakEvenNudge } from "@/lib/break-even.functions";
import { createCheckoutSession } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet · MatchAI" },
      { name: "description", content: "Your MatchAI balance, transfer history, and payout preferences." },
    ],
  }),
  component: WalletPage,
});

function fmt(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

function WalletPage() {
  const qc = useQueryClient();
  const getWalletFn = useServerFn(getWallet);
  const setModeFn = useServerFn(setPayoutMode);
  const requestPayoutFn = useServerFn(requestPayout);
  const connectFn = useServerFn(getConnectStatus);
  const onboardFn = useServerFn(createConnectOnboardingLink);

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => getWalletFn({}) });
  const connect = useQuery({ queryKey: ["connect"], queryFn: () => connectFn({}) });
  const attemptsFn = useServerFn(listPayoutAttempts);
  const attempts = useQuery({ queryKey: ["payout-attempts"], queryFn: () => attemptsFn({}) });
  const nudgeFn = useServerFn(getBreakEvenNudge);
  const nudge = useQuery({ queryKey: ["break-even"], queryFn: () => nudgeFn({}) });
  const checkoutFn = useServerFn(createCheckoutSession);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  async function onUpgrade(plan: "starter" | "growth" | "pro") {
    setUpgradeBusy(true);
    try {
      const { url } = await checkoutFn({ data: { plan, origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setUpgradeBusy(false);
    }
  }

  const modeMut = useMutation({
    mutationFn: (mode: "auto" | "manual") => setModeFn({ data: { mode } }),
    onSuccess: (r) => {
      toast.success(r.mode === "auto" ? "Auto-transfer on" : "Manual transfer on");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const payoutMut = useMutation({
    mutationFn: () => requestPayoutFn({ data: {} }),
    onSuccess: (r) => {
      toast.success(`Transfer sent — ${fmt(r.amount_cents)} on its way to your bank.`);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["payout-attempts"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
      qc.invalidateQueries({ queryKey: ["payout-attempts"] });
    },
  });

  const [busyConnect, setBusyConnect] = useState(false);
  async function onConnect() {
    setBusyConnect(true);
    try {
      const r = await onboardFn({ data: { origin: window.location.origin } });
      if (r?.url) window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payout setup");
    } finally {
      setBusyConnect(false);
    }
  }

  const w = wallet.data;
  const c = connect.data;
  const connectReady = Boolean(c?.onboarded && c?.payoutsEnabled);
  const balance = w?.balance_cents ?? 0;
  const pending = w?.pending_cents ?? 0;
  const lifetime = w?.lifetime_earned_cents ?? 0;
  const paid = w?.lifetime_paid_out_cents ?? 0;
  const entries = w?.entries ?? [];
  const mode = w?.payout_mode ?? "manual";

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      {/* Break-even nudge — honest upgrade math */}
      {nudge.data?.shouldNudge && nudge.data.recommendedPlan && (
        <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Heads up — a paid plan would save you money this month.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">{nudge.data.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onUpgrade(nudge.data!.recommendedPlan!)}
                  disabled={upgradeBusy}
                  className="h-8 rounded-lg bg-foreground text-background hover:opacity-90"
                >
                  {upgradeBusy ? "Opening checkout…" : `Switch to ${nudge.data.recommendedPlan[0].toUpperCase()}${nudge.data.recommendedPlan.slice(1)}`}
                </Button>
                <span className="text-[11px] text-muted-foreground self-center">Fair Deal Guarantee: fee capped at $99 · repeat brands free</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance hero */}
      <div data-agent-id="wallet:balance" className="rounded-2xl border border-foreground/[0.08] bg-gradient-to-br from-primary/[0.06] to-transparent p-5">

        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Available balance
        </div>
        <div className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
          {wallet.isLoading ? "—" : fmt(balance)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {fmt(pending)} pending release
          </span>
          <span>·</span>
          <span>Lifetime earned {fmt(lifetime)}</span>
          <span>·</span>
          <span>Paid out {fmt(paid)}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => payoutMut.mutate()}
            disabled={payoutMut.isPending || balance <= 0 || !connectReady}
            className="rounded-lg"
          >
            {payoutMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Transfer {balance > 0 ? fmt(balance) : ""} to bank
          </Button>
          {!connectReady && (
            <Button variant="outline" onClick={onConnect} disabled={busyConnect} className="rounded-lg">
              {busyConnect && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect bank to withdraw
            </Button>
          )}
        </div>
      </div>

      {/* Payout mode */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Auto-transfer to bank</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "auto"
                ? "Released deal payments will hit your bank within 1–2 business days automatically."
                : "Released payments stay in your MatchAI balance until you tap “Transfer to bank”."}
            </p>
          </div>
          <Switch
            checked={mode === "auto"}
            disabled={modeMut.isPending || !connectReady}
            onCheckedChange={(v) => modeMut.mutate(v ? "auto" : "manual")}
          />
        </div>
        {!connectReady && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Connect a bank account to enable auto-transfer.
          </p>
        )}
      </div>

      {/* Payout attempts — surface any failed bank transfers with one-tap retry */}
      {(attempts.data?.attempts?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-foreground/[0.08] overflow-hidden">
          <div className="border-b border-foreground/[0.06] px-4 py-3 text-sm font-semibold text-foreground">
            Bank transfers
          </div>
          <ul className="divide-y divide-foreground/[0.05]">
            {(attempts.data?.attempts ?? []).slice(0, 5).map((a) => {
              const failed = a.status === "failed";
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      {failed ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span className="break-words">{fmt(a.amount_cents)} — {failed ? "Failed" : "Sent to bank"}</span>
                    </div>
                    {failed && a.error && (
                      <div className="mt-0.5 break-words text-[11px] text-muted-foreground">{a.error}</div>
                    )}
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  {failed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      disabled={payoutMut.isPending || balance <= 0 || !connectReady}
                      onClick={() => payoutMut.mutate()}
                    >
                      <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Fee math */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-primary" />
          How your payout is calculated
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>1. Brand funds the deal amount into protected payment.</div>
          <div>2. You complete the deliverables and MatchAI verifies them.</div>
          <div>3. On release, we deduct the success fee (20% on Free, capped at $99/deal, 0% on paid plans, and 0% on repeat deals with the same brand) plus Stripe's ~2.9% + $0.30 processing.</div>
          <div>4. The remainder credits your MatchAI balance instantly.</div>
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-2xl border border-foreground/[0.08] overflow-hidden">
        <div className="border-b border-foreground/[0.06] px-4 py-3 text-sm font-semibold text-foreground">
          Activity
        </div>
        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No activity yet. When your first deal releases, it'll show up here.
          </div>
        ) : (
          <ul className="divide-y divide-foreground/[0.05]">
            {entries.map((e) => (
              <li key={e.id} data-agent-id={`wallet:entry-${e.id}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex min-w-0 items-start gap-2 text-sm text-foreground">
                    {e.direction === "credit" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 break-words">{e.description ?? e.kind}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                <div className={cn(
                  "shrink-0 font-mono text-sm tabular-nums",
                  e.direction === "credit" ? "text-emerald-700" : "text-foreground",
                )}>
                  {e.direction === "credit" ? "+" : "−"}{fmt(Number(e.amount_cents))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
