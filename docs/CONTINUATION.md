# MatchAI Continuation Point

Current repo state:

- Branch: `codex/lovable-exit-inbox-scope`
- Latest completed commit in this session: `fd255be`
- GitHub PR: [MatchappAI/matchapp.ai#1](https://github.com/MatchappAI/matchapp.ai/pull/1)
- PR status: merged to `main`

What this repo now reflects:

- Public-facing payment copy matches the current product model:
  - Stripe is for MatchAI subscriptions
  - creator-brand payment stays external
  - selected deals may include a separate MatchAI commission agreement
  - no active wallet / payout / escrow UI claims
- Frontend browser coverage exists in `tests/e2e/frontend-smoke.spec.ts`
- Handoff docs are present in:
  - `docs/PROJECT_CONTEXT.md`
  - `docs/DATABASE.md`
  - `docs/INTEGRATIONS.md`
  - `docs/FRONTEND_E2E_ACCEPTANCE.md`
  - `docs/LOVABLE_EXIT_CHECKLIST.md`

Validated in this session:

- `npm run build`
- `npm run test:e2e`
- targeted `npx eslint` on touched TS/TSX files

Important note:

- The public site at `https://www.matchapp.ai` was still serving older copy when checked in this session, even after the GitHub merge. That means the deployment step is separate from the repo merge and still needs to be verified on the hosting side.

How to continue:

1. Clone the GitHub repo.
2. Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/LOVABLE_EXIT_CHECKLIST.md`.
3. Run `npm run build` and `npm run test:e2e`.
4. If you need live publishing, check the deployment platform connected to `www.matchapp.ai` and redeploy the merged `main` branch.

