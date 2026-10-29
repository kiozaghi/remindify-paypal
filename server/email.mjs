import { createHmac } from "node:crypto";

// Transactional email goes through a single HTTPS webhook so the app does not
// have to hold SMTP credentials. Any provider adapter (Resend, Postmark, SES)
// can sit behind it. Payload: { to, subject, text }.
export function emailConfigured() {
  return Boolean(process.env.EMAIL_WEBHOOK_URL);
}

export async function sendEmail({ to, subject, text }) {
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url) throw new Error("email_not_configured");

  const body = JSON.stringify({ to, subject, text });
  const timestamp = Date.now();
  const headers = {
    "content-type": "application/json",
    "user-agent": "Remindify-Mail/1",
    "x-remindify-timestamp": String(timestamp),
  };
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    headers["x-remindify-signature"] = `sha256=${createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex")}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`email_webhook_${response.status}`);
}
