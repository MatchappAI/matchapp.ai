import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MatchAILogo } from "@/components/brand/MatchAILogo";

export const TOTAL_STEPS = 3;


type Props = {
  /** Visual step shown in the progress bar (1..10). Sub-steps share their parent step. */
  step: number;
  children: ReactNode;
  /** Called when the Back button is clicked. Omit to hide Back (step 1). */
  onBack?: () => void;
};

export function OnboardingShell({ step, children, onBack }: Props) {
  const navigate = useNavigate();
  const [confirmExit, setConfirmExit] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% -10%, rgba(139,92,246,0.22), transparent 60%), linear-gradient(135deg, #030712 0%, #0B1120 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setConfirmExit(true)}
              className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Exit onboarding"
            >
              <MatchAILogo size="md" />
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.12] bg-transparent px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>

          <ProgressBar step={step} />
        </header>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-6 flex-1 rounded-3xl border border-white/[0.07] px-6 py-7 sm:px-8 lg:px-10"

          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {children}
        </motion.div>
      </div>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress is saved, but you'll exit the setup flow. You can resume from where you left off anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep setting up</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              Exit onboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function ProgressBar({ step }: { step: number }) {
  const current = Math.max(1, Math.min(TOTAL_STEPS, Math.floor(step)));
  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-[10px] font-light uppercase tracking-[0.22em] text-white/55">
        Step {current} of {TOTAL_STEPS}
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const active = i < current;
          return (
            <motion.span
              key={i}
              initial={false}
              animate={{ opacity: active ? 1 : 0.6 }}
              className={cn("h-1.5 w-6 rounded-full transition-colors")}
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, #8B5CF6, #A855F7)",
                      boxShadow: "0 0 10px rgba(139,92,246,0.6)",
                    }
                  : { background: "rgba(255,255,255,0.08)" }
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Save onboarding_step (only ever advances it) to the user's profile.
 */
export async function advanceOnboardingStep(nextStep: number) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const userId = data.user.id;
  const email = data.user.email ?? null;
  const target = Math.max(1, Math.floor(nextStep));
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("user_id", userId)
    .maybeSingle();
  const current = profile?.onboarding_step ?? 1;
  const merged = Math.max(current, target);
  await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, email, onboarding_step: merged },
      { onConflict: "user_id" },
    );
}
