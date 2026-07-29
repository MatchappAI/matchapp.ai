import { useEffect, useMemo, useState } from "react";
import { Paperclip, FileText, ImageIcon, PlayCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadSetup,
  listAttachableMedia,
  type PickableAttachment,
} from "@/lib/creator-setup";
import { toast } from "sonner";

export type Attachment = {
  id: string;
  name: string;
  dataUrl: string;
  mime?: string;
  kind: "image" | "video" | "document";
  sizeBytes?: number;
};

type Props = {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  /** Optional key that AgentSuggestedAttachments card broadcasts to preselect items. */
  suggestionsChannel?: string;
};

/**
 * Attachment picker used from the email/reply compose window.
 * Lets the creator pull anything they've uploaded to Portfolio — screenshots,
 * clips, media kits, decks, PDFs, docs — straight into the draft.
 *
 * Also listens for `matchai:suggest-attachments` events so the chat agent can
 * pre-select items and the creator sees them auto-attached in the compose UI.
 */
export function AttachmentPicker({ value, onChange, suggestionsChannel }: Props) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<PickableAttachment[]>([]);

  const refresh = () => setPool(listAttachableMedia(loadSetup()));

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("matchai:setup-updated", handler);
    return () => window.removeEventListener("matchai:setup-updated", handler);
  }, []);

  // Agent-suggested preselect: adds any not-yet-attached items and pops the picker.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { channel?: string; ids?: string[]; names?: string[] }
        | undefined;
      if (!detail) return;
      if (suggestionsChannel && detail.channel && detail.channel !== suggestionsChannel) return;
      const latest = listAttachableMedia(loadSetup());
      setPool(latest);
      const wantIds = new Set(detail.ids ?? []);
      const wantNames = new Set((detail.names ?? []).map((n) => n.toLowerCase()));
      const picks = latest.filter(
        (m) => wantIds.has(m.id) || wantNames.has(m.name.toLowerCase()),
      );
      if (!picks.length) {
        toast.info("MatchAI suggested attachments but they aren't in your portfolio yet.");
        return;
      }
      const existing = new Set(value.map((v) => v.id));
      const merged = [...value];
      for (const p of picks) {
        if (existing.has(p.id)) continue;
        merged.push({
          id: p.id,
          name: p.name,
          dataUrl: p.dataUrl,
          mime: p.mime,
          kind: p.kind,
          sizeBytes: p.sizeBytes,
        });
      }
      onChange(merged);
      setOpen(true);
      toast.success(`MatchAI attached ${picks.length} file${picks.length > 1 ? "s" : ""}.`);
    };
    window.addEventListener("matchai:suggest-attachments", handler as EventListener);
    return () => window.removeEventListener("matchai:suggest-attachments", handler as EventListener);
  }, [onChange, value, suggestionsChannel]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  function toggle(m: PickableAttachment) {
    if (selectedIds.has(m.id)) {
      onChange(value.filter((v) => v.id !== m.id));
    } else {
      onChange([
        ...value,
        { id: m.id, name: m.name, dataUrl: m.dataUrl, mime: m.mime, kind: m.kind, sizeBytes: m.sizeBytes },
      ]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => setOpen((v) => !v)}
        >
          <Paperclip className="h-4 w-4 mr-1.5" />
          {value.length ? `Attachments (${value.length})` : "Attach from portfolio"}
        </Button>
        {value.length > 0 && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((a) => (
            <AttachmentChip key={a.id} a={a} onRemove={() => onChange(value.filter((x) => x.id !== a.id))} />
          ))}
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="break-words text-xs uppercase tracking-wider text-muted-foreground">
              Your portfolio ({pool.length})
            </p>
            <a
              href="/dashboard/settings#creator-setup"
              className="break-words text-[11px] text-primary hover:underline"
            >
              Manage portfolio
            </a>
          </div>
          {pool.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing uploaded yet. Add screenshots, clips, media kits or decks in Settings → Creator setup.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {pool.map((m) => {
                const picked = selectedIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m)}
                    className={`flex min-w-0 items-start gap-2 rounded-lg border p-2 text-left transition-colors ${picked ? "border-primary bg-primary/10" : "border-border bg-foreground/[0.02] hover:bg-foreground/[0.05]"}`}
                    title={`${m.brand} · ${m.platform}`}
                  >
                    <MediaThumb a={m} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[11px] font-medium">{m.name}</p>
                      <p className="break-words text-[10px] text-muted-foreground">
                        {m.brand} · {m.platform}
                      </p>
                    </div>
                    {picked && <span className="text-[10px] text-primary shrink-0">Added</span>}
                  </button>
                );
              })}
            </div>
          )}
          <p className="inline-flex items-start gap-1 break-words text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0" /> Ask MatchAI in chat to suggest attachments for you.
          </p>
        </div>
      )}
    </div>
  );
}

function MediaThumb({ a }: { a: PickableAttachment | Attachment }) {
  if (a.kind === "video") {
    return (
      <div className="h-9 w-9 shrink-0 rounded-md bg-black/80 grid place-items-center text-white">
        <PlayCircle className="h-4 w-4" />
      </div>
    );
  }
  if (a.kind === "document") {
    return (
      <div className="h-9 w-9 shrink-0 rounded-md bg-primary/15 grid place-items-center text-primary">
        <FileText className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={a.dataUrl}
      alt={a.name}
      className="h-9 w-9 shrink-0 rounded-md object-cover"
    />
  );
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  const Icon = a.kind === "document" ? FileText : a.kind === "video" ? PlayCircle : ImageIcon;
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-full border border-border bg-foreground/[0.04] py-1 pl-2 pr-1 text-[11px]">
      <Icon className="h-3 w-3 shrink-0 text-primary" />
      <span className="min-w-0 break-words">{a.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="h-4 w-4 grid place-items-center rounded-full hover:bg-foreground/10"
        aria-label={`Remove ${a.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
