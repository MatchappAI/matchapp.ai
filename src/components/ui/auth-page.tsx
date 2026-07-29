"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AtSignIcon, ChevronLeftIcon, LockIcon, UserIcon } from "lucide-react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { MatchAILogo } from "@/components/brand/MatchAILogo";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import { createCheckoutSession } from "@/lib/payments.functions";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${
      189 + i * 6
    } -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${
      343 - i * 6
    }C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="h-full w-full text-foreground/40" viewBox="0 0 696 316" fill="none" aria-hidden>
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.08 + path.id * 0.02}
            initial={{ pathLength: 0.3, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: [0.25, 0.55, 0.25], pathOffset: [0, 1, 0] }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
  <svg viewBox="0 0 24 24" aria-hidden {...props}>
    <path
      fill="#EA4335"
      d="M12 10.2v3.96h5.52c-.24 1.44-1.68 4.2-5.52 4.2-3.32 0-6.04-2.76-6.04-6.16S8.68 6.04 12 6.04c1.88 0 3.16.8 3.88 1.48l2.64-2.56C16.96 3.52 14.72 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.92 0 9.5-4.86 9.5-7.38 0-.5-.06-.88-.14-1.92H12z"
    />
  </svg>
);

const AuthSeparator = () => (
  <div className="my-6 flex items-center gap-3">
    <div className="h-px flex-1 bg-border" />
    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      or
    </span>
    <div className="h-px flex-1 bg-border" />
  </div>
);

export function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(
    search.tab === "signup" ? "signup" : "login",
  );
  const plan = search.plan ?? null;
  const next = search.next ?? null;
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Route the user after auth: existing users → dashboard, new users → onboarding.
  // If a plan was selected on the pricing page, redirect to Stripe checkout first
  // (unless the user already has an active subscription).
  const routeAfterAuth = async (userId: string) => {
    try {
      if (plan) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", userId)
          .maybeSingle();
        const isActive =
          !!sub &&
          (sub.status === "active" || sub.status === "trialing") &&
          (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
        if (!isActive) {
          const { url } = await createCheckoutSession({
            data: { plan, origin: window.location.origin },
          });
          window.location.href = url;
          return;
        }
      }
      if (next) {
        window.location.href = next;
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile && profile.onboarding_complete === false) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch {
      navigate({ to: "/dashboard", replace: true });
    }
  };

  // Handle OAuth return: when a session lands on this page, route accordingly.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        routeAfterAuth(session.user.id);
      }
    });
    // Also handle the case the page mounts already signed in.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) routeAfterAuth(data.user.id);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setLoading("google");
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth${nextQuery}`,
    });
    if (result.error) {
      setError(result.error.message || "Google sign-in failed.");
      setLoading(null);
      return;
    }
    if (result.redirected) return;
    setLoading(null);
  };

  const handleSubmit = async () => {
    if (!email) return;

    if (mode === "forgot") {
      setLoading("email");
      setError(null);
      setMessage(null);
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) setError(err.message);
      else setMessage("Check your email for a password reset link.");
      setLoading(null);
      return;
    }

    if (mode === "login") {
      if (!password) return;
      setLoading("email");
      setError(null);
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) setError(err.message);
      else if (data.user) await routeAfterAuth(data.user.id);
      setLoading(null);
      return;
    }

    // signup
    if (!password) return;
    setLoading("email");
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth${nextQuery}`,
        data: {
          full_name: fullName.trim(),
          ...(plan ? { plan } : {}),
        },
      },
    });
    if (err) setError(err.message);
    else setMessage("Check your email to confirm your account.");
    setLoading(null);
  };

  const heading = mode === "login"
    ? "Welcome back"
    : mode === "signup"
    ? "Create your account"
    : "Reset your password";

  const subheading = mode === "login"
    ? "Sign in to your MatchAI account."
    : mode === "signup"
    ? "Join MatchAI and start finding brand deals."
    : "Enter your email and we'll send you a reset link.";

  const buttonText = mode === "forgot"
    ? (loading === "email" ? "Sending…" : "Send reset link")
    : mode === "login"
    ? (loading === "email" ? "Signing in…" : "Sign in")
    : (loading === "email" ? "Creating account…" : "Create account");

  const switchTo = (target: "login" | "signup" | "forgot") => {
    setMode(target);
    setError(null);
    setMessage(null);
    setPassword("");
    setFullName("");
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-background text-foreground lg:grid-cols-2">
      {/* LEFT — testimonial panel with floating paths */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-gradient-to-br from-white via-[#f7f8fc] to-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />

        {/* Top: brand */}
        <div className="relative z-10 flex items-center">
          <MatchAILogo size="lg" />
        </div>

        {/* Middle: quote */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative z-10 max-w-md"
        >
          <p className="text-[26px] font-medium leading-[1.25] tracking-tight text-foreground/95">
            "MatchAI has helped me close more brand deals in a month than I did all of last
            year — without writing a single cold DM."
          </p>
          <p className="mt-5 text-sm text-foreground/55">~ Ali Hassan · Creator, 480K followers</p>
        </motion.div>

        {/* Bottom: subtle social proof */}
        <div className="relative z-10 flex items-center gap-3 text-xs text-foreground/45">
          <div className="flex -space-x-2">
            {["#a78bfa", "#38bdf8", "#f472b6"].map((c) => (
              <span
                key={c}
                className="h-6 w-6 rounded-full border border-black/30"
                style={{ background: c }}
              />
            ))}
          </div>
          <span>Trusted by 2,400+ creators</span>
        </div>
      </aside>

      {/* RIGHT — form panel */}
      <main className="relative flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
        {/* mobile brand + back */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center lg:hidden">
            <MatchAILogo size="md" />
          </div>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center">
          <LiquidGlassCard tone="primary" interactive={false} padded={false} className="rounded-3xl">
            <div className="p-7 sm:p-9">
              <div className="mb-8">
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                  {heading}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {subheading}
                </p>
              </div>

              {/* Google OAuth temporarily disabled — pending Google Cloud Console setup.
                  Re-enable by restoring the <Button onClick={handleGoogle}> block. */}


              {/* email fields */}
              <div
                className="space-y-3"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !(loading !== null || !email || (mode !== "forgot" && !password))
                  ) {
                    handleSubmit();
                  }
                }}
              >
                {mode === "forgot" && (
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                )}

                {mode === "signup" && (
                  <div className="relative">
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full name"
                      type="text"
                      className={cn("peer h-11 rounded-xl ps-9 text-[14px]")}
                    />
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70 peer-focus:text-foreground">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    className={cn("peer h-11 rounded-xl ps-9 text-[14px]")}
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70 peer-focus:text-foreground">
                    <AtSignIcon className="h-4 w-4" />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="relative">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      type="password"
                      className={cn("peer h-11 rounded-xl ps-9 text-[14px]")}
                    />
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70 peer-focus:text-foreground">
                      <LockIcon className="h-4 w-4" />
                    </div>
                  </div>
                )}

                {/* Forgot password link */}
                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchTo("forgot")}
                      className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading !== null || !email || (mode !== "forgot" && !password)}
                  className="h-11 w-full rounded-xl bg-gradient-to-b from-[#a78bfa] to-[#7c3aed] text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform hover:-translate-y-px hover:from-[#b9a1ff] hover:to-[#8b46ff]"
                >
                  {buttonText}
                </Button>

                {error && (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="text-xs text-emerald-500" role="status">
                    {message}
                  </p>
                )}
              </div>

              {/* Mode toggle */}
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchTo("signup")}
                      className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                    >
                      Sign up
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchTo("login")}
                      className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Remember your password?{" "}
                    <button
                      type="button"
                      onClick={() => switchTo("login")}
                      className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                    >
                      Log in
                    </button>
                  </>
                )}
              </div>

              <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                By clicking continue, you agree to MatchAI&apos;s Terms of Service and Privacy Policy.
              </p>

            </div>
          </LiquidGlassCard>
        </div>
      </main>
    </div>
  );
}
