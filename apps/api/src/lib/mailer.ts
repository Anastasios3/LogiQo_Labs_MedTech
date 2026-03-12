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
 * Generate the HTML body for an alert acknowledgement confirmation email.
 *
 * Sent to the hospital safety officer (or system_admin) immediately after
 * they POST /alerts/:id/acknowledge.
 */
export function alertAcknowledgedEmailHtml(opts: {
  /** Full name of the user who performed the acknowledgement. */
  recipientName:  string;
  alertTitle:     string;
  alertType:      string;
  severity:       string;
  acknowledgedAt: Date;
  notes?:         string | null;
  /** Optional deep-link back to the alerts dashboard. */
  alertUrl?:      string;
}): string {
  const ackedAt = opts.acknowledgedAt.toLocaleString("en-US", {
    weekday:    "long",
    year:       "numeric",
    month:      "long",
    day:        "numeric",
    hour:       "2-digit",
    minute:     "2-digit",
    timeZone:       "UTC",
    timeZoneName:   "short",
  });

  const severityColor: Record<string, string> = {
    critical: "#dc2626",
    high:     "#ea580c",
    medium:   "#d97706",
    low:      "#16a34a",
  };
  const badgeColor = severityColor[opts.severity] ?? "#6b7280";
  const typeLabel  = opts.alertType.replace(/_/g, " ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Alert Acknowledged — LogiQo</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:22px;margin-bottom:4px">Alert Acknowledged</h1>
  <p style="color:#6b7280;margin-top:0">Safety acknowledgement confirmation</p>

  <p>Hi <strong>${opts.recipientName}</strong>,</p>
  <p>You have successfully acknowledged the following safety alert on behalf of your organisation.</p>

  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:24px 0;background:#f9fafb">
    <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Alert</p>
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:600">${opts.alertTitle}</p>

    <div style="margin-bottom:16px">
      <span style="background:${badgeColor};color:#fff;padding:3px 10px;border-radius:12px;
                   font-size:12px;font-weight:600;text-transform:uppercase;margin-right:8px">
        ${opts.severity}
      </span>
      <span style="background:#e5e7eb;color:#374151;padding:3px 10px;border-radius:12px;
                   font-size:12px;font-weight:500;text-transform:capitalize">
        ${typeLabel}
      </span>
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280">
      Acknowledged at: <strong style="color:#1a1a1a">${ackedAt}</strong>
    </p>
    ${opts.notes
      ? `<p style="margin:8px 0 0 0;font-size:13px;color:#6b7280">
           Notes: <span style="color:#1a1a1a">${opts.notes}</span>
         </p>`
      : ""}
  </div>

  ${opts.alertUrl
    ? `<p style="margin:0 0 32px 0">
         <a href="${opts.alertUrl}"
            style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;
                   text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
           View Alerts Dashboard
         </a>
       </p>`
    : ""}

  <p style="font-size:13px;color:#6b7280">
    This acknowledgement has been recorded in your organisation's immutable audit log.
    If you did not perform this action, please contact your system administrator immediately.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af">
    LogiQo MedTech — Unified Medical Hardware &amp; Peer Telemetry Platform
  </p>
</body>
</html>`;
}

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
