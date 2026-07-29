import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080";

const sharedEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? "https://qjwwhtkwtxucsljeikvz.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_test_key",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service_role_test_key",
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "https://qjwwhtkwtxucsljeikvz.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_test_key",
  VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID ?? "qjwwhtkwtxucsljeikvz",
  LOVABLE_API_KEY: process.env.LOVABLE_API_KEY ?? "lovable_test_key",
  CREATOR_EMAIL_PROVIDER: process.env.CREATOR_EMAIL_PROVIDER ?? "",
  CREATOR_EMAIL_FROM_DOMAIN: process.env.CREATOR_EMAIL_FROM_DOMAIN ?? "mail.matchapp.ai",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_matchai",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_matchai",
  VITE_STRIPE_PUBLISHABLE_KEY: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "pk_test_matchai",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "re_test_matchai",
  CRON_SECRET: process.env.CRON_SECRET ?? "cron_test_matchai",
  WEBHOOK_SHARED_SECRET: process.env.WEBHOOK_SHARED_SECRET ?? "webhook_test_matchai",
  NODE_ENV: "development",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { browserName: "chromium", ...devices["iPhone 12"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 8080",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: sharedEnv,
  },
});
