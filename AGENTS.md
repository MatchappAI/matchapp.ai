# MatchAI repository instructions

## Product boundaries

- Stripe is only for payments from MatchAI users to MatchAI, such as subscriptions.
- MatchAI does not provide escrow, wallets, payouts, Stripe Connect, success fees, or brand-to-creator payment processing.
- Brand-to-creator payments are external. Any payment status stored in MatchAI must be labeled creator-reported and externally handled.
- Do not delete legacy financial migrations blindly. Disable active product behavior and secure dormant tables after checking dependencies.
- No lead-generation, scraping, enrichment, contact-database, or email-verification provider is selected.
- The product must work with manual brand/contact entry and CSV import. Provider adapters must remain optional and return an honest “provider not configured” state.
- Gmail is the creator outreach and synchronized Inbox provider.
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
- Verify manual/CSV brands and contacts; Gmail connection; Inbox folders and threads; compose with To/CC/BCC; attachments; drafts; confirmation; send; Sent synchronization; inbound threading; chat summary/reply-all/recipient changes; search; filters; archive; unread state.
- Do not call the work complete while any tested flow has console, network, hydration, server, accessibility, or functional errors.

## Working rules

- Inspect the worktree before overlapping edits and preserve active user/agent changes.
- Do not reset, stash, discard, force-push, or overwrite unrelated work.
- Treat credentials previously visible in screenshots as compromised. Never reproduce them.
- Do not commit real environment files or secrets.
