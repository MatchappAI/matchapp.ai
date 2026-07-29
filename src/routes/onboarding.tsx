import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Instagram, Youtube, Linkedin, Twitch, Mic } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { WhyThisMattersCard } from "@/components/onboarding/WhyThisMattersCard";
import { FieldLabel, GlassInput, GradientButton } from "@/components/onboarding/fields";
import { cn } from "@/lib/utils";
import { saveStep1, saveStep2, completeQuickOnboarding } from "@/lib/onboarding-v3.functions";
import { startScrapeAll } from "@/lib/onboarding-scrape.functions";
import { runCreatorAnalysis } from "@/lib/ai-engine.functions";

const PLATFORMS = [
  { id: "tiktok", name: "TikTok", Icon: Music2, placeholder: "@yourhandle" },
  { id: "instagram", name: "Instagram", Icon: Instagram, placeholder: "@yourhandle" },
  { id: "youtube", name: "YouTube", Icon: Youtube, placeholder: "@channel" },
  { id: "linkedin", name: "LinkedIn", Icon: Linkedin, placeholder: "your-name" },
  { id: "twitch", name: "Twitch", Icon: Twitch, placeholder: "channel" },
  { id: "podcast", name: "Podcast", Icon: Mic, placeholder: "Show name" },
] as const;
type PlatformId = (typeof PLATFORMS)[number]["id"];

const NICHES = [
  "Fitness", "Beauty", "Tech", "Gaming", "Food", "Travel",
  "Fashion", "Finance", "Lifestyle", "Education", "Comedy", "Music",
];

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Get started — MatchAI" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profile?.onboarding_complete) throw redirect({ to: "/dashboard" });
  },
  component: QuickOnboarding,
});

function QuickOnboarding() {
  const navigate = useNavigate();
  const save1 = useServerFn(saveStep1);
  const save2 = useServerFn(saveStep2);
  const finalize = useServerFn(completeQuickOnboarding);
  const startScrape = useServerFn(startScrapeAll);
  const runAi = useServerFn(runCreatorAnalysis);

  const [fullName, setFullName] = useState("");
  const [niche, setNiche] = useState("");
  const [selected, setSelected] = useState<Set<PlatformId>>(new Set());
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const meta = u.user.user_metadata as Record<string, unknown> | undefined;
      const name =
        p?.full_name ||
        (typeof meta?.full_name === "string" ? meta.full_name : "") ||
        (typeof meta?.name === "string" ? meta.name : "") ||
        "";
      if (name) setFullName(name);
    })();
  }, []);

  const togglePlatform = (id: PlatformId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setHandles((h) => {
          const { [id]: _drop, ...rest } = h;
          return rest;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedArr = PLATFORMS.filter((p) => selected.has(p.id));
  const allHandlesFilled = selectedArr.every((p) => (handles[p.id] ?? "").trim().length > 0);
  const canSubmit =
    fullName.trim() && niche.trim() && selectedArr.length > 0 && allHandlesFilled;

  const onLaunch = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const payload = selectedArr.map((p) => ({
        platform: p.id,
        handle: handles[p.id].trim(),
      }));
      // 1. Save creator identity
      await save1({
        data: { full_name: fullName.trim(), niche: niche.trim(), handles: payload },
      });
      // 2. Sane defaults for preferences — editable later in Settings.
      await save2({
        data: {
          min_deal_value: 0,
          blocked_categories: null,
          market_scope: "both",
          location: null,
        },
      });
      // 3. Kick scrape + analysis in the background. Do not await.
      startScrape({ data: { handles: payload } }).catch(() => undefined);
      runAi({}).catch(() => undefined);
      // 4. Flip the profile to complete and go straight to the aha moment.
      await finalize({ data: {} as never });
      navigate({ to: "/dashboard/brands" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  const cta = busy
    ? "Launching your agent…"
    : selectedArr.length === 0
      ? "Add a handle to launch"
      : "Launch my agent";

  return (
    <OnboardingShell step={1}>
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white">
            One screen. Then your agent starts working.
          </h1>
          <p className="mt-1.5 max-w-xl text-[14px] font-light leading-relaxed text-white/55">
            Name, niche, and at least one social handle — that's all we need.{" "}
            <span className="text-white/80">No login, no password, no OAuth.</span>{" "}
            You'll see real brand matches inside 60 seconds.
          </p>

          <div className="mt-6 grid gap-5 sm:max-w-xl">
            <FieldLabel label="Full name" required>
              <GlassInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </FieldLabel>

            <FieldLabel label="Niche" required>
              <GlassInput
                list="niches"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Fitness, Beauty, Tech…"
              />
              <datalist id="niches">
                {NICHES.map((n) => <option key={n} value={n} />)}
              </datalist>
            </FieldLabel>

            <FieldLabel label="Platforms you create on" required>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PLATFORMS.map(({ id, name, Icon }) => {
                  const on = selected.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePlatform(id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-all",
                        on
                          ? "border-[#8B5CF6] text-white"
                          : "border-[rgba(139,92,246,0.15)] text-white/70 hover:border-[rgba(139,92,246,0.5)]",
                      )}
                      style={{
                        background: on ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                        boxShadow: on ? "0 0 18px rgba(139,92,246,0.32)" : undefined,
                      }}
                      title={name}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10.5px] font-medium">{name}</span>
                    </button>
                  );
                })}
              </div>
            </FieldLabel>

            {selectedArr.length > 0 && (
              <div className="grid gap-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                  Your handle{selectedArr.length > 1 ? "s" : ""}
                </p>
                {selectedArr.map(({ id, name, Icon, placeholder }) => (
                  <div key={id} className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/75">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <GlassInput
                        value={handles[id] ?? ""}
                        onChange={(e) =>
                          setHandles((h) => ({ ...h, [id]: e.target.value }))
                        }
                        placeholder={`${name} — ${placeholder}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-[11px] text-white/40">
              You can refine deal preferences, market scope, and rate floor anytime in Settings.
            </p>
            <GradientButton disabled={!canSubmit || busy} onClick={onLaunch}>
              {cta}
            </GradientButton>
          </div>
        </div>

        <WhyThisMattersCard
          bullets={[
            "Type a handle — we pull real followers, engagement, and recent posts. No login.",
            "Your agent starts matching brands in the background while you land on your dashboard.",
            "Editable later — this is just to get moving.",
          ]}
        />
      </div>
    </OnboardingShell>
  );
}
