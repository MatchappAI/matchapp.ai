import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  loadSetup,
  saveSetup,
  computeSetupSteps,
  type CreatorSetup,
  type PortfolioItem,
  type PortfolioMedia,
  type BrandAsset,
} from "@/lib/creator-setup";
import { CheckCircle2, Circle, Plus, Trash2, Sparkles, Upload, ImageIcon, PlayCircle, X, FileText } from "lucide-react";
import { toast } from "sonner";


const NICHE_SUGGESTIONS = [
  "Clean Beauty", "Skincare", "Haircare", "Makeup", "Fragrance",
  "Streetwear", "Athleisure", "Sustainable Fashion", "Accessories", "Jewelry",
];
const VALUE_SUGGESTIONS = [
  "Cruelty-free", "Vegan", "Sustainable", "Female-founded", "Small-batch", "BIPOC-owned",
];

export function CreatorSetupSection() {
  const [setup, setSetup] = useState<CreatorSetup>(() => loadSetup());
  useEffect(() => {
    const on = () => setSetup(loadSetup());
    window.addEventListener("matchai:setup-updated", on);
    return () => window.removeEventListener("matchai:setup-updated", on);
  }, []);

  function patch(mut: (s: CreatorSetup) => CreatorSetup) {
    setSetup((prev) => {
      const next = mut(prev);
      saveSetup(next);
      return next;
    });
  }

  const steps = computeSetupSteps(setup);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Creator setup</h2>
            <p className="text-sm text-muted-foreground mt-1">
              One-time configuration. Your agent uses this to find and negotiate deals — you'll rarely touch it again.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{done}/{steps.length}</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {steps.map((s) => (
            <a
              key={s.label}
              href={`#setup-${s.key}`}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors"
            >
              {s.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
            </a>
          ))}
        </div>
      </Card>

      {/* Brand kit */}
      <Card id="setup-brandKit" className="p-6 space-y-4">
        <SectionHeader title="Brand kit" subtitle="Who you are and what you stand for. Powers every outreach." />
        <div className="grid gap-4">
          <div>
            <Label>Bio</Label>
            <Textarea
              value={setup.brandKit.bio}
              onChange={(e) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, bio: e.target.value } }))}
              placeholder="e.g. Micro-influencer focused on clean skincare for sensitive skin — 42k IG, honest reviews, avg 6.1% ER."
              rows={3}
            />
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const generated = "Micro-creator in clean beauty & skincare. Community of 40k+ trusts me for honest, side-by-side product tests. Warm, editorial voice with a focus on ingredient transparency.";
                  patch((s) => ({ ...s, brandKit: { ...s.brandKit, bio: generated } }));
                  toast.success("AI draft filled in — edit to match your voice");
                }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI draft
              </Button>
            </div>
          </div>

          <div>
            <Label>Niches</Label>
            <ChipMultiSelect
              suggestions={NICHE_SUGGESTIONS}
              value={setup.brandKit.niches}
              onChange={(v) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, niches: v } }))}
            />
          </div>

          <div>
            <Label>Values</Label>
            <ChipMultiSelect
              suggestions={VALUE_SUGGESTIONS}
              value={setup.brandKit.values}
              onChange={(v) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, values: v } }))}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Voice / tone</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={setup.brandKit.tone}
                onChange={(e) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, tone: e.target.value as CreatorSetup["brandKit"]["tone"] } }))}
              >
                <option value="">Select a tone…</option>
                <option>Warm & personal</option>
                <option>Editorial</option>
                <option>Playful</option>
                <option>Direct & pro</option>
              </select>
            </div>
            <div>
              <Label>Aesthetic (visual description)</Label>
              <Input
                value={setup.brandKit.aesthetic}
                onChange={(e) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, aesthetic: e.target.value } }))}
                placeholder="e.g. Warm neutrals, natural light, minimal props"
              />
            </div>
          </div>

          <div>
            <Label>Logo / mark (optional)</Label>
            <div className="flex items-center gap-3 mt-1">
              {setup.brandKit.logoDataUrl && (
                <img src={setup.brandKit.logoDataUrl} alt="Logo" className="w-12 h-12 rounded-md object-cover border border-border" />
              )}
              <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-input cursor-pointer hover:bg-muted">
                <Upload className="w-4 h-4" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      patch((s) => ({ ...s, brandKit: { ...s.brandKit, logoDataUrl: String(reader.result) } }));
                    };
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <Label>Moodboard / reference images (optional)</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add a few aesthetic references. Brands see these attached to your pitch.
            </p>
            <MediaUploader
              accept="image/*"
              multiple
              items={setup.brandKit.moodboard ?? []}
              onChange={(next) => patch((s) => ({ ...s, brandKit: { ...s.brandKit, moodboard: next as BrandAsset[] } }))}
              kindHint="image"
            />
          </div>
        </div>
      </Card>


      {/* Rates */}
      <Card id="setup-rates" className="p-6 space-y-4">
        <SectionHeader title="Rates" subtitle="Your baseline pricing. The agent negotiates within ±20% unless you say otherwise." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <RateField label="Instagram post ($)" value={setup.rates.ig_post} onChange={(v) => patch((s) => ({ ...s, rates: { ...s.rates, ig_post: v } }))} />
          <RateField label="Instagram Reel ($)" value={setup.rates.ig_reel} onChange={(v) => patch((s) => ({ ...s, rates: { ...s.rates, ig_reel: v } }))} />
          <RateField label="Instagram Story ($)" value={setup.rates.ig_story} onChange={(v) => patch((s) => ({ ...s, rates: { ...s.rates, ig_story: v } }))} />
          <RateField label="TikTok video ($)" value={setup.rates.tiktok} onChange={(v) => patch((s) => ({ ...s, rates: { ...s.rates, tiktok: v } }))} />
          <RateField label="UGC video ($)" value={setup.rates.ugc_video} onChange={(v) => patch((s) => ({ ...s, rates: { ...s.rates, ugc_video: v } }))} />
        </div>
        <div>
          <Label>Bundle notes (optional)</Label>
          <Input
            value={setup.rates.bundle_note ?? ""}
            onChange={(e) => patch((s) => ({ ...s, rates: { ...s.rates, bundle_note: e.target.value } }))}
            placeholder="e.g. Reel + 3 stories bundle = $1,200"
          />
        </div>
      </Card>

      {/* Portfolio */}
      <Card id="setup-portfolio" className="p-6 space-y-4">
        <SectionHeader title="Portfolio" subtitle="Past work + real numbers. Attached to every outreach automatically." />
        <PortfolioEditor
          items={setup.portfolio}
          onChange={(items) => patch((s) => ({ ...s, portfolio: items }))}
        />
      </Card>

      {/* Usage rights */}
      <Card id="setup-usageRights" className="p-6 space-y-4">
        <SectionHeader title="Usage rights defaults" subtitle="What brands get by default. The agent quotes uplifts when they ask for more." />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Organic usage (days)</Label>
            <Input
              type="number"
              value={setup.usageRights.organicDays}
              onChange={(e) => patch((s) => ({ ...s, usageRights: { ...s.usageRights, organicDays: Number(e.target.value) || 0 } }))}
            />
          </div>
          <div>
            <Label>Paid amplification (days)</Label>
            <Input
              type="number"
              value={setup.usageRights.paidAmplificationDays}
              onChange={(e) => patch((s) => ({ ...s, usageRights: { ...s.usageRights, paidAmplificationDays: Number(e.target.value) || 0 } }))}
            />
          </div>
          <div>
            <Label>Category exclusivity (days)</Label>
            <Input
              type="number"
              value={setup.usageRights.exclusivityDays}
              onChange={(e) => patch((s) => ({ ...s, usageRights: { ...s.usageRights, exclusivityDays: Number(e.target.value) || 0 } }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Allow whitelisting</div>
              <div className="text-xs text-muted-foreground">Brand can boost your posts from their handle</div>
            </div>
            <Switch
              checked={setup.usageRights.whitelistingAllowed}
              onCheckedChange={(v) => patch((s) => ({ ...s, usageRights: { ...s.usageRights, whitelistingAllowed: v } }))}
            />
          </div>
        </div>
      </Card>

      {/* Shipping */}
      <Card id="setup-shipping" className="p-6 space-y-4">
        <SectionHeader title="Shipping address" subtitle="For gifted product. Only shared with brands you've accepted." />
        <ShippingEditor
          value={setup.shipping}
          onChange={(v) => patch((s) => ({ ...s, shipping: v }))}
        />
      </Card>

      {/* Exclusions */}
      <Card id="setup-exclusions" className="p-6 space-y-4">
        <SectionHeader title="Exclusions" subtitle="Brands or categories the agent should never pitch." />
        <ChipMultiSelect
          suggestions={["Fast fashion", "Diet products", "Gambling", "Alcohol", "Crypto"]}
          value={setup.exclusions}
          onChange={(v) => patch((s) => ({ ...s, exclusions: v }))}
        />
      </Card>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function RateField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        placeholder="0"
      />
    </div>
  );
}

function ChipMultiSelect({
  suggestions,
  value,
  onChange,
}: {
  suggestions: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  function addCustom() {
    const v = input.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput("");
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => toggle(v)}>
            {v} ×
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted"
            onClick={() => toggle(s)}
          >
            + {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add custom…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addCustom(); }
          }}
        />
        <Button type="button" variant="outline" onClick={addCustom}>Add</Button>
      </div>
    </div>
  );
}

function PortfolioEditor({
  items,
  onChange,
}: {
  items: PortfolioItem[];
  onChange: (items: PortfolioItem[]) => void;
}) {
  const [draft, setDraft] = useState<Partial<PortfolioItem>>({ platform: "Instagram", media: [] });
  function add() {
    const hasMedia = (draft.media?.length ?? 0) > 0;
    if (!draft.brand || (!draft.url && !hasMedia)) {
      toast.error("Add a brand + a link or uploaded media");
      return;
    }
    const item: PortfolioItem = {
      id: crypto.randomUUID(),
      brand: draft.brand!,
      platform: (draft.platform as PortfolioItem["platform"]) || "Instagram",
      url: draft.url ?? "",
      metric: draft.metric ?? "",
      notes: draft.notes,
      media: draft.media ?? [],
    };
    onChange([item, ...items]);
    setDraft({ platform: "Instagram", media: [] });
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <Label className="text-xs">Brand</Label>
          <Input value={draft.brand ?? ""} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="Glossier" />
        </div>
        <div>
          <Label className="text-xs">Platform</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.platform ?? "Instagram"}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value as PortfolioItem["platform"] })}
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>UGC</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Link <span className="text-muted-foreground">(optional if uploading)</span></Label>
          <Input value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <Label className="text-xs">Metric</Label>
          <Input value={draft.metric ?? ""} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} placeholder="142k views · 8.4% ER" />
        </div>
        <div className="lg:col-span-4">
          <Label className="text-xs">Upload screenshots, clips, decks or docs</Label>
          <MediaUploader
            accept="image/*,video/*,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/csv,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt,.key,.pages,.numbers"
            multiple
            items={draft.media ?? []}
            onChange={(next) => setDraft({ ...draft, media: next as PortfolioMedia[] })}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Media kits, case-study decks, screenshots — anything you'd send a brand. Selectable when drafting emails.
          </p>
        </div>

        <div className="lg:col-span-4">
          <Button type="button" onClick={add} variant="outline"><Plus className="w-4 h-4 mr-1.5" /> Add item</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
          No portfolio items yet. Add at least one to strengthen outreach.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-3 p-3 rounded-md border border-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{it.brand} <span className="text-xs text-muted-foreground">· {it.platform}</span></div>
                {it.url && <div className="text-xs text-muted-foreground truncate">{it.url}</div>}
                {it.metric && <div className="text-xs text-foreground mt-0.5">{it.metric}</div>}
                {it.media && it.media.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {it.media.map((m) => (
                      <div key={m.id} className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-muted">
                        {m.kind === "video" ? (
                          <div className="w-full h-full grid place-items-center bg-black/80 text-white">
                            <PlayCircle className="w-6 h-6" />
                          </div>
                        ) : (
                          <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaUploader({
  items,
  onChange,
  accept,
  multiple,
  kindHint,
}: {
  items: Array<PortfolioMedia | BrandAsset>;
  onChange: (next: Array<PortfolioMedia | BrandAsset>) => void;
  accept: string;
  multiple?: boolean;
  kindHint?: "image";
}) {
  const MAX_BYTES = 8 * 1024 * 1024; // 8MB per file — decks/PDFs can be chunky

  function detectKind(f: File): "image" | "video" | "document" {
    if (f.type.startsWith("image/")) return "image";
    if (f.type.startsWith("video/")) return "video";
    return "document";
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    let processed = 0;
    const added: Array<PortfolioMedia | BrandAsset> = [];
    arr.forEach((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is too large (max 8MB)`);
        processed++;
        if (processed === arr.length && added.length) onChange([...items, ...added]);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const kind = kindHint ?? detectKind(f);
        added.push({
          id: crypto.randomUUID(),
          name: f.name,
          dataUrl: String(reader.result),
          kind,
          mime: f.type || undefined,
          sizeBytes: f.size,
        } as PortfolioMedia | BrandAsset);
        processed++;
        if (processed === arr.length) onChange([...items, ...added]);
      };
      reader.readAsDataURL(f);
    });
  }

  return (
    <div className="mt-1 space-y-2">
      <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-input cursor-pointer hover:bg-muted">
        <Upload className="w-4 h-4" />
        {items.length ? "Add more" : "Upload files"}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((m) => {
            const isDoc = m.kind === "document";
            const isVideo = m.kind === "video";
            return (
              <div
                key={m.id}
                className={`relative group rounded-md overflow-hidden border border-border bg-muted ${isDoc ? "w-40 h-20 flex items-center px-2 gap-2" : "w-20 h-20"}`}
                title={m.name}
              >
                {isVideo ? (
                  <div className="w-full h-full grid place-items-center bg-black/80 text-white">
                    <PlayCircle className="w-7 h-7" />
                  </div>
                ) : isDoc ? (
                  <>
                    <FileText className="w-6 h-6 shrink-0 text-primary" />
                    <span className="text-[11px] leading-tight truncate">{m.name}</span>
                  </>
                ) : (
                  <img src={m.dataUrl} alt={m.name} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  className="absolute top-0.5 right-0.5 h-5 w-5 grid place-items-center rounded-full bg-background/90 border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onChange(items.filter((x) => x.id !== m.id))}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" /> Up to 8MB per file. Stored on your device.
        </p>
      )}
    </div>
  );
}




function ShippingEditor({
  value,
  onChange,
}: {
  value: CreatorSetup["shipping"];
  onChange: (v: CreatorSetup["shipping"]) => void;
}) {
  const s = value ?? { fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "US" };
  function set<K extends keyof NonNullable<CreatorSetup["shipping"]>>(k: K, v: string) {
    onChange({ ...s, [k]: v });
  }
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2"><Label>Full name</Label><Input value={s.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Address</Label><Input value={s.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Address 2</Label><Input value={s.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} /></div>
      <div><Label>City</Label><Input value={s.city} onChange={(e) => set("city", e.target.value)} /></div>
      <div><Label>State</Label><Input value={s.state} onChange={(e) => set("state", e.target.value)} /></div>
      <div><Label>Postal code</Label><Input value={s.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></div>
      <div><Label>Country</Label><Input value={s.country} onChange={(e) => set("country", e.target.value)} /></div>
    </div>
  );
}
