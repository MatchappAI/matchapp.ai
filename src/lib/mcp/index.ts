import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBrandMatchesTool from "./tools/list-brand-matches";
import listDealsTool from "./tools/list-deals";
import listPendingApprovalsTool from "./tools/list-pending-approvals";
import getProfileTool from "./tools/get-profile";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL
// is rewritten to the `.lovable.cloud` proxy, which mcp-js rejects (RFC 8414
// issuer mismatch). VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "matchai-mcp",
  title: "MatchAI",
  version: "0.1.0",
  instructions:
    "Tools for MatchAI, the AI brand-deals agent for creators. Read the signed-in creator's brand matches, deals, pending outreach approvals, and profile. All tools act as the authenticated MatchAI user; RLS scopes results to their own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listBrandMatchesTool, listDealsTool, listPendingApprovalsTool, getProfileTool],
});
