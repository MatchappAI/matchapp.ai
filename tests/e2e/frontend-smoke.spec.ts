import { expect, test, type Page } from "@playwright/test";

type GuardState = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

function installGuards(
  page: Page,
  allowRequestFailure: (url: string) => boolean = () => false,
): GuardState {
  const state: GuardState = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      state.consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    state.pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    if (allowRequestFailure(request.url())) return;
    state.requestFailures.push(
      `${request.method()} ${request.url()}${request.failure()?.errorText ? ` :: ${request.failure()?.errorText}` : ""}`,
    );
  });

  return state;
}

function assertClean(state: GuardState) {
  expect.soft(state.consoleErrors, `console errors: ${state.consoleErrors.join("\n")}`).toEqual([]);
  expect.soft(state.pageErrors, `page errors: ${state.pageErrors.join("\n")}`).toEqual([]);
  expect
    .soft(state.requestFailures, `request failures: ${state.requestFailures.join("\n")}`)
    .toEqual([]);
}

async function focusedLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el as HTMLInputElement).value ||
      el.textContent?.trim() ||
      ""
    );
  });
}

async function tabUntil(page: Page, pattern: RegExp, maxTabs = 16) {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press("Tab");
    const label = await focusedLabel(page);
    if (pattern.test(label)) return label;
  }
  throw new Error(`Could not tab to ${pattern}`);
}

test("landing page renders the public funnel and keyboard CTA", async ({ page }) => {
  const guard = installGuards(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Find paid brand deals/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Try free/i }).first()).toBeVisible();
  await expect(page.getByText("Manual + CSV", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("One inbox", { exact: true }).first()).toBeVisible();

  const focused = await tabUntil(page, /Try free/i);
  expect(focused).toMatch(/Try free/i);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/auth(\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await expect(page.getByPlaceholder("Email address")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();

  assertClean(guard);
});

test("mobile menu and public CTA remain usable", async ({ page }) => {
  const guard = installGuards(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuToggle = page.getByRole("button", { name: /toggle menu/i });
  await expect(menuToggle).toBeVisible();
  await menuToggle.click();
  await page.waitForTimeout(200);
  const mobileDrawer = page.locator("div.fixed.inset-0.z-30.md\\:hidden");
  const mobileSignIn = mobileDrawer.getByRole("link", { name: /Sign in/i });
  await expect(mobileSignIn).toBeVisible();
  await mobileSignIn.click({ force: true });
  await expect(page).toHaveURL(/\/auth(\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();

  assertClean(guard);
});

test("auth page renders the form and mode toggles work", async ({ page }) => {
  const guard = installGuards(page, (url) => url.includes("supabase.co"));

  await page.goto("/auth?tab=signup&plan=starter");

  await expect(page.getByRole("heading", { name: /Create your account/i })).toBeVisible();
  await expect(page.getByPlaceholder("Full name")).toBeVisible();
  await expect(page.getByPlaceholder("Email address")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();

  const loginToggle = page.getByRole("button", { name: /Log in/i });
  await loginToggle.click();
  await expect(page.getByRole("button", { name: /Forgot password/i })).toBeVisible();
  await expect(page.getByPlaceholder("Full name")).toHaveCount(0);
  await expect(page.getByPlaceholder("Email address")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();

  const forgotToggle = page.getByRole("button", { name: /Forgot password/i });
  await forgotToggle.click();
  await expect(page.getByRole("heading", { name: /Reset your password/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send reset link/i })).toBeVisible();

  const backToggle = page.getByRole("button", { name: /Log in/i });
  await backToggle.click();
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();

  assertClean(guard);
});

test("protected dashboard routes redirect unauthenticated users to auth", async ({ page }) => {
  const guard = installGuards(page, (url) => url.includes("supabase.co"));

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth(\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();

  assertClean(guard);
});
