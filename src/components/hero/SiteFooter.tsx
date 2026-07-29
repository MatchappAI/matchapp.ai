import { Link } from "@tanstack/react-router";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

type FooterLink = { label: string; to?: string; hash?: string };

export function SiteFooter() {
  const cols: { title: string; links: FooterLink[] }[] = [
    {
      title: "Product",
      links: [
        { label: "How it works", hash: "how" },
        { label: "Under the hood", hash: "signals" },
        { label: "Features", hash: "features" },
        { label: "Pricing", hash: "pricing" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "FAQ", hash: "faq" },
        { label: "Pricing guide", hash: "pricing" },
        { label: "Trust & controls", to: "/trust" },
        { label: "For Brands", to: "/for-brands" },
      ],
    },
    {
      title: "Get started",
      links: [
        { label: "Create an account", to: "/auth" },
        { label: "Sign in", to: "/auth" },
        { label: "Open dashboard", to: "/dashboard" },
      ],
    },
  ];

  const linkCls =
    "text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md";

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center">
              <MatchAILogo size="lg" />
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The AI brand-deal workspace for creators. Find opportunities, draft pitches, track
              applications, and negotiate with your approval.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {c.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className={linkCls}>
                        {l.label}
                      </Link>
                    ) : l.hash ? (
                      <Link to="/" hash={l.hash} className={linkCls}>
                        {l.label}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MatchAI. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for creators who treat brand deals like a business. Brand inquiries:{" "}
            <a
              href="mailto:hello@matchapp.ai"
              className="underline decoration-border/60 underline-offset-4 transition-colors hover:text-foreground"
            >
              hello@matchapp.ai
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
