import { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AutoFilledBadge({ source = "your social data" }: { source?: string }) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide text-white"
      style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(168,85,247,0.35))",
        border: "1px solid rgba(139,92,246,0.5)",
      }}
      title={`Auto-filled from ${source}. Edit to override.`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      auto-filled
    </span>
  );
}

const fieldBase =
  "w-full rounded-xl border bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[14px] font-light text-white placeholder:text-white/30 transition-all duration-200 outline-none";
const fieldDefault = "border-[rgba(255,255,255,0.1)]";
const fieldFocus =
  "focus:border-[rgba(139,92,246,0.6)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.18)]";
const fieldError = "border-rose-500/60 shadow-[0_0_0_3px_rgba(244,63,94,0.15)]";

export function FieldLabel({
  label,
  required,
  children,
  error,
  autoFilled,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string | null;
  autoFilled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center text-[11.5px] font-light uppercase tracking-[0.14em] text-white/55">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
        {autoFilled && <AutoFilledBadge />}
      </span>
      {children}
      {error && (
        <span className="text-[11.5px] font-light text-rose-300" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function GlassInput({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, invalid ? fieldError : fieldDefault, fieldFocus, className)}
        {...props}
      />
    );
  },
);

export const GlassTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function GlassTextarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-[88px] resize-y", invalid ? fieldError : fieldDefault, fieldFocus, className)}
        {...props}
      />
    );
  },
);

export const GlassSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function GlassSelect({ className, invalid, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          fieldBase,
          "cursor-pointer appearance-none bg-[rgba(255,255,255,0.04)] pr-10",
          invalid ? fieldError : fieldDefault,
          fieldFocus,
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff80' stroke-width='1.5'><path d='M6 9l6 6 6-6'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          backgroundSize: "16px",
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function PillToggle({
  value,
  onChange,
  labels = ["No", "Yes"],
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labels?: [string, string];
}) {
  return (
    <div
      className="inline-flex w-fit rounded-full border p-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {[false, true].map((v) => {
        const active = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-medium transition-all duration-200",
              active ? "text-white" : "text-white/55 hover:text-white/80",
            )}
            style={
              active
                ? {
                    background: "linear-gradient(135deg, #8B5CF6, #A855F7)",
                    boxShadow: "0 0 16px rgba(139,92,246,0.45)",
                  }
                : undefined
            }
          >
            {v ? labels[1] : labels[0]}
          </button>
        );
      })}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function GradientButton({ className, children, ...props }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl px-6 text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        className,
      )}
      style={{
        background: "linear-gradient(135deg, #8B5CF6, #A855F7)",
        boxShadow: "0 4px 24px rgba(139,92,246,0.4)",
      }}
      onMouseEnter={(e) => {
        if (!(e.currentTarget as HTMLButtonElement).disabled)
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 8px 32px rgba(139,92,246,0.65)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 4px 24px rgba(139,92,246,0.4)";
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ className, children, ...props }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl border border-white/[0.15] bg-transparent px-5 text-[14px] font-medium text-white transition-colors hover:border-white disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
