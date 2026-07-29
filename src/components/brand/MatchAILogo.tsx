import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import markUrl from "@/assets/matchai-mark-transparent.png";
import wordmarkUrl from "@/assets/matchai-wordmark.png";

const wordmarkAsset = { url: wordmarkUrl };



type Size = "sm" | "md" | "lg" | "xl";
type Variant = "wordmark" | "mark";

const SIZE_PX: Record<Size, number> = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 56,
};

const TEXT_PX: Record<Size, number> = {
  sm: 15,
  md: 18,
  lg: 22,
  xl: 30,
};

type Props = {
  size?: Size;
  variant?: Variant;
  className?: string;
  /** Wrap in a Link to "/" (or provided href). Set to false to render plain image. */
  asLink?: boolean | string;
  ariaLabel?: string;
};

/**
 * Single source of truth for the MatchAI logo across every surface.
 * Wordmark is rendered as [mark image] + CSS text so it adapts to any theme.
 */
export function MatchAILogo({
  size = "md",
  variant = "wordmark",
  className,
  asLink = false,
  ariaLabel = "MatchAI",
}: Props) {
  const height = SIZE_PX[size];
  const textSize = TEXT_PX[size];

  const markImg = (
    <span
      style={{ height, width: height }}
      className="inline-flex aspect-square shrink-0 items-center justify-center overflow-visible"
    >
      <img
        src={markUrl}
        alt=""
        draggable={false}
        style={{ height, width: height }}
        className="h-full w-full object-contain select-none"
      />
    </span>
  );

  const content =
    variant === "mark" ? (
      <span
        aria-label={ariaLabel}
        className={cn(
          "inline-flex aspect-square shrink-0 items-center justify-center overflow-visible",
          className,
        )}
      >
        <img
          src={markUrl}
          alt={ariaLabel}
          draggable={false}
          className="h-full w-full object-contain select-none"
        />
      </span>
    ) : (
      <span className={cn("inline-flex items-center gap-2 select-none", className)} aria-label={ariaLabel}>
        {markImg}
        <img
          src={wordmarkAsset.url}
          alt={ariaLabel}
          draggable={false}
          style={{ height: Math.round(textSize * 1.1) }}
          className="w-auto object-contain select-none"
        />
      </span>
    );

  if (asLink) {
    const to = typeof asLink === "string" ? asLink : "/";
    return (
      <Link to={to} aria-label={ariaLabel} className="inline-flex items-center transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }
  return content;
}

