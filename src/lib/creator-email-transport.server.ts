export type CreatorEmailAttachment = {
  filename: string;
  mimeType: string;
  contentBase64: string;
};

export type CreatorEmailSendInput = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  body: string;
  providerThreadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments: CreatorEmailAttachment[];
  idempotencyKey: string;
};

export type CreatorEmailTransport = {
  provider: string | null;
  configured: boolean;
  send: (
    input: CreatorEmailSendInput,
  ) => Promise<
    | { ok: true; providerMessageId: string; providerThreadId: string }
    | { ok: false; error: string; retryable: boolean }
  >;
  synchronize: () => Promise<
    { ok: true; synced: number; failed: number } | { ok: false; error: string; retryable: boolean }
  >;
};

const NOT_CONFIGURED =
  "Creator email delivery is not configured yet. Your draft is safe; select an email API provider before sending.";

/**
 * Provider selection is an explicit product decision. Never infer a transport
 * from available keys or silently fall back to Resend.
 */
export function getCreatorEmailTransport(): CreatorEmailTransport {
  const provider = (process.env.CREATOR_EMAIL_PROVIDER ?? "").trim();
  if (!provider) {
    return {
      provider: null,
      configured: false,
      send: async () => ({
        ok: false,
        error: NOT_CONFIGURED,
        retryable: false,
      }),
      synchronize: async () => ({
        ok: false,
        error: NOT_CONFIGURED,
        retryable: false,
      }),
    };
  }

  // No provider adapter has been approved or implemented.
  return {
    provider,
    configured: false,
    send: async () => ({
      ok: false,
      error: `Creator email provider “${provider}” has no configured adapter.`,
      retryable: false,
    }),
    synchronize: async () => ({
      ok: false,
      error: `Creator email provider “${provider}” has no configured adapter.`,
      retryable: false,
    }),
  };
}
