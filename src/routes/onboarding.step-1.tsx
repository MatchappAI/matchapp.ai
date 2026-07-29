import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy 3-step onboarding collapsed into single-screen /onboarding.
export const Route = createFileRoute("/onboarding/step-1")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding" });
  },
});
