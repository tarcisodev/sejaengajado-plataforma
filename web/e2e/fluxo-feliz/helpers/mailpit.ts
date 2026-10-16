const mailpitBase = (process.env['E2E_MAILPIT_URL'] ?? 'http://127.0.0.1:8025').replace(
  /\/$/,
  '',
);

type MailpitMessageSummary = {
  ID: string;
  To?: { Address?: string }[];
  Subject?: string;
  Created?: string;
};

type MailpitMessage = {
  ID: string;
  Text?: string;
  HTML?: string;
  Subject?: string;
};

async function messagesForEmail(
  email: string,
  sinceMs: number,
): Promise<{ summary: MailpitMessageSummary; body: string }[]> {
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

  const out: { summary: MailpitMessageSummary; body: string }[] = [];
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
    out.push({ summary, body: `${msg.Text ?? ''}\n${msg.HTML ?? ''}` });
  }
  return out;
}

/** Latest 6-digit OTP for `email` from Mailpit (GoTrue local). */
export async function fetchLatestOtp(email: string, sinceMs = Date.now() - 120_000): Promise<string> {
  for (const { body } of await messagesForEmail(email, sinceMs)) {
    const match = body.match(/\b(\d{6})\b/);
    if (match?.[1]) {
      return match[1];
    }
  }
  throw new Error(`OTP não encontrado no Mailpit para ${email}`);
}

/**
 * Invite/recovery verify link from Mailpit (first login after admin invite).
 * Prefer `type=invite` / `type=recovery` over bare app URLs.
 */
export async function fetchLatestInviteLink(
  email: string,
  sinceMs = Date.now() - 120_000,
): Promise<string> {
  for (const { body } of await messagesForEmail(email, sinceMs)) {
    const links = [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) =>
      m[0].replace(/&amp;/g, '&'),
    );
    const preferred =
      links.find((u) => /[?&]type=invite\b/i.test(u)) ??
      links.find((u) => /[?&]type=recovery\b/i.test(u)) ??
      links.find((u) => /\/auth\/v1\/verify/i.test(u));
    if (preferred) {
      return preferred;
    }
  }
  throw new Error(`Link de convite não encontrado no Mailpit para ${email}`);
}
