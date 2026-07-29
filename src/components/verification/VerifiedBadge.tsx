import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  verified: boolean;
  handle?: string | null;
  platform?: string | null;
  size?: "sm" | "md";
  showUnverified?: boolean;
  className?: string;
};

export function VerifiedBadge({
  verified,
  handle,
  platform,
  size = "sm",
  showUnverified = false,
  className,
}: Props) {
  const px = size === "md" ? "h-5 w-5" : "h-4 w-4";

  if (verified) {
    return (
      <span
        className={cn("inline-flex items-center", className)}
        title={
          handle && platform
            ? `@${handle} verified on ${platform}`
            : "Verified creator"
        }
        aria-label="Verified creator"
      >
        <CheckCircle2
          className={cn(px, "fill-emerald-500 text-emerald-950")}
          strokeWidth={2.5}
        />
      </span>
    );
  }
  if (!showUnverified) return null;
  return (
    <span
      className={cn("inline-flex items-center", className)}
      title="Account not verified"
      aria-label="Account not verified"
    >
      <AlertCircle className={cn(px, "text-amber-400")} strokeWidth={2.5} />
    </span>
  );
}
