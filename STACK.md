# MatchAI Stack

The full technology stack powering MatchAI.

| Layer               | Service                    | Purpose                                                                                    |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| App platform        | **Lovable**                | Product development, preview, and hosting orchestration                                    |
| Source control      | **GitHub**                 | Repository, version history, PR workflow                                                   |
| Backend             | **Supabase**               | Postgres database, Auth (email + Google OAuth), Row-Level Security, Storage                |
| AI                  | **OpenAI API**             | LLM inference for chat, matching, outreach drafting, and personalization                   |
| Payments            | **Stripe**                 | MatchAI subscriptions and billing only                                                     |
| Creator outreach    | **Internal MatchAI Inbox** | Threads, drafts, approvals, and delivery-state model; external transport is not configured |
| Transactional email | **Resend**                 | System email (receipts, notifications, unsubscribe), open/click tracking                   |
| Edge runtime        | **Cloudflare Workers**     | SSR + server functions + public API routes (webhooks, cron, MCP)                           |
| Dev tooling         | **Claude Code**            | AI-assisted engineering                                                                    |

## Notes

- **Runtime**: TanStack Start on Cloudflare Workers (`nodejs_compat`). All server functions and public API routes execute at the edge.
- **Auth model**: Supabase Auth issues JWTs consumed by both the app and the MCP server (`/mcp`) via OAuth 2.1.
- **Data isolation**: Every user-facing table has RLS enabled; privileged writes (roles, escrow updates) go through server functions using the service role.
- **External callers**: Stripe webhooks and follow-up cron hit `/api/public/*` routes with signature/secret verification. Creator outreach does not require Gmail.
