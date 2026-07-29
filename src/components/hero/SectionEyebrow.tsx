export function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(230_70%_38%)]">
      <span className="h-px w-8 bg-gradient-to-r from-transparent via-[hsl(230_70%_38%)]/60 to-[hsl(230_70%_38%)]" />
      <span>{children}</span>
    </div>
  );
}
