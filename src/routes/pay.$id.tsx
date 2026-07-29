import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Info } from "lucide-react";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pay/$id")({
  head: () => ({
    meta: [
      { title: "External brand payment — MatchAI" },
      {
        name: "description",
        content: "MatchAI does not process brand-to-creator payments.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ExternalPaymentNotice,
});

function ExternalPaymentNotice() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/[0.06]">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <MatchAILogo className="h-8" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-3xl border border-foreground/[0.08] bg-foreground/[0.02] p-8 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Info className="h-3.5 w-3.5" />
            Payment handled externally
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            MatchAI does not collect brand payments
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Contact the creator directly for their preferred invoice or payment method. MatchAI does
            not provide escrow, hold funds, release payments, or charge either party a success fee.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-xl">
            <Link to="/">
              <ExternalLink className="mr-2 h-4 w-4" />
              Return to MatchAI
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
