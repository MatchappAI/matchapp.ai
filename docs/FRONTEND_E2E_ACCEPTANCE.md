# MatchAI frontend E2E acceptance

Status: in progress on `codex/lovable-exit-inbox-scope`.

Scope update: this pass consolidated the creator-first surface around Deals,
Inbox, Tracker, Tools, and Settings while keeping the existing inbox,
onboarding, brand-match, approvals, and deal architecture intact.

This document is the durable `/frontend` completion record. A route is not
accepted from source inspection alone; every critical journey must be exercised
through the rendered application with mouse and keyboard input.

## Interaction matrix

| Route / state                                       | User action                                                               | Expected UI result                                                       | Expected server / database / provider action                                                                    | Confirmation                                                   | Success persistence                                          | Error / retry                                                | Mobile / keyboard                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `/`, landing                                        | Read hero and click main CTA                                              | Creator-first outcome copy and Find Paid Brand Deals CTA                 | No mutation                                                                                                     | No                                                             | CTA persists after reload                                    | Honest auth redirect or missing provider states             | Keyboard focus visible; responsive CTA                           |
| `/dashboard/deals`, populated                        | Review match score, provenance, pitch angle, status, next action         | Brands read as source of opportunities; deals read as pipeline           | Reads existing brand-match and deal data                                                                        | Pursue / outreach still routes through confirmation surfaces   | Deal/provenance state persists                                | Empty / demo / partial data are labeled honestly            | Cards, actions, and links keyboard accessible                     |
| `/dashboard/inbox`, provider unconfigured           | Open Inbox                                                                | Internal MatchAI address and honest provider-not-configured state appear | No external provider call                                                                                       | No                                                             | Draft/local state survives reload                            | Transport setup state is explicit; no reconnect claim        | CTA/status labeled and keyboard accessible                        |
| `/dashboard/inbox`, configured later                | Synchronize                                                               | Loading indicator, then real folders/threads                             | Selected transport adapter reads; upserts authoritative threads/messages/attachments                            | No                                                             | Synced data survives reload                                  | Partial sync and reconnect states are explicit and retryable | Button named; responsive list                                     |
| `/dashboard/inbox`, list                            | Search/filter/sort/select/mark read                                       | Thread list and detail update                                            | Local query; selected provider modifies state when configured                                                   | No                                                             | Folder/read state survives reload and re-sync                | Failed load/modify shows retry/error                         | Mobile back control; keyboard focus order                         |
| `/dashboard/inbox`, compose                         | Enter To/CC/BCC/Reply-To/body, attach, save draft                         | Draft remains editable                                                   | Insert/update `email_drafts` and attachment records                                                             | No send                                                        | Draft survives reload (pending final Drafts-folder coverage) | Validation and attachment limits visible                     | All fields labeled; keyboard operable                             |
| `/dashboard/inbox`, compose/reply/reply-all/forward | Review exact message                                                      | Confirmation shows exact action and all final fields                     | Insert idempotent pending `email_action_requests`                                                               | Required                                                       | Pending request recorded                                     | Preparation failure leaves draft editable                    | Alert dialog labeled; focus behavior pending browser verification |
| `/dashboard/inbox`, confirmation                    | Cancel                                                                    | Dialog closes; nothing sends                                             | No provider mutation                                                                                            | Cancel is final                                                | Draft remains                                                | N/A                                                          | Escape/focus trap pending browser verification                    |
| `/dashboard/inbox`, confirmation                    | Confirm once / double-click                                               | One provider send and one audit entry, or honest unconfigured error      | Atomic claim; selected transport only; completed request and `agent_audit_log` after confirmed provider success | Required                                                       | Sent/thread state survives refresh and sync                  | Missing/failed provider never becomes fake success           | Disabled loading state                                            |
| `/dashboard/inbox`, thread                          | Archive or trash                                                          | Exact action confirmation, then folder changes                           | Idempotent provider change and audit when configured                                                            | Required                                                       | Folder survives reload/re-sync                               | Provider failure leaves original folder                      | Controls named and keyboard reachable                             |
| `/dashboard/tracker`                                 | Review follow-up queue and deal status                                    | Status/control view for brand → inbox → deal progression                 | Reads existing deal/thread/reply data                                                                           | Follow-up/reply actions still confirm when mutating             | Status remains after refresh                                 | Partial sync and missing provider are stated honestly        | Keyboard accessible rows and action buttons                        |
| `/dashboard/tools`                                   | Run Deal Checker / Rate Helper / reply / counteroffer tools              | Tool surfaces expose risk, range, and draft assistance                   | Reuse existing deal-check and pricing logic                                                                     | Signup required for full deal check; mutating actions confirm  | Tool results persist where backed by data                    | Demo teaser or provider-not-configured is explicit           | Cards and buttons keyboard accessible                             |
| `/dashboard/settings`                               | Manage subscription / creator email                                       | Correct billing, internal identity, and transport state                  | Stripe subscription only; creator email provider remains adapter-driven                                         | Provider confirmation where applicable                         | State survives reload                                        | Honest missing provider/retry                                | Pending browser verification                                      |
| MatchAI chat                                        | Search/summarize Inbox; draft reply/reply-all; change recipients; archive | Uses same authoritative email/thread records and confirmation snapshots  | Same internal Inbox server actions                                                                              | Required for external/mutating actions                         | Action/audit survives reload                                 | Provider/AI errors never render success                      | Pending implementation and browser verification                   |

## Automated browser coverage

Framework selection and tests are implemented with Playwright. Current coverage:

- landing page hero and keyboard CTA;
- mobile public menu and auth redirect;
- auth form mode toggles;
- protected dashboard redirect when unauthenticated.

Latest result:

- `npm run test:e2e -- tests/e2e/frontend-smoke.spec.ts` passed on desktop and
  mobile Chromium projects after a mobile-nav selector fix.

Critical test cases still to be added for the consolidated creator-first surface:

- manual brand and contact creation with duplicate validation and refresh;
- CSV validation preview, deduplication, import provenance, and refresh;
- unconfigured, expired/revoked (provider-dependent), and failed transport states;
- compose with CC/BCC, attachment, save draft, cancel confirmation;
- exactly-once confirmed send and persisted Sent synchronization;
- inbound thread, reply-all recipient calculation, search, archive, and unread;
- chat summary/draft/confirmation using the same Inbox records;
- desktop and mobile layouts plus keyboard-only operation.

## Verification evidence

- TypeScript / production build: passed on the current consolidation pass.
- Targeted formatter pass on the touched creator-first files: completed.
- Repository credential-pattern scan: no matching committed secret values.
- Targeted lint on the touched creator-first files: passed.
- Playwright smoke suite on the touched public funnels: passed.
- Rendered browser pass: the browser runtime reported no available browser during
  the latest local attempt; this gate remains open.

## External blockers

- The creator-email delivery/synchronization API still needs the owner to pick
  the external transport/provider that will back real sending and sync.
- Stripe subscription verification still requires rotated test-mode credentials
  and a test webhook endpoint.
- No lead provider is selected by product decision. The expected product state
  is manual/CSV with an honest provider-not-configured response.
- A production-ready database and service-role credentials are required for
  authenticated end-to-end browser tests of Inbox, Deals, Tracker, and Tools.
- Production hosting, DNS, deploy credentials, and owner-controlled external
  service dashboards must be available before the live-site gate can pass.

## Production acceptance

Completion additionally requires:

- a fresh clone installation, build, migration, and deploy;
- integration reconciliation across code, docs, environment examples,
  screenshots, handoff inventory, OAuth callbacks, webhooks, and scheduled jobs;
- deployment of the verified commit to the actual production domain;
- proof that the live site serves that commit rather than a stale or cached build;
- desktop and mobile live-browser coverage of every critical journey;
- clean live console, network, hydration, and server logs;
- refresh, back/forward, persistence, provider-failure, and retry checks on
  production.
