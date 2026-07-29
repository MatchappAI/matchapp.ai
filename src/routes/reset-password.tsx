import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — MatchAI" },
      { name: "description", content: "Reset your MatchAI account password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Detect recovery flow via URL hash (set by the email link) or via the
    // PASSWORD_RECOVERY auth event Supabase fires after parsing it.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setIsRecovery(true);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!password || password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setMessage("Password updated successfully.");
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex justify-center">
          <MatchAILogo size="md" />
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-foreground">
          {isRecovery ? "Set new password" : "Reset password"}
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {isRecovery
            ? "Enter your new password below."
            : "Invalid or expired reset link. Please request a new one."}
        </p>

        {isRecovery && (
          <div
            className="space-y-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) handleSubmit();
            }}
          >
            <div className="relative">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                minLength={6}
                className="h-11 rounded-xl ps-9 text-[14px]"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70">
                <LockIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="relative">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                minLength={6}
                className="h-11 rounded-xl ps-9 text-[14px]"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70">
                <LockIcon className="h-4 w-4" />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="h-11 w-full rounded-xl bg-gradient-to-b from-[#a78bfa] to-[#7c3aed] text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform hover:-translate-y-px hover:from-[#b9a1ff] hover:to-[#8b46ff]"
            >
              {loading ? "Updating…" : "Update password"}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 text-center text-xs text-emerald-500" role="status">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="underline underline-offset-2 hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
