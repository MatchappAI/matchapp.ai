import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () => ({
    meta: [
      { title: "External payments · MatchAI" },
      {
        name: "description",
        content: "Creator-reported payment tracking for brand deals handled outside MatchAI.",
      },
    ],
  }),
  component: ExternalPaymentsPage,
});

function ExternalPaymentsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div className="rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-primary" />
          Brand payments happen outside MatchAI
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">No MatchAI wallet</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          MatchAI does not hold funds, provide escrow, process creator payouts, or deduct fees from
          creator-brand deals. Use your preferred external payment method with the brand.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You can record an external payment status on the related deal for your own tracking. Those
          statuses are creator-reported and are not verified or processed by MatchAI.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/dashboard/deals">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open deals
          </Link>
        </Button>
      </div>
    </main>
  );
}
