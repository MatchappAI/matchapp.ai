import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { useIsSignedIn } from "@/hooks/useIsSignedIn";

const links = [
  { hash: "how", label: "How it works" },
  { hash: "features", label: "Features" },
  { hash: "pricing", label: "Pricing" },
  { hash: "faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const signedIn = useIsSignedIn();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const primaryCta = signedIn
    ? { to: "/dashboard" as const, label: "My dashboard" }
    : { to: "/auth" as const, label: "Find Paid Brand Deals" };

  return (
    <>
      <nav
        className={`sticky top-4 z-40 mx-auto mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/30 transition-all duration-500 ${
          scrolled ? "nav-scrolled px-4 py-2.5" : "px-4 py-3"
        }`}
      >
        <Link to="/" className="flex items-center" aria-label="MatchAI">
          <MatchAILogo size="md" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              to="/"
              hash={l.hash}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!signedIn && (
            <Link
              to="/auth"
              className="hidden md:inline-flex rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          )}
          <Link
            to={primaryCta.to}
            className="btn-sheen hidden md:inline-flex rounded-full bg-primary hover:bg-primary/90 transition-colors px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] ring-1 ring-foreground/15 transition-all duration-300 hover:-translate-y-0.5"
          >
            {primaryCta.label}
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/40 text-foreground backdrop-blur md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <motion.div
              className="absolute inset-0 bg-background/60 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              className="absolute right-0 top-0 h-full w-[min(320px,85vw)] border-l border-border/60 bg-card/90 p-6 pt-24 shadow-2xl backdrop-blur-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex flex-col gap-1">
                {links.map((l, i) => (
                  <motion.div
                    key={l.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.06,
                      duration: 0.4,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                  >
                    <Link
                      to="/"
                      hash={l.hash}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-4 py-3 text-base font-medium text-foreground/90 transition-colors hover:bg-primary/10 hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className="mt-6 flex flex-col gap-2"
              >
                {!signedIn && (
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/60 px-5 py-3 text-sm font-medium text-foreground"
                  >
                    Sign in
                  </Link>
                )}
                <Link
                  to={primaryCta.to}
                  onClick={() => setOpen(false)}
                  className="btn-sheen flex items-center justify-center rounded-2xl bg-primary hover:bg-primary/90 transition-colors px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.22)] ring-1 ring-foreground/15"
                >
                  {primaryCta.label}
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
