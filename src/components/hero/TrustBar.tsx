import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

/**
 * App-owned trust row. Wording is intentionally factual — describes controls
 * the app actually exposes. No certifications, no compliance claims.
 */
const items = [
  {
    label: "You approve every send",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      </svg>
    ),
  },
  {
    label: "Protected payouts",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M10 2.5l6.5 2.5v4.2c0 4.1-2.7 7.6-6.5 8.3-3.8-.7-6.5-4.2-6.5-8.3V5L10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7.5 10.4l1.8 1.8 3.4-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Verified sender domain",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <rect x="4.5" y="8.5" width="11" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 8.5V6a3 3 0 016 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="10" cy="12.5" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Revoke access anytime",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M3.6 10.5a6.4 6.4 0 1010.9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14.5 3.2v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Your data, your control",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M10 2.5l6.5 2.5v4.2c0 4.1-2.7 7.6-6.5 8.3-3.8-.7-6.5-4.2-6.5-8.3V5L10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10 7.5v3M10 13v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function TrustBar() {
  return (
    <section
      aria-label="Trust commitments"
      className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-2"
    >
      <div className="rounded-2xl border border-border/60 bg-card/40 px-5 py-5 sm:px-7 backdrop-blur">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Built on trust · App-owned commitments
          </p>
          <Link
            to="/trust"
            className="text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
          >
            Read the full trust overview →
          </Link>
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it, i) => (
            <motion.li
              key={it.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card-inner/40 px-3 py-2.5 text-[12.5px] text-foreground/90"
            >
              <span className="text-primary/90">{it.icon}</span>
              <span className="leading-tight">{it.label}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
