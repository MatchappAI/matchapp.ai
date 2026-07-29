import { createFileRoute, redirect } from "@tanstack/react-router";

// /home is the marketing-friendly URL for the agent workspace.
// The real workspace lives under /dashboard (protected).
export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
