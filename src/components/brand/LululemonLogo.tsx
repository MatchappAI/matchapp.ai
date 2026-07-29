// Lululemon brand marks. Simple Icons CDN doesn't host Lululemon, so we render
// their trademarked marks as inline SVG approximations for editorial product
// illustration on the landing page.

export function LululemonMark({ className = "h-full w-full" }: { className?: string }) {
  // Stylized "A" — Lululemon's "Athletically Inclined" symbol mark
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="lululemon"
    >
      <circle cx="32" cy="32" r="30" fill="#D2232A" />
      <path
        d="M32 14 L48 50 H40 L36.5 41 H27.5 L24 50 H16 Z M30 34 H34 L32 28 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function LululemonWordmark({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="lululemon"
    >
      <text
        x="0"
        y="30"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="400"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        lululemon
      </text>
    </svg>
  );
}
