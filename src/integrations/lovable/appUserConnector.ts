/**
 * App User Connector helpers (server-only).
 *
 * Reads LOVABLE_API_KEY from process.env and calls the connector gateway
 * for per-end-user OAuth (Gmail, etc.). NEVER import from client bundles.
 */

function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set");
  return key;
}

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export interface AuthorizeParams {
  connectorId: string;
  appUserId: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
  connectorClientId?: string;
}

export async function authorizeAppUserOAuth(params: AuthorizeParams): Promise<{
  authorizationUrl: string;
  sessionId: string;
}> {
  const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      connector_client_id: params.connectorClientId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth start failed (${res.status}): ${text}`);
  const body = JSON.parse(text) as { authorization_url?: string; session_id?: string };
  if (!body.authorization_url) throw new Error("OAuth response missing authorization_url");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}

export interface CallAsAppUserParams {
  connectionId: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}

export async function callAsAppUser({
  connectionId,
  connectorId,
  path,
  init,
}: CallAsAppUserParams): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-App-User-Connection-Id", connectionId);
  return fetch(`${GATEWAY_BASE_URL}/${connectorId}${normalizedPath}`, {
    ...init,
    headers,
  });
}

export function parseAppUserOAuthReturn(searchParams: URLSearchParams) {
  const connectorId = searchParams.get("connector_id") ?? "";
  const connectionId = searchParams.get("connection_id") ?? "";
  const success = searchParams.get("success") === "true";
  if (success && connectionId) {
    return { success: true as const, connectorId, connectionId };
  }
  return {
    success: false as const,
    connectorId,
    error: searchParams.get("error") ?? (success ? "Missing connection_id" : "OAuth failed"),
  };
}
