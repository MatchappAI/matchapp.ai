import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

type Cta =
  | { label: string; to: string }
  | { label: string; onClick: () => void; disabled?: boolean };

type Props = {
  title: string;
  description?: string;
  cta?: Cta;
  secondaryCta?: Cta;
  icon?: ReactNode;
  /** Optional small footer text under CTAs, e.g. progress hint */
  footer?: ReactNode;
};

function CtaButton({ cta, primary = true }: { cta: Cta; primary?: boolean }) {
  const cls = primary
    ? "inline-flex h-10 items-center justify-center rounded-xl bg-primary hover:bg-primary/90 transition-colors px-5 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] transition-opacity hover:opacity-90 disabled:opacity-50"
    : "inline-flex h-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] px-5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06]";
  if ("to" in cta) {
    return (
      <Link to={cta.to} className={cls}>
        {cta.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={cta.onClick} disabled={cta.disabled} className={cls}>
      {cta.label}
    </button>
  );
}

export function EmptyState({ title, description, cta, secondaryCta, icon, footer }: Props) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-foreground/10 bg-foreground/[0.02] px-8 py-12 text-center">
      {/* Soft radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.03),transparent_60%)]" />
      <div className="relative">
        {icon && <div className="mb-5 inline-flex items-center justify-center text-primary/70">{icon}</div>}
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {(cta || secondaryCta) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {cta && <CtaButton cta={cta} primary />}
            {secondaryCta && <CtaButton cta={secondaryCta} primary={false} />}
          </div>
        )}
        {footer && <div className="mt-5 text-xs text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
