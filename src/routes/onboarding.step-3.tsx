import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy analysis screen — the single-screen /onboarding now kicks analysis in
// the background and sends the user straight to /dashboard/brands.
export const Route = createFileRoute("/onboarding/step-3")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/brands" });
  },
});
