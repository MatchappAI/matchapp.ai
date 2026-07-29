import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  CheckCircle2,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Pencil,
} from "lucide-react";
import {
  generateVerificationCode,
  checkVerification,
  skipVerification,
  resendVerificationCode,
  startEmailCodeVerification,
  confirmEmailCodeVerification,
} from "@/lib/verification.functions";

type Verification = {
  id: string;
  platform: string;
  handle: string;
  code: string;
  status: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
};

type ChatLike = (text: string) => void;

type Method = "bio_code" | "email_code";

type Props = {
  platform: string;
  handle: string;
  onResolved?: (outcome: "verified" | "skipped" | "failed") => void;
  postMessage?: ChatLike;
  className?: string;
  defaultMethod?: Method;
};

function formatMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(1, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VerificationCard({
  platform,
  handle,
  onResolved,
  postMessage,
  className,
  defaultMethod = "email_code",
}: Props) {
  const [method, setMethod] = useState<Method>(defaultMethod);

  return (
    <div className={"rounded-[20px] p-6 " + (className ?? "")}
      style={{ border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" }}
    >
      <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Verify your {capitalize(platform)} account
      </div>

      {/* Method switch */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MethodTab
          active={method === "email_code"}
          onClick={() => setMethod("email_code")}
          icon={<Mail className="h-3.5 w-3.5" />}
          title="Email code"
          sub="No edits — code to your public contact email"
          recommended
        />
        <MethodTab
          active={method === "bio_code"}
          onClick={() => setMethod("bio_code")}
          icon={<Pencil className="h-3.5 w-3.5" />}
          title="Bio code"
          sub="Paste a short code in your bio"
        />
      </div>

      <div className="mt-4">
        {method === "email_code" ? (
          <EmailCodeFlow
            platform={platform}
            handle={handle}
            postMessage={postMessage}
            onResolved={onResolved}
            onSwitchToBio={() => setMethod("bio_code")}
          />
        ) : (
          <BioCodeFlow
            platform={platform}
            handle={handle}
            postMessage={postMessage}
            onResolved={onResolved}
          />
        )}
      </div>
    </div>
  );
}

function MethodTab({
  active, onClick, icon, title, sub, recommended,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-3 py-2.5 text-left transition-colors " +
        (active
          ? "border-primary/50 bg-primary/10"
          : "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.04]")
      }
    >
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
        {icon}
        {title}
        {recommended && (
          <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            Recommended
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Email-code (no-edit) flow                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function EmailCodeFlow({
  platform,
  handle,
  postMessage,
  onResolved,
  onSwitchToBio,
}: {
  platform: string;
  handle: string;
  postMessage?: ChatLike;
  onResolved?: (o: "verified" | "skipped" | "failed") => void;
  onSwitchToBio: () => void;
}) {
  const start = useServerFn(startEmailCodeVerification);
  const confirm = useServerFn(confirmEmailCodeVerification);

  const [phase, setPhase] = useState<"idle" | "sending" | "awaiting" | "checking" | "verified" | "no_email" | "error">("idle");
  const [verifId, setVerifId] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attemptsMsg, setAttemptsMsg] = useState<string | null>(null);

  const send = async () => {
    setPhase("sending");
    setError(null);
    setAttemptsMsg(null);
    try {
      const r = await start({ data: { platform, handle } });
      if ("rateLimited" in r && r.rateLimited) {
        setError(r.message);
        setPhase("error");
        return;
      }
      if ("unsupported" in r && r.unsupported) {
        setError(r.message);
        setPhase("error");
        return;
      }
      if ("noEmail" in r && r.noEmail) {
        setPhase("no_email");
        setError(r.message);
        postMessage?.(r.message);
        return;
      }
      if ("sendFailed" in r && r.sendFailed) {
        setError(r.message);
        setPhase("error");
        return;
      }
      if ("ok" in r && r.ok) {
        setVerifId(r.verificationId);
        setMask(r.emailMask);
        setPhase("awaiting");
        postMessage?.(`I sent a 6-digit code to ${r.emailMask}. Paste it here to verify.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
      setPhase("error");
    }
  };

  const doConfirm = async () => {
    if (!verifId) return;
    setPhase("checking");
    try {
      const r = await confirm({ data: { verificationId: verifId, code: code.trim() } });
      if (r.status === "verified") {
        setPhase("verified");
        postMessage?.(`Your ${platform} account is verified ✓`);
        onResolved?.("verified");
        return;
      }
      if (r.status === "expired") {
        setError("That code expired. Send a new one.");
        setPhase("awaiting");
        return;
      }
      if (r.status === "failed") {
        setError("Too many wrong attempts. Try again later or use the bio-code method.");
        setPhase("error");
        onResolved?.("failed");
        return;
      }
      const remaining = "attempts_remaining" in r ? r.attempts_remaining ?? 0 : 0;
      setAttemptsMsg(`That code didn't match. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`);
      setPhase("awaiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
      setPhase("awaiting");
    }
  };

  if (phase === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="text-[13px] font-semibold text-foreground">@{handle} verified</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        We'll read your public contact email straight from your {capitalize(platform)} profile and
        send you a 6-digit code. Nothing gets posted or edited on your account.
      </p>

      {phase === "idle" && (
        <button
          type="button"
          onClick={send}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90"
        >
          <Mail className="h-3.5 w-3.5" />
          Send code to my public email
        </button>
      )}

      {phase === "sending" && (
        <div className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
          Reading your profile and sending code…
        </div>
      )}

      {(phase === "awaiting" || phase === "checking") && (
        <>
          {mask && (
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-[12.5px] text-foreground">
              Code sent to <span className="font-semibold">{mask}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-40 rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-[16px] tracking-[0.35em] text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={phase === "checking" || code.length < 4}
              onClick={doConfirm}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {phase === "checking" && <RefreshCcw className="h-3.5 w-3.5 animate-spin" />}
              {phase === "checking" ? "Checking…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={send}
              className="rounded-full border border-foreground/10 px-3 py-2 text-[11.5px] font-medium text-muted-foreground hover:bg-foreground/[0.04]"
            >
              Resend
            </button>
          </div>
          {attemptsMsg && (
            <p className="text-[12px] text-amber-600">{attemptsMsg}</p>
          )}
        </>
      )}

      {phase === "no_email" && (
        <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
          <div className="flex items-start gap-2 text-[12.5px] text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              {error ?? "We couldn't find a public contact email on your profile."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              className="rounded-full bg-foreground/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-foreground/15"
            >
              I added an email — try again
            </button>
            <button
              type="button"
              onClick={onSwitchToBio}
              className="rounded-full border border-foreground/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground/80 hover:bg-foreground/5"
            >
              Use bio-code instead
            </button>
          </div>
        </div>
      )}

      {phase === "error" && error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[12.5px] text-foreground">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          {error}
          <button
            type="button"
            onClick={() => { setError(null); setPhase("idle"); }}
            className="ml-auto rounded-full bg-foreground/10 px-3 py-1 text-[11.5px] font-medium text-foreground hover:bg-foreground/15"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Original bio-code flow (unchanged behavior, restyled to light theme)      */
/* ────────────────────────────────────────────────────────────────────────── */

function BioCodeFlow({
  platform,
  handle,
  onResolved,
  postMessage,
}: {
  platform: string;
  handle: string;
  onResolved?: (o: "verified" | "skipped" | "failed") => void;
  postMessage?: ChatLike;
}) {
  const gen = useServerFn(generateVerificationCode);
  const check = useServerFn(checkVerification);
  const skip = useServerFn(skipVerification);
  const resend = useServerFn(resendVerificationCode);

  const [verif, setVerif] = useState<Verification | null>(null);
  const [phase, setPhase] = useState<
    "loading" | "active" | "checking" | "verified" | "expired" | "failed" | "skipped" | "unsupported"
  >("loading");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attemptsLeftMsg, setAttemptsLeftMsg] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      try {
        const r = await gen({ data: { platform, handle } });
        if ("rateLimited" in r && r.rateLimited) {
          setError(r.message); setPhase("failed"); return;
        }
        if ("unsupported" in r && r.unsupported) {
          setVerif(r.verification); setPhase("unsupported"); onResolved?.("skipped"); return;
        }
        if ("verification" in r && r.verification) {
          setVerif(r.verification); setPhase("active");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start verification");
        setPhase("failed");
      }
    })();
  }, [gen, platform, handle, onResolved]);

  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const remainingMs = verif ? new Date(verif.expires_at).getTime() - now : 0;
  const timerColor = useMemo(() => {
    const m = remainingMs / 60000;
    if (m < 1) return "text-rose-600";
    if (m < 3) return "text-amber-600";
    return "text-muted-foreground";
  }, [remainingMs]);

  const onCopy = async () => {
    if (!verif) return;
    try {
      await navigator.clipboard.writeText(verif.code);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const onCheck = async () => {
    if (!verif) return;
    setPhase("checking");
    try {
      const r = await check({ data: { verificationId: verif.id } });
      if (r.status === "verified") {
        setPhase("verified");
        postMessage?.(`Your ${platform} account is verified ✓`);
        onResolved?.("verified");
        return;
      }
      if (r.status === "expired") { setPhase("expired"); return; }
      if (r.status === "failed") {
        setPhase("failed"); onResolved?.("failed"); return;
      }
      const remaining = "attempts_remaining" in r ? r.attempts_remaining ?? 0 : 0;
      setAttemptsLeftMsg(`Not finding the code in your bio. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`);
      setPhase("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
      setPhase("active");
    }
  };

  const onResend = async () => {
    if (!verif) return;
    try {
      const r = await resend({ data: { platform, handle } });
      if ("rateLimited" in r && r.rateLimited) { setError(r.message); return; }
      if ("verification" in r && r.verification) {
        setVerif(r.verification); setPhase("active"); setAttemptsLeftMsg(null);
      }
    } catch { setError("Could not regenerate code"); }
  };

  const onConfirmSkip = async () => {
    if (!verif) return;
    try {
      await skip({ data: { verificationId: verif.id } });
      setPhase("skipped");
      onResolved?.("skipped");
    } catch { setError("Could not skip"); }
  };

  if (phase === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div className="text-[13px] font-semibold text-foreground">@{handle} verified</div>
      </div>
    );
  }

  if (phase === "skipped" || phase === "unsupported") {
    return (
      <div className="text-[13px] text-muted-foreground">
        {phase === "unsupported"
          ? "Verification isn't available for this platform yet."
          : "Verification skipped. You can verify anytime from Settings."}
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[13px] text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {error ?? "Verification unsuccessful"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onResend} className="rounded-full bg-foreground/10 px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-foreground/15">Try again</button>
          <button onClick={onConfirmSkip} className="rounded-full border border-foreground/10 px-3 py-1.5 text-[12px] font-medium text-foreground/80 hover:bg-foreground/5">Continue without verifying</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-[13px] text-muted-foreground">
        Paste this code anywhere in your {capitalize(platform)} bio, then tap "I added it". You can remove it right after.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={verif?.code ?? "loading"}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="font-mono text-[22px] font-bold tracking-[0.15em] text-foreground"
          >
            {phase === "expired" ? "Code expired" : verif?.code ?? "Loading…"}
          </motion.div>
        </AnimatePresence>
        <button
          disabled={!verif || phase === "expired"}
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-[11.5px] font-medium text-foreground hover:bg-foreground/15 disabled:opacity-50"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">@{handle} · {capitalize(platform)}</span>
        <span className={timerColor}>{phase === "expired" ? "00:00" : formatMMSS(remainingMs)} remaining</span>
      </div>
      {attemptsLeftMsg && <p className="mt-2 text-[12px] text-amber-600">{attemptsLeftMsg}</p>}

      {!confirmSkip ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            disabled={phase !== "active" || !verif}
            onClick={onCheck}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {phase === "checking" && <RefreshCcw className="h-3.5 w-3.5 animate-spin" />}
            {phase === "checking" ? "Checking…" : "I added it — verify me"}
          </button>
          <button
            disabled={phase !== "active"}
            onClick={onResend}
            className="rounded-full border border-foreground/10 px-3.5 py-2 text-[12px] font-medium text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
          >
            New code
          </button>
          <button
            onClick={() => setConfirmSkip(true)}
            className="ml-auto rounded-full px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            Skip for now →
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-[12.5px] text-foreground/80">
          Your profile will be marked as unverified. You can verify anytime from Settings.
          <div className="mt-3 flex gap-2">
            <button onClick={onConfirmSkip} className="rounded-full bg-foreground/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-foreground/15">Continue anyway</button>
            <button onClick={() => setConfirmSkip(false)} className="rounded-full border border-foreground/10 px-3 py-1.5 text-[11.5px] font-medium text-foreground/80 hover:bg-foreground/5">Go back</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11.5px] text-rose-600">{error}</p>}
    </>
  );
}

function capitalize(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
