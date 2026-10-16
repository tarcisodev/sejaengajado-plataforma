const mailpitBase = (process.env['E2E_MAILPIT_URL'] ?? 'http://127.0.0.1:8025').replace(
  /\/$/,
  '',
);

interface MailpitMessageSummary {
  ID: string;
  To?: { Address?: string }[];
  Subject?: string;
  Created?: string;
}

interface MailpitMessage {
  ID: string;
  Text?: string;
  HTML?: string;
  Subject?: string;
}

/** Latest 6-digit OTP for `email` from Mailpit (GoTrue local). */
export async function fetchLatestOtp(email: string, sinceMs = Date.now() - 120_000): Promise<string> {
  const target = email.trim().toLowerCase();
  const listRes = await fetch(`${mailpitBase}/api/v1/messages?limit=50`);
  if (!listRes.ok) {
    throw new Error(`Mailpit list failed: ${listRes.status}`);
  }
  const list = (await listRes.json()) as { messages?: MailpitMessageSummary[] };
  const candidates = (list.messages ?? [])
    .filter((msg) =>
      (msg.To ?? []).some((to) => (to.Address ?? '').toLowerCase() === target),
    )
    .sort((a, b) => (b.Created ?? '').localeCompare(a.Created ?? ''));

  for (const summary of candidates) {
    const created = summary.Created ? Date.parse(summary.Created) : 0;
    if (created && created < sinceMs) {
      continue;
    }
    const msgRes = await fetch(`${mailpitBase}/api/v1/message/${summary.ID}`);
    if (!msgRes.ok) {
      continue;
    }
    const msg = (await msgRes.json()) as MailpitMessage;
    const body = `${msg.Text ?? ''}\n${msg.HTML ?? ''}`;
    const match = body.match(/\b(\d{6})\b/);
    if (match?.[1]) {
      return match[1];
    }
  }
  throw new Error(`OTP não encontrado no Mailpit para ${target}`);
}
