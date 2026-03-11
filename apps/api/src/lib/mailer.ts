/**
 * Minimal email sender — fetch-based Resend API, no extra dependencies.
 *
 * Dev fallback: when RESEND_API_KEY is absent the email is logged at INFO
 * level rather than sent, so local dev works without a live email provider.
 *
 * Usage:
 *   await sendEmail({
 *     to: "user@example.com",
 *     subject: "You've been invited to LogiQo",
 *     html: "<p>Click <a href='...'>here</a> to join.</p>",
 *   });
 */

export interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
  /** Defaults to EMAIL_FROM env var, falls back to "noreply@logiqo.io". */
  from?:   string;
}

export interface SendEmailResult {
  /** True if the email was dispatched (or dev-logged). */
  ok:       boolean;
  /** Resend message ID, or "dev-log" in local-dev mode. */
  messageId?: string;
  error?:   string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Send a transactional email via Resend.
 *
 * Never throws — errors are returned as `{ ok: false, error }` so callers
 * can decide whether to surface them or log-and-continue.
 */
export async function sendEmail(
  opts: SendEmailOptions,
  log:  { info: (...a: any[]) => void; error: (...a: any[]) => void },
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = opts.from ?? process.env.EMAIL_FROM ?? "noreply@logiqo.io";

  // ── Dev fallback ──────────────────────────────────────────────────────────
  if (!apiKey) {
    log.info(
      {
        to:      opts.to,
        subject: opts.subject,
        from,
        html:    opts.html,
      },
      "[mailer] RESEND_API_KEY not set — email logged instead of sent (dev mode)"
    );
    return { ok: true, messageId: "dev-log" };
  }

  // ── Live send via Resend API ───────────────────────────────────────────────
  try {
    const res = await fetch(RESEND_API_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from,
        to:      [opts.to],
        subject: opts.subject,
        html:    opts.html,
      }),
    });

    if (!res.ok) {
      let errBody: { message?: string; name?: string } = {};
      try { errBody = await res.json() as { message?: string; name?: string }; } catch { /* non-JSON body */ }
      const errMsg = errBody.message ?? errBody.name ?? `Resend HTTP ${res.status}`;
      log.error({ status: res.status, body: errBody, to: opts.to }, `[mailer] Failed to send email: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    const data = await res.json() as { id?: string };
    log.info({ messageId: data.id, to: opts.to, subject: opts.subject }, "[mailer] Email sent");
    return { ok: true, messageId: data.id };

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown send error";
    log.error({ err, to: opts.to }, `[mailer] Network error sending email: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// ── Email templates ────────────────────────────────────────────────────────────

/**
 * Generate the HTML body for an organisation invitation email.
 */
export function inviteEmailHtml(opts: {
  inviterName:     string;
  tenantName:      string;
  role:            string;
  acceptUrl:       string;
  expiresAt:       Date;
}): string {
  const expiry = opts.expiresAt.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const roleLabel = opts.role.replace(/_/g, " ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>LogiQo Invitation</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:24px;margin-bottom:8px">You've been invited to LogiQo</h1>
  <p><strong>${opts.inviterName}</strong> has invited you to join
     <strong>${opts.tenantName}</strong> as <strong>${roleLabel}</strong>.</p>
  <p>Click the button below to accept the invitation and create your account.
     This link expires on <strong>${expiry}</strong>.</p>
  <p style="margin:32px 0">
    <a href="${opts.acceptUrl}"
       style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
              text-decoration:none;font-weight:600;display:inline-block">
      Accept invitation
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280">
    If you were not expecting this invitation, you can safely ignore this email.
    The link will expire automatically.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">
    LogiQo MedTech — Unified Medical Hardware &amp; Peer Telemetry Platform
  </p>
</body>
</html>`;
}
