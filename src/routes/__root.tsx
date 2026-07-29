import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { LandingChatWidget } from "@/components/chat/LandingChatWidget";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MatchAI — Your AI brand deals agent" },
      { name: "description", content: "Find brands, draft outreach in your voice, follow up, handle replies, price deals, and get paid — with one personal AI agent for creators." },
      { name: "author", content: "MatchAI" },
      { property: "og:title", content: "MatchAI — Your AI brand deals agent" },
      { property: "og:description", content: "Your personal agent finds brands, drafts outreach, follows up, and helps you get paid. Built for micro and nano creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MatchAI — Your AI brand deals agent" },
      { name: "twitter:description", content: "Your personal agent finds brands, drafts outreach, follows up, and helps you get paid." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/74c6ce90-58a4-40e9-a4c9-b4e99b246faa/id-preview-197b074e--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app-1779793985273.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/74c6ce90-58a4-40e9-a4c9-b4e99b246faa/id-preview-197b074e--64dc7356-e06d-4118-bdce-c60f5c5454e9.lovable.app-1779793985273.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://api.fontshare.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&f[]=general-sans@500,600,700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The docked MatchAI panel already lives inside the dashboard, so we hide
  // the floating widget there — same agent, one surface — while still
  // handing off the landing conversation into the dashboard chat.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showWidget = !pathname.startsWith("/dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {showWidget && <LandingChatWidget />}
    </QueryClientProvider>
  );
}

