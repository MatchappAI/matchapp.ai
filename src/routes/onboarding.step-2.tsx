import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding/step-2")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding" });
  },
});
