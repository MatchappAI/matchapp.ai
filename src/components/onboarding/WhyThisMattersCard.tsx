import { type ReactNode } from "react";

type Props = {
  bullets: string[];
  children?: ReactNode;
};

export function WhyThisMattersCard({ bullets, children }: Props) {
  return (
    <aside
      className="rounded-[20px] border p-6 sm:p-7 text-white"
      style={{
        // Deeper, opaque base so white text reads crisply over any background.
        background:
          "linear-gradient(160deg, rgba(15,10,40,0.92) 0%, rgba(30,15,70,0.88) 60%, rgba(55,25,110,0.85) 100%)",
        borderColor: "rgba(139,92,246,0.35)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <h3 className="text-[15px] font-semibold text-white">
        Why this matters
      </h3>

      <ul className="mt-4 space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13px] text-white">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: "#10B981",
                boxShadow: "0 0 8px rgba(16,185,129,0.7)",
              }}
            />
            <span className="font-light leading-relaxed text-white/95">{b}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-6 rounded-2xl border p-4"
        style={{
          background: "rgba(76,5,25,0.55)",
          borderColor: "rgba(244,63,94,0.45)",
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100">
          Important rule
        </div>
        <p className="mt-1.5 text-[12.5px] font-light leading-relaxed text-white">
          MatchAI never signs, represents, or fully negotiates on your behalf
          without approval.
        </p>
      </div>

      {children && <div className="mt-6 text-white">{children}</div>}
    </aside>
  );
}
