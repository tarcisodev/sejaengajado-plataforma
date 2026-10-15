const MAX_BODY_CHARS = 32 * 1024;

/**
 * Reject oversized bodies and keep only non-sensitive identifiers for storage.
 * Never persist card/pix/customer PII from the Asaas webhook body.
 */
export function assertWebhookBodySize(raw: unknown): void {
  let size = 0;
  try {
    size = JSON.stringify(raw ?? {}).length;
  } catch {
    size = MAX_BODY_CHARS + 1;
  }
  if (size > MAX_BODY_CHARS) {
    throw new Error('BODY_TOO_LARGE');
  }
}

export function sanitizeWebhookPayload(raw: unknown): {
  event?: string;
  paymentId?: string;
} {
  assertWebhookBodySize(raw);
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const body = raw as Record<string, unknown>;
  const event =
    typeof body.event === 'string'
      ? body.event
      : typeof body.type === 'string'
        ? body.type
        : undefined;
  const payment = body.payment;
  let paymentId: string | undefined;
  if (payment && typeof payment === 'object') {
    const id = (payment as { id?: unknown }).id;
    if (typeof id === 'string') {
      paymentId = id;
    }
  }
  if (!paymentId && typeof body.paymentId === 'string') {
    paymentId = body.paymentId;
  }
  return { event, paymentId };
}
