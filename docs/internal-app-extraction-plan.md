# Internal App Extraction Plan

This repository keeps the public site, creator product, and internal
operations UI in one production codebase. Graphical admin tools stay inside
`matchapp.ai`; `matchai-ops` is only for scripts, runbooks, and utilities.

## Current Internal Route Locations

- `/dashboard/admin`
- `/admin` should be treated as the future canonical naming convention if
  route aliases are introduced, but the current production routes remain under
  `/dashboard/admin` and `/dashboard/discovery`.
- `/dashboard/admin/import`
- `/dashboard/admin/outreach`
- `/dashboard/discovery`
- `/dashboard/discovery/creator`
- `/dashboard/discovery/review`

## Current Internal Component Locations

- `src/routes/dashboard.admin.tsx`
- `src/routes/dashboard.admin.import.tsx`
- `src/routes/dashboard.admin.outreach.tsx`
- `src/routes/dashboard.discovery.tsx`
- `src/routes/dashboard.discovery.creator.tsx`
- `src/routes/dashboard.discovery.review.tsx`
- `src/lib/internal-outreach.functions.ts`
- `src/lib/discovery-engine.functions.ts`
- `src/lib/brand-library.functions.ts`
- `src/lib/matchai.functions.ts`
- `src/components/dashboard/*`

## Shared Dependencies

- `src/lib/utils.ts`
- `src/lib/agent-highlight.ts`
- `src/lib/matchai.functions.ts`
- `src/lib/discovery-engine.functions.ts`
- `src/lib/internal-outreach.functions.ts`
- `src/lib/brand-library.functions.ts`
- `src/lib/brand-contacts.functions.ts`
- `src/lib/inbox.functions.ts`
- `src/lib/email-inbox.functions.ts`

## APIs Used

- TanStack Start server functions under `src/lib/*`
- TanStack Router route loaders and route components under `src/routes/*`
- Supabase server client in `src/integrations/supabase/client.server.ts`
- Supabase auth middleware in `src/integrations/supabase/auth-middleware.ts`

## Authentication Requirements

- Internal routes must remain server-gated.
- Creator routes must not import internal UI or internal-only server helpers.
- Role checks should continue to happen on the server, not only in the UI.
- Anonymous users must not be able to call privileged internal server functions.

## Environment Variables

Existing internal flows currently rely on:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Future provider adapters may add additional secrets, but no new secrets should be
introduced unless they are required and documented.

## Database Dependencies

Internal flows currently touch shared discovery and outreach records rather than
dedicated internal-only tables. Any future split should preserve the canonical
tables and avoid duplicating migrations in the extracted repo.

## Future Extraction Process

1. Freeze the shared backend contract in `matchapp.ai`.
2. Keep admin pages in `matchapp.ai`; do not extract the graphical UI into
   `matchai-ops`.
3. Publish operational scripts and documentation in `matchai-ops`.
4. Keep shared domain logic canonical in `matchapp.ai`.
5. Leave database migrations, auth, and provider adapters canonical in
   `matchapp.ai`.
6. Verify any script or runbook in `matchai-ops` against the same production
   API contract.

## Post-Extraction Tests

- Internal route navigation still resolves.
- Server-side role checks still block non-staff users.
- Internal import and outreach flows still create the same records.
- Public and creator routes continue to build without importing internal-only UI.

## Duplicate Migration Risks

- Do not duplicate discovery or outreach tables in a second repository.
- Do not create a second source of truth for provider configuration.
- Do not fork auth or RLS rules into the extracted repo.

## Deployment Plan

- Keep production deployment anchored in `matchapp.ai`.
- Do not deploy a second admin site.
- Deploy operational scripts only when they are explicitly invoked.
- Re-run role checks, import flows, and review queues after any admin-related
  backend change.
