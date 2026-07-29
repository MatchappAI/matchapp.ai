import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createInternalOutreachDraft,
  createOutreachTarget,
  listCreatorDealOpportunities,
  listInternalOutreachTargets,
} from "@/lib/internal-outreach.functions";

export const Route = createFileRoute("/dashboard/admin/outreach")({
  head: () => ({ meta: [{ title: "Outreach — MatchAI" }] }),
  component: InternalOutreachPage,
});

function InternalOutreachPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInternalOutreachTargets);
  const createFn = useServerFn(createOutreachTarget);
  const draftFn = useServerFn(createInternalOutreachDraft);
  const dealsFn = useServerFn(listCreatorDealOpportunities);
  const [form, setForm] = useState({
    target_type: "contact",
    direction: "matchai_to_brand",
    display_name: "",
    company_name: "",
    email: "",
    notes: "",
  });

  const targetsQuery = useQuery({
    queryKey: ["internal-outreach"],
    queryFn: () => listFn({ data: {} as never }),
  });
  const dealsQuery = useQuery({
    queryKey: ["creator-deals"],
    queryFn: () => dealsFn({ data: {} as never }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          source_record_type: "manual",
          cc_addresses: [],
          bcc_addresses: [],
          reply_to_addresses: [],
          attachments: [],
          personalization_evidence: {},
          source_evidence: { notes: form.notes },
          contact_readiness: 60,
          confidence: 60,
          compliance_footer: true,
          status: "draft",
        },
      }),
    onSuccess: () => {
      toast.success("Outreach target saved");
      qc.invalidateQueries({ queryKey: ["internal-outreach"] });
      setForm({
        target_type: "contact",
        direction: "matchai_to_brand",
        display_name: "",
        company_name: "",
        email: "",
        notes: "",
      });
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const draftMut = useMutation({
    mutationFn: (input: {
      opportunity_id?: string;
      brand_match_id?: string;
      brand_name?: string;
      outreach_target_id?: string;
    }) => draftFn({ data: input }),
    onSuccess: () => {
      toast.success("Inbox draft created");
      qc.invalidateQueries({ queryKey: ["internal-outreach"] });
      qc.invalidateQueries({ queryKey: ["discovery-review"] });
      qc.invalidateQueries({ queryKey: ["email-threads"] });
    },
    onError: (error) => toast.error(String(error).replace("Error: ", "")),
  });

  const targets = targetsQuery.data?.outreach_targets ?? [];
  const opportunities = useMemo(
    () => dealsQuery.data?.opportunities ?? [],
    [dealsQuery.data?.opportunities],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-foreground/[0.06] bg-gradient-to-br from-card via-card to-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal Outreach
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">One outreach system</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Select a creator, brand, contact, opportunity, or campaign target. Create an internal
          inbox draft from the same canonical system that powers review, tracker, and inbox
          approval.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
          <h2 className="text-base font-semibold">Manual target</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Target type</span>
              <Input
                value={form.target_type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_type: event.target.value }))
                }
                placeholder="contact"
                className="rounded-xl"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Direction</span>
              <Input
                value={form.direction}
                onChange={(event) =>
                  setForm((current) => ({ ...current, direction: event.target.value }))
                }
                placeholder="matchai_to_brand"
                className="rounded-xl"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Display name</span>
              <Input
                value={form.display_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, display_name: event.target.value }))
                }
                placeholder="Acme Partnerships"
                className="rounded-xl"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Company</span>
              <Input
                value={form.company_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, company_name: event.target.value }))
                }
                placeholder="Acme"
                className="rounded-xl"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Email</span>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="partner@example.com"
                className="rounded-xl"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Notes</span>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Why this target matters"
                className="min-h-28 rounded-xl"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Save target
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-foreground/[0.06] bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Targets and opportunities</h2>
              <p className="text-xs text-muted-foreground">
                Create a draft from any approved target or from a high-fit opportunity.
              </p>
            </div>
          </div>

          {targetsQuery.isLoading || dealsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading outreach…
            </div>
          ) : (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Outreach targets
                </h3>
                {targets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No targets saved yet.</p>
                ) : (
                  <div className="space-y-2">
                    {targets.map((target: Record<string, unknown>) => (
                      <div
                        key={String(target.id)}
                        className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.03] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{String(target.display_name ?? "Target")}</p>
                            <p className="text-xs text-muted-foreground">
                              {String(target.target_type ?? "contact")} ·{" "}
                              {String(target.outreach_direction ?? "matchai_to_brand")}
                            </p>
                            {target.email && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {String(target.email)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              draftMut.mutate({ outreach_target_id: String(target.id) })
                            }
                            disabled={draftMut.isPending}
                            className="rounded-xl"
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Create draft
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Creator opportunities
                </h3>
                {opportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No opportunities yet. Complete onboarding or import buying intent.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {opportunities.slice(0, 8).map((opportunity: Record<string, unknown>) => (
                      <div
                        key={String(opportunity.id)}
                        className="rounded-2xl border border-foreground/[0.06] bg-background/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-medium">
                              {String(opportunity.brand_name ?? "Brand")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {String(
                                opportunity.opportunity_title ??
                                  opportunity.signal_summary ??
                                  "Opportunity",
                              )}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Fit {String(opportunity.fit_score ?? 0)} · Cash{" "}
                              {String(opportunity.cash_likelihood_score ?? 0)} · Fast pay{" "}
                              {String(opportunity.fast_pay_score ?? 0)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              draftMut.mutate(
                                opportunity.source_record_type === "brand_opportunity"
                                  ? { opportunity_id: String(opportunity.id) }
                                  : opportunity.brand_match_id
                                    ? { brand_match_id: String(opportunity.brand_match_id) }
                                    : { brand_name: String(opportunity.brand_name ?? "") },
                              )
                            }
                            disabled={draftMut.isPending}
                            className="rounded-xl"
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Create draft
                          </Button>
                        </div>
                        {(opportunity.why_now || opportunity.signal_summary) && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {String(opportunity.why_now ?? opportunity.signal_summary ?? "")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-foreground/[0.06] bg-foreground/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Review path</h2>
            <p className="text-xs text-muted-foreground">
              Approved items show up in Review Queue and the draft lands in Inbox before anything
              sends.
            </p>
          </div>
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/dashboard/discovery/review">Open Review Queue</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
