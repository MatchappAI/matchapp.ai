# MatchAI repository instructions

## Product boundaries

- Stripe is only for payments from MatchAI users to MatchAI, such as subscriptions.
- MatchAI does not provide escrow, wallets, payouts, Stripe Connect, success fees, or brand-to-creator payment processing.
- Brand-to-creator payments are external. Any payment status stored in MatchAI must be labeled creator-reported and externally handled.
- Do not delete legacy financial migrations blindly. Disable active product behavior and secure dormant tables after checking dependencies.
- No lead-generation, scraping, enrichment, contact-database, or email-verification provider is selected.
- The product must work with manual brand/contact entry and CSV import. Provider adapters must remain optional and return an honest “provider not configured” state.
- Creators communicate through a full internal MatchAI email identity and Inbox.
- No creator-email delivery/synchronization API provider has been selected. Keep transport behind an adapter and show “provider not configured” until one is selected.
- Resend is only for MatchAI transactional/product email.
- Inbox UI and MatchAI chat must use one authoritative server-side email/thread model and the same actions.

## Confirmation and integrity

- Read-only Inbox actions may run immediately.
- Sending, replying, forwarding, recipient changes, discarding drafts, deleting/archiving, accepting negotiation terms, or materially changing deals require explicit creator confirmation.
- Confirmation must display From, To, CC, BCC, subject, final body, attachments, associated brand/contact/deal, and the exact action.
- Approved actions must execute exactly once using idempotency and must create an audit record.
- Never fabricate sent, delivered, synchronized, or provider state.
- Preserve BCC privacy.

## `/frontend`

When the user says `/frontend`, deliver a production-ready end-to-end frontend pass rather than a visual-only change:

- Implement every relevant user journey, button, state transition, AI action, and integration handoff.
- Test with real mouse/keyboard browser interaction.
- Cover desktop, mobile, keyboard navigation, and accessibility.
- Verify loading, empty, error, retry, expired OAuth, reconnect, duplicate prevention, and exactly-once behavior.
- Verify manual/CSV brands and contacts; internal MatchAI email identity; Inbox folders and threads; compose with To/CC/BCC; attachments; drafts; confirmation; honest unconfigured transport; eventual Sent synchronization; inbound threading; chat summary/reply-all/recipient changes; search; filters; archive; unread state.
- Do not call the work complete while any tested flow has console, network, hydration, server, accessibility, or functional errors.
- Discover and account for every route-level control, including buttons, links, menus, tabs, forms, dialogs, filters, searches, keyboard actions, chat cards, empty states, and retry actions.
- Maintain `docs/FRONTEND_E2E_ACCEPTANCE.md` with a route-by-route interaction matrix covering start state, action, UI result, server/provider effect, confirmation, success, failure/retry, refresh persistence, mobile, and keyboard behavior.
- Verify journeys through the rendered application with real mouse and keyboard interaction; source inspection and API-only checks do not count as frontend acceptance.
- Mutations must validate inputs, require the correct confirmation, expose loading/disabled states, execute exactly once with idempotency and audit, persist after refresh, and fail with an understandable retry path.
- AI acceptance requires real context loading and generation, editable structured output, exact confirmation, exactly-once execution, cancellation with no effect, and honest provider failures.
- Add durable automated browser coverage that asserts outcomes, persistence, and exactly-once behavior.
- `/frontend` is complete only after every interaction is accounted for, no critical behavior is mocked or missing, build/type-check/targeted lint/E2E pass, and the final browser pass is clean.

## Working rules

- Inspect the worktree before overlapping edits and preserve active user/agent changes.
- Do not reset, stash, discard, force-push, or overwrite unrelated work.
- Treat credentials previously visible in screenshots as compromised. Never reproduce them.
- Do not commit real environment files or secrets.
