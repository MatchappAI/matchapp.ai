import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  listSuppressions,
  addSuppression,
  removeSuppression,
  getComplianceSettings,
  updateComplianceSettings,
} from "@/lib/suppression.functions";

/** Do-not-contact list + CAN-SPAM physical address + unsubscribe footer toggle. */
export function ComplianceSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSuppressions);
  const addFn = useServerFn(addSuppression);
  const removeFn = useServerFn(removeSuppression);
  const getFn = useServerFn(getComplianceSettings);
  const updateFn = useServerFn(updateComplianceSettings);

  const list = useQuery({ queryKey: ["suppression"], queryFn: () => listFn({}) });
  const settings = useQuery({ queryKey: ["compliance"], queryFn: () => getFn({}) });

  const [address, setAddress] = useState("");
  const [footerOn, setFooterOn] = useState(true);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (settings.data) {
      setAddress(settings.data.physical_address ?? "");
      setFooterOn(settings.data.unsubscribe_footer_enabled !== false);
      setDirty(false);
    }
  }, [settings.data]);

  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: { physical_address: address.trim() || null, unsubscribe_footer_enabled: footerOn },
      }),
    onSuccess: () => {
      toast.success("Compliance settings saved.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { email: newEmail.trim(), reason: newReason.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Added to do-not-contact list.");
      setNewEmail("");
      setNewReason("");
      qc.invalidateQueries({ queryKey: ["suppression"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppression"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const entries = list.data?.entries ?? [];

  return (
    <div className="space-y-4">
      {/* Physical address + footer toggle — required for CAN-SPAM */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
          <div className="flex-1 space-y-1">
            <div className="text-sm font-medium text-foreground">Sender identity</div>
            <p className="text-xs text-muted-foreground">
              U.S. CAN-SPAM requires a real physical mailing address on every commercial email. We add it plus a one-click unsubscribe link to every send.
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Physical address (city + country is enough)</Label>
          <Input
            value={address}
            onChange={(e) => { setAddress(e.target.value); setDirty(true); }}
            placeholder="e.g. 500 Terry Francois, San Francisco, CA, USA"
            className="rounded-lg"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-foreground/[0.06] px-3 py-2">
          <div className="text-xs text-foreground">
            <div className="font-medium">Attach unsubscribe footer</div>
            <div className="text-muted-foreground">Recommended. Off only for pure conversational replies.</div>
          </div>
          <Switch checked={footerOn} onCheckedChange={(v) => { setFooterOn(v); setDirty(true); }} />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="rounded-lg"
            onClick={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
          >
            {saveMut.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </div>

      {/* Suppression list */}
      <div className="rounded-2xl border border-foreground/[0.06] overflow-hidden">
        <div className="border-b border-foreground/[0.06] px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Do-not-contact list</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Addresses here are blocked from every outbound send, including autopilot. Unsubscribes are added automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-foreground/[0.05] bg-foreground/[0.015] px-4 py-3">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@brand.com"
            className="h-9 flex-1 min-w-[220px] rounded-lg"
          />
          <Input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-9 flex-1 min-w-[180px] rounded-lg"
          />
          <Button
            size="sm"
            className="h-9 rounded-lg"
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || !newEmail.trim()}
          >
            {addMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
        {entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {list.isLoading ? "Loading…" : "No suppressed contacts yet."}
          </div>
        ) : (
          <ul className="divide-y divide-foreground/[0.05] max-h-72 overflow-auto">
            {entries.map((e: { id: string; email: string; reason: string | null }) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{e.email}</div>
                  {e.reason && <div className="truncate text-[11px] text-muted-foreground">{e.reason}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-muted-foreground hover:text-destructive"
                  onClick={() => removeMut.mutate(e.id)}
                  disabled={removeMut.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
