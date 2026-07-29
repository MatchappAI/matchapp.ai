import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Navbar } from "@/components/hero/Navbar";
import { SiteFooter } from "@/components/hero/SiteFooter";
import { SectionEyebrow } from "@/components/hero/SectionEyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/for-brands")({
  head: () => ({
    meta: [
      { title: "For Brands · MatchAI" },
      {
        name: "description",
        content:
          "A lightweight brand inquiry path for companies that want to work with creators. Submit a brand inquiry or email hello@matchapp.ai.",
      },
      { property: "og:title", content: "For Brands · MatchAI" },
      {
        property: "og:description",
        content:
          "Looking to work with creators? Submit a brand inquiry or email hello@matchapp.ai.",
      },
    ],
  }),
  component: ForBrandsPage,
});

const useCases = [
  "Paid social",
  "UGC campaigns",
  "Sponsored content",
  "Usage rights / whitelisting",
  "Creator partnerships",
];

type InquiryForm = {
  brandName: string;
  website: string;
  needs: string;
  budgetRange: string;
  timeline: string;
  contactEmail: string;
};

const initialForm: InquiryForm = {
  brandName: "",
  website: "",
  needs: "",
  budgetRange: "",
  timeline: "",
  contactEmail: "",
};

function buildMailto(form: InquiryForm) {
  const subject = `MatchAI brand inquiry${form.brandName.trim() ? ` — ${form.brandName.trim()}` : ""}`;
  const body = [
    "Brand inquiry from the MatchAI website",
    "",
    `Brand name: ${form.brandName.trim() || "—"}`,
    `Website: ${form.website.trim() || "—"}`,
    `What they need: ${form.needs.trim() || "—"}`,
    `Budget range: ${form.budgetRange.trim() || "—"}`,
    `Timeline: ${form.timeline.trim() || "—"}`,
    `Contact email: ${form.contactEmail.trim() || "—"}`,
  ].join("\n");

  return `mailto:hello@matchapp.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function ForBrandsPage() {
  const [form, setForm] = useState<InquiryForm>(initialForm);

  const submitHref = useMemo(() => buildMailto(form), [form]);

  return (
    <div className="grain relative bg-background">
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <Navbar />

        <header className="pt-10 pb-10 sm:pt-16 sm:pb-14">
          <SectionEyebrow>FOR BRANDS</SectionEyebrow>
          <h1 className="mt-6 text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Looking to work with creators?
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-[1.7] text-muted-foreground">
            Submit a brand inquiry and the MatchAI team will route it from there. If email is
            easier, write us directly at{" "}
            <a
              href="mailto:hello@matchapp.ai"
              className="font-medium text-foreground underline decoration-border/70 underline-offset-4 transition-colors hover:text-foreground/80"
            >
              hello@matchapp.ai
            </a>
            .
          </p>
        </header>

        <main className="grid gap-6 pb-16 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur sm:p-7">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              What brands use MatchAI for
            </h2>
            <p className="mt-3 text-[14.5px] leading-[1.7] text-muted-foreground">
              This is a lightweight inquiry path for companies that want creator partnerships.
              MatchAI stays creator-first and does not turn this into a generic marketplace.
            </p>

            <ul className="mt-5 space-y-2.5">
              {useCases.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14.5px] text-foreground/90">
                  <span
                    aria-hidden
                    className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-primary/80"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">A few notes</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>• No login required.</li>
                <li>• No wallet, escrow, or payout claims.</li>
                <li>• Creator payment handling stays outside MatchAI.</li>
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur sm:p-7">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              Submit brand inquiry
            </h2>
            <p className="mt-3 text-[14.5px] leading-[1.7] text-muted-foreground">
              Share a few details and we’ll open your email app with a ready-to-send inquiry.
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                window.location.assign(submitHref);
              }}
            >
              <Field label="Brand name">
                <Input
                  value={form.brandName}
                  onChange={(event) =>
                    setForm((curr) => ({ ...curr, brandName: event.target.value }))
                  }
                  placeholder="Acme Beauty"
                />
              </Field>

              <Field label="Website">
                <Input
                  value={form.website}
                  onChange={(event) =>
                    setForm((curr) => ({ ...curr, website: event.target.value }))
                  }
                  placeholder="https://brand.com"
                />
              </Field>

              <Field label="What they need">
                <Textarea
                  value={form.needs}
                  onChange={(event) => setForm((curr) => ({ ...curr, needs: event.target.value }))}
                  placeholder="Paid social, UGC, usage rights, whitelisting..."
                  rows={4}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget range">
                  <Input
                    value={form.budgetRange}
                    onChange={(event) =>
                      setForm((curr) => ({ ...curr, budgetRange: event.target.value }))
                    }
                    placeholder="$5k–$15k"
                  />
                </Field>

                <Field label="Timeline">
                  <Input
                    value={form.timeline}
                    onChange={(event) =>
                      setForm((curr) => ({ ...curr, timeline: event.target.value }))
                    }
                    placeholder="This month"
                  />
                </Field>
              </div>

              <Field label="Contact email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm((curr) => ({ ...curr, contactEmail: event.target.value }))
                  }
                  placeholder="name@brand.com"
                  required
                />
              </Field>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Button type="submit" className="rounded-full px-5">
                  Submit Inquiry
                </Button>
                <a
                  href="mailto:hello@matchapp.ai"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Email hello@matchapp.ai
                </a>
              </div>
            </form>
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
