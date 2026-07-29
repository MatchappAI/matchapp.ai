import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  User as UserIcon,
  Link2,
  Bell,
  Shield,
  LogOut,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Upload,
  Sparkles,
  Target,
} from "lucide-react";
import { getOnboardingAnswers, updateOnboardingAnswers, addSocialHandle } from "@/lib/onboarding-v3.functions";
import { startScrapeAll } from "@/lib/onboarding-scrape.functions";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { AgentPersonalizationSection } from "@/components/settings/AgentPersonalizationSection";
import { CreatorSetupSection } from "@/components/settings/CreatorSetupSection";
import { RateHelperCard } from "@/components/settings/RateHelperCard";
import { ComplianceSection } from "@/components/settings/ComplianceSection";
import {
  getSettingsData,
  updateProfile,
  updateNotificationPrefs,
  refreshAvatar,
  getAgentMode,
  setAgentMode,
} from "@/lib/dashboard.functions";


import {
  getSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
  getConnectStatus,
  createConnectOnboardingLink,
} from "@/lib/payments.functions";
import { CreditCard, Mail, Banknote } from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { VerificationCard } from "@/components/verification/VerificationCard";
import { toast } from "sonner";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — MatchAI" }] }),
  component: SettingsPage,
});

type NotifPrefs = {
  email_brand_match?: boolean;
  email_brand_reply?: boolean;
  email_payment?: boolean;
  email_weekly_digest?: boolean;
  inapp_approvals?: boolean;
  inapp_activity?: boolean;
};

const NOTIF_ITEMS: { key: keyof NotifPrefs; label: string; description: string; group: "email" | "inapp" }[] = [
  { key: "email_brand_match", label: "New brand matches", description: "When the agent surfaces a new brand fit.", group: "email" },
  { key: "email_brand_reply", label: "Brand replies", description: "When a brand responds to your outreach.", group: "email" },
  { key: "email_payment", label: "Payments", description: "Internal payment records updated or marked paid.", group: "email" },
  { key: "email_weekly_digest", label: "Weekly digest", description: "A Monday morning summary of activity.", group: "email" },
  { key: "inapp_approvals", label: "Approval requests", description: "Show a banner when the agent needs you.", group: "inapp" },
  { key: "inapp_activity", label: "Activity feed", description: "Live updates on the dashboard activity panel.", group: "inapp" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getData = useServerFn(getSettingsData);
  
  const saveProfile = useServerFn(updateProfile);
  const saveNotif = useServerFn(updateNotificationPrefs);
  const reAvatar = useServerFn(refreshAvatar);

  const fetchMode = useServerFn(getAgentMode);
  const saveMode = useServerFn(setAgentMode);

  const settings = useQuery({
    queryKey: ["settings-data"],
    queryFn: () => getData({ data: {} as never }),
  });


  const agentMode = useQuery({
    queryKey: ["agent-mode"],
    queryFn: () => fetchMode({ data: {} as never }),
  });
  const subFn = useServerFn(getSubscriptionStatus);
  const cancelFn = useServerFn(cancelSubscription);
  const resumeFn = useServerFn(resumeSubscription);
  const subscription = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => subFn({ data: {} as never }),
  });
  const [subBusy, setSubBusy] = useState(false);
  const onCancelSub = async () => {
    if (!confirm("Cancel your subscription at the end of the billing period?")) return;
    setSubBusy(true);
    try {
      await cancelFn({ data: {} as never });
      toast.success("Subscription set to cancel at period end.");
      qc.invalidateQueries({ queryKey: ["subscription-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel subscription");
    } finally {
      setSubBusy(false);
    }
  };
  const onResumeSub = async () => {
    setSubBusy(true);
    try {
      await resumeFn({ data: {} as never });
      toast.success("Subscription resumed.");
      qc.invalidateQueries({ queryKey: ["subscription-status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resume subscription");
    } finally {
      setSubBusy(false);
    }
  };

  // Payouts / Stripe Connect
  const connectFn = useServerFn(getConnectStatus);
  const startConnect = useServerFn(createConnectOnboardingLink);
  const connect = useQuery({
    queryKey: ["connect-status"],
    queryFn: () => connectFn({ data: {} as never }),
  });
  const [connectBusy, setConnectBusy] = useState(false);
  const onStartConnect = async () => {
    setConnectBusy(true);
    try {
      const { url } = await startConnect({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payout onboarding");
      setConnectBusy(false);
    }
  };
  // Refresh connect status when user returns from Stripe-hosted onboarding.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("connect")) {
      qc.invalidateQueries({ queryKey: ["connect-status"] });
      url.searchParams.delete("connect");
      window.history.replaceState({}, "", url.toString());
    }
  }, [qc]);





  // Realtime: refetch when the profile row changes server-side (e.g. agent
  // fills it in via chat) so the visible flash animation plays.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: u }) => {
      if (!active || !u.user) return;
      channel = supabase
        .channel(`profile-${u.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${u.user.id}`,
          },
          () => qc.invalidateQueries({ queryKey: ["settings-data"] }),
        )
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const profile = settings.data?.profile;
  const platforms = settings.data?.platforms ?? [];
  const verifications = (settings.data?.verifications ?? []) as Array<{
    platform: string;
    handle: string;
    status: string;
  }>;
  const verifyByPlatform = new Map<string, { handle: string; status: string }>();
  for (const v of verifications) {
    const k = v.platform.toLowerCase();
    if (!verifyByPlatform.has(k)) verifyByPlatform.set(k, { handle: v.handle, status: v.status });
  }

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [savedSenderEmail, setSavedSenderEmail] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [refreshingAvatar, setRefreshingAvatar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>({});

  const fullNameFlash = useFlashOnChange(profile?.full_name ?? "");
  const displayNameFlash = useFlashOnChange(profile?.display_name ?? "");
  const bioFlash = useFlashOnChange(profile?.bio ?? "");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setSenderEmail((profile as { sender_email?: string | null }).sender_email ?? "");
      setSavedSenderEmail((profile as { sender_email?: string | null }).sender_email ?? null);
      setPrefs((profile.notification_prefs as NotifPrefs) ?? {});
    }
  }, [profile]);

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const trimmed = senderEmail.trim();
      const res = await saveProfile({
        data: {
          full_name: fullName,
          display_name: displayName,
          bio,
          sender_email: trimmed,
        },
      });
      if (res.ok) {
        setSavedSenderEmail(trimmed || null);
        toast.success(
          trimmed
            ? `Saved — outreach will be sent from ${trimmed}`
            : "Profile updated",
        );
        qc.invalidateQueries({ queryKey: ["settings-data"] });
        qc.invalidateQueries({ queryKey: ["dashboard-user"] });
      } else {
        toast.error(res.error ?? "Could not update profile");
      }
    } catch (e: any) {
      toast.error(
        e?.message?.includes("email")
          ? "Please enter a valid email address"
          : e?.message ?? "Could not update profile",
      );
    } finally {
      setSavingProfile(false);
    }
  };




  const onTogglePref = async (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const res = await saveNotif({ data: { [key]: value } });
    if (!res.ok) {
      setPrefs(prefs);
      toast.error("Could not save preference");
    }
  };

  const onRefreshAvatar = async () => {
    setRefreshingAvatar(true);
    const res = await reAvatar({ data: {} as never });
    setRefreshingAvatar(false);
    if (res.ok) {
      toast.success("Avatar refreshed");
      qc.invalidateQueries({ queryKey: ["settings-data"] });
      qc.invalidateQueries({ queryKey: ["dashboard-user"] });
    } else {
      toast.error(res.error ?? "Could not refresh avatar");
    }
  };

  const onUploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      // Avatars bucket is private — mint a long-lived signed URL (1 year).
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;
      const url = signed.signedUrl;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", u.user.id);
      if (error) throw error;
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["settings-data"] });
      qc.invalidateQueries({ queryKey: ["dashboard-user"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (displayName || fullName || profile?.email || "?").slice(0, 2).toUpperCase();


  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-[520px]:grid-cols-1">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Settings</p>
          <h1 className="mt-2 break-words text-4xl font-semibold tracking-tight">Your workspace</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            Signed in as {profile?.email ?? "—"} · {profile?.plan ?? "free"} plan
          </p>
        </div>
        <Button variant="outline" onClick={signOut} className="rounded-xl">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* 1. Social handles — identity foundation, required for matching */}
      <Section icon={Link2} title="Social handles" description="Type a handle — we pull the public data. No login needed. At least one is required.">
        <div className="space-y-3">
          {platforms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/[0.08] p-4 text-sm text-muted-foreground">
              No social handles connected yet. Finish onboarding to link your platforms.
            </div>
          ) : (
            platforms.map((p) => {
              const v = verifyByPlatform.get(p.platform.toLowerCase());
              const status = v?.status ?? "unverified";
              return (
                <ConnectionRow
                  key={`${p.platform}-${p.handle}`}
                  icon={() => <PlatformIcon platform={p.platform} className="h-4 w-4" />}
                  title={titleCase(p.platform)}
                  subtitle={
                    p.handle
                      ? `@${p.handle} · ${formatFollowers(p.follower_count)} followers`
                      : "Connected"
                  }
                  connected
                  verificationStatus={status}
                  platform={p.platform}
                  handle={p.handle}
                />
              );
            })
          )}
          <AddHandleForm
            existing={platforms.map((p) => p.platform.toLowerCase())}
            onAdded={() => settings.refetch()}
          />
        </div>
      </Section>

      {/* 2. Payouts — get paid. Highest-impact money setting. */}
      <Section
        icon={Banknote}
        title="Payouts"
        description="Link a bank account so you can transfer your MatchAI balance out. Success fee is 20% on Free (capped at $99/deal, 0% on repeat brands), 0% on paid plans — Stripe adds a small processing fee."
      >
        {(() => {
          const c = connect.data;
          const ready = Boolean(c?.onboarded && c?.payoutsEnabled);
          return (
            <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
                    {ready ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="break-words">Ready to receive payouts</span>
                      </>
                    ) : c?.accountId ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="break-words">Onboarding incomplete</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">No payout account connected</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {ready
                      ? "Released deal payments will land in your linked bank account within 1–2 business days."
                      : c?.accountId
                        ? "Finish the Stripe onboarding steps to enable payouts."
                        : "Takes ~2 minutes. Powered by Stripe — MatchAI never sees your bank details."}
                  </p>
                </div>
                <Button
                  onClick={onStartConnect}
                  disabled={connectBusy || connect.isLoading}
                  variant={ready ? "outline" : "default"}
                  className="rounded-lg"
                >
                  {connectBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {ready ? "Manage payouts" : c?.accountId ? "Continue setup" : "Connect bank account"}
                </Button>
              </div>
            </div>
          );
        })()}
      </Section>

      {/* 2b. Sender identity & do-not-contact — CAN-SPAM compliance + suppression list */}
      <Section
        icon={Shield}
        title="Sender identity & do-not-contact"
        description="Physical address, unsubscribe footer, and per-creator suppression list. Applied to every outbound send."
      >
        <ComplianceSection />
      </Section>


      {/* 3. Billing — plan & fees */}
      <Section icon={CreditCard} title="Billing" description="Manage your plan. Cancel or resume anytime.">
        {(() => {
          const s = subscription.data;
          const planLabel = s?.plan ?? profile?.plan ?? "free";
          const isPaid = s?.plan && s.plan !== "free" && s.status;
          const cancelAt = s?.currentPeriodEnd
            ? new Date(s.currentPeriodEnd).toLocaleDateString()
            : null;
          return (
            <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium capitalize">{planLabel} plan</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subscription.isLoading
                      ? "Loading…"
                      : !isPaid
                        ? "You're on the free tier. Upgrade from the pricing page anytime."
                        : s?.cancelAtPeriodEnd
                          ? `Cancels on ${cancelAt ?? "your next renewal"}. You keep access until then.`
                          : `Renews${cancelAt ? ` on ${cancelAt}` : ""}. Cancel anytime — no lock-in.`}
                  </p>
                </div>
                {isPaid && !s?.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    onClick={onCancelSub}
                    disabled={subBusy}
                    className="rounded-lg text-muted-foreground"
                  >
                    {subBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancel subscription
                  </Button>
                )}
                {isPaid && s?.cancelAtPeriodEnd && (
                  <Button onClick={onResumeSub} disabled={subBusy} className="rounded-lg">
                    {subBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Resume subscription
                  </Button>
                )}
                <Button
                  variant={isPaid ? "ghost" : "default"}
                  onClick={() => navigate({ to: "/dashboard/settings" })}
                  className="rounded-lg"
                >
                  {isPaid ? "Change plan" : "See plans"}
                </Button>
              </div>
            </div>
          );
        })()}
      </Section>

      {/* 4. Creator setup — brand kit, rates, portfolio the agent uses daily */}
      <CreatorSetupSection />

      {/* 4b. Rate helper — quick "what should I charge" */}
      <RateHelperCard />


      {/* 5. Agent permissions — how much freedom */}
      <Section
        icon={Shield}
        title="Agent permissions"
        description="How much freedom does your agent have? You can change this any time."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {([
            {
              id: "draft_only" as const,
              label: "Draft only",
              tag: "Maximum control",
              body: "I find brands and draft messages. You send manually.",
            },
            {
              id: "approval" as const,
              label: "Approval mode",
              tag: "Default",
              body: "I draft and send only after you approve.",
            },
            {
              id: "autopilot" as const,
              label: "Autopilot",
              tag: "Low touch",
              body: "I pitch approved brand types, follow up, and only ask when a brand replies, pricing is needed, or a contract/payment issue comes up.",
            },
          ]).map((m) => {
            const active = agentMode.data?.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={async () => {
                  const res = await saveMode({ data: { mode: m.id } });
                  if (res.ok) {
                    toast.success(`Agent set to ${m.label.toLowerCase()}`);
                    qc.invalidateQueries({ queryKey: ["agent-mode"] });
                  } else {
                    toast.error(res.error ?? "Could not save permission");
                  }
                }}
                className={
                  "flex h-full flex-col items-start rounded-2xl border p-4 text-left transition-colors " +
                  (active
                    ? "border-primary/50 bg-primary/[0.06]"
                    : "border-foreground/[0.06] bg-foreground/[0.02] hover:border-foreground/15 hover:bg-foreground/[0.04]")
                }
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.label}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                      (active ? "bg-primary/20 text-primary" : "bg-foreground/[0.06] text-muted-foreground")
                    }
                  >
                    {active ? "Active" : m.tag}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.body}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 6. Personalize agent voice */}
      <Section
        icon={Sparkles}
        title="Personalize your agent"
        description="Your agent adapts to you — voice, pace, pricing posture, and rules it should always follow. Change anything any time; I'll adjust on the next message."
      >
        <AgentPersonalizationSection />
      </Section>

      {/* 7. Profile — how you appear */}
      <Section icon={UserIcon} title="Profile" description="How you appear to brands and inside the app.">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="group relative">
              <Avatar className="h-28 w-28 ring-2 ring-primary/20">
                <AvatarImage
                  src={profile?.avatar_url ?? undefined}
                  alt={displayName}
                  className="object-cover object-center"
                />
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                aria-label="Upload new avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1">
                    <Upload className="h-4 w-4" />
                    Change
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAvatar(f);
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="rounded-lg text-xs"
            >
              <Upload className="mr-2 h-3 w-3" />
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshAvatar}
              disabled={refreshingAvatar}
              className="rounded-lg text-xs text-muted-foreground"
            >
              {refreshingAvatar ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Re-scrape
            </Button>
          </div>

          <div className="flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  {...fullNameFlash}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Display name">
                <Input
                  {...displayNameFlash}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="@jane"
                />
              </Field>
            </div>
            <Field label="Bio">
              <Textarea
                {...bioFlash}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short pitch brands will see…"
                rows={3}
                maxLength={500}
              />
            </Field>
            <Field label="Email">
              <Input value={profile?.email ?? ""} disabled />
            </Field>
            <div className="flex justify-end">
              <Button onClick={onSaveProfile} disabled={savingProfile} className="rounded-xl">
                {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* 8. Notifications */}
      <Section icon={Bell} title="Notifications" description="Decide when the agent should ping you.">
        <div className="space-y-6">
          <PrefGroup
            label="Email"
            items={NOTIF_ITEMS.filter((i) => i.group === "email")}
            prefs={prefs}
            onToggle={onTogglePref}
          />
          <div className="h-px bg-foreground/[0.06]" />
          <PrefGroup
            label="In-app"
            items={NOTIF_ITEMS.filter((i) => i.group === "inapp")}
            prefs={prefs}
            onToggle={onTogglePref}
          />
        </div>
      </Section>

      {/* 9. Onboarding answers */}
      <OnboardingAnswersSection />

      {/* 10. Email sending — info only */}
      <Section icon={Mail} title="Email sending" description="MatchAI handles the send — no inbox to connect.">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
            <p className="text-sm font-medium text-foreground">MatchAI verified sender</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every pitch and follow-up goes out from
              {" "}
              <span className="font-mono text-foreground">outreach@notify.www.matchapp.ai</span>
              {" "}shown as
              {" "}
              <span className="text-foreground">You via MatchAI</span>. Replies route
              straight back into your MatchAI inbox — no Gmail, Outlook, or SMTP setup.
            </p>
          </div>
        </div>
      </Section>

    </div>
  );
}



function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-6 backdrop-blur-xl sm:p-8">
      <div className="mb-6 flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">{title}</h2>
          <p className="break-words text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PrefGroup({
  label,
  items,
  prefs,
  onToggle,
}: {
  label: string;
  items: typeof NOTIF_ITEMS;
  prefs: NotifPrefs;
  onToggle: (k: keyof NotifPrefs, v: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-foreground/[0.04] bg-foreground/[0.02] px-4 py-3"
          >
            <div className="min-w-[220px] flex-1">
              <p className="break-words text-sm font-medium">{item.label}</p>
              <p className="break-words text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch className="shrink-0" checked={!!prefs[item.key]} onCheckedChange={(v) => onToggle(item.key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionRow({
  icon: Icon,
  title,
  subtitle,
  connected,
  onConnect,
  onDisconnect,
  verificationStatus,
  platform,
  handle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  connected: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  verificationStatus?: string;
  platform?: string;
  handle?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const status = verificationStatus ?? "unverified";
  const isVerified = status === "verified";
  const canVerify = !!platform && !!handle && !isVerified;

  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
        <div className="flex min-w-[220px] flex-1 items-start gap-3">
          <div className="shrink-0 rounded-xl bg-foreground/[0.04] p-2 text-foreground/80">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{title}</p>
            <p className="break-words text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </span>
          ) : connected ? (
            <span className="hidden items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
              Unverified
            </span>
          ) : (
            <span className="hidden items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
              <XCircle className="h-3 w-3" /> Not connected
            </span>
          )}
          {canVerify && (
            <Button size="sm" variant={open ? "ghost" : "default"} onClick={() => setOpen((o) => !o)} className="rounded-lg">
              {open ? "Close" : "Verify"}
            </Button>
          )}
          {onConnect && !connected && (
            <Button size="sm" onClick={onConnect} className="rounded-lg">Connect</Button>
          )}
          {onDisconnect && connected && (
            <Button size="sm" variant="ghost" onClick={onDisconnect} className="rounded-lg text-muted-foreground">
              Disconnect
            </Button>
          )}
        </div>
      </div>
      {open && canVerify && (
        <div className="border-t border-foreground/[0.06] p-4">
          <VerificationCard
            platform={platform!}
            handle={handle!}
            defaultMethod="email_code"
            onResolved={(o) => {
              if (o === "verified") {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["settings"] });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}


function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFollowers(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function OnboardingAnswersSection() {
  const qc = useQueryClient();
  const load = useServerFn(getOnboardingAnswers);
  const save = useServerFn(updateOnboardingAnswers);
  const answers = useQuery({
    queryKey: ["onboarding-answers"],
    queryFn: () => load({ data: {} as never }),
  });

  const [fullName, setFullName] = useState("");
  const [niche, setNiche] = useState("");
  const [minVal, setMinVal] = useState<string>("");
  const [scope, setScope] = useState<"local" | "international" | "both">("both");
  const [location, setLocation] = useState("");
  const [blocked, setBlocked] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const a = answers.data;
    if (!a) return;
    setFullName(a.full_name ?? "");
    setNiche(a.niche ?? "");
    setMinVal(String(a.min_deal_value ?? 0));
    setScope(a.market_scope ?? "both");
    setLocation(a.location ?? "");
    setBlocked(a.blocked_categories ?? "");
  }, [answers.data]);

  const needsLocation = scope === "local" || scope === "both";
  const num = Number(minVal);
  const canSave =
    fullName.trim().length > 0 &&
    niche.trim().length > 0 &&
    Number.isFinite(num) &&
    num >= 0 &&
    (!needsLocation || location.trim().length > 0);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await save({
        data: {
          full_name: fullName.trim(),
          niche: niche.trim(),
          min_deal_value: Math.round(num),
          market_scope: scope,
          location: location.trim() || null,
          blocked_categories: blocked.trim() || null,
        },
      });
      if (res.ok) {
        toast.success("Preferences updated — the agent will use these on the next run.");
        qc.invalidateQueries({ queryKey: ["onboarding-answers"] });
        qc.invalidateQueries({ queryKey: ["settings-data"] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      icon={Target}
      title="Matching preferences"
      description="Update the answers you gave during onboarding. The agent uses these to find brands and set your negotiation floor."
    >
      {answers.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your answers…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Niche">
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Skincare, gaming, fitness"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum deal value (USD)">
              <Input
                type="number"
                min={0}
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                placeholder="500"
              />
            </Field>
            <Field label="Market scope">
              <div className="grid grid-cols-3 gap-2">
                {(["local", "international", "both"] as const).map((s) => {
                  const on = scope === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={
                        "rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors " +
                        (on
                          ? "border-primary/60 bg-primary/[0.08] text-foreground"
                          : "border-foreground/[0.06] bg-foreground/[0.02] text-muted-foreground hover:border-foreground/15")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          {needsLocation && (
            <Field label="Your location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
              />
            </Field>
          )}
          <Field label="Anything you'd never work with?">
            <Textarea
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              placeholder="e.g. Gambling, supplements, fast fashion…"
              rows={2}
              maxLength={500}
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={!canSave || saving} className="rounded-xl">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save preferences
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

const ADDABLE_PLATFORMS = [
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "youtube", name: "YouTube" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "twitch", name: "Twitch" },
  { id: "podcast", name: "Podcast" },
] as const;

function AddHandleForm({
  existing,
  onAdded,
}: {
  existing: string[];
  onAdded: () => void;
}) {
  const addHandle = useServerFn(addSocialHandle);
  const startScrape = useServerFn(startScrapeAll);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const available = ADDABLE_PLATFORMS.filter((p) => !existing.includes(p.id));

  if (available.length === 0 && !open) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-foreground/[0.14] px-4 py-3 text-sm text-foreground/70 transition hover:border-primary/50 hover:text-primary"
      >
        + Add another handle
      </button>
    );
  }

  const canSubmit = platform && handle.trim().length > 0 && !busy;

  const onAdd = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      const cleanHandle = handle.trim().replace(/^@+/, "");
      await addHandle({ data: { platform: platform as "tiktok" | "instagram" | "youtube" | "linkedin" | "twitch" | "podcast", handle: cleanHandle } });
      // Fire scrape in background — data will appear on next refresh.
      startScrape({ data: { handles: [{ platform, handle: cleanHandle }] } }).catch(() => undefined);
      setPlatform("");
      setHandle("");
      setOpen(false);
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add handle");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-foreground/60">
        Add a handle
      </p>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="h-10 rounded-xl border border-foreground/[0.08] bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60"
        >
          <option value="" disabled>Platform…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle"
          className="h-10 rounded-xl border border-foreground/[0.08] bg-background px-3 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-primary/60"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setOpen(false); setErr(null); }} className="rounded-xl">
            Cancel
          </Button>
          <Button size="sm" onClick={onAdd} disabled={!canSubmit} className="rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Just type the handle — we pull the public follower count and engagement automatically.
      </p>
    </div>
  );
}



