/** Pure gate for CUSTOMER self-service edits (04-B8). */
export function customerSiteNotEditableReason(site: {
  editable: boolean;
  status: string;
  plan: { type: string };
}): string | null {
  if (site.plan.type !== 'RECURRING') {
    return 'Plano Pronto: alterações via suporte. Assine o Engajado Pro para editar.';
  }
  const blockedStatus =
    site.status === 'READ_ONLY' ||
    site.status === 'SUSPENDED' ||
    site.status === 'ARCHIVED';
  if (!site.editable || blockedStatus) {
    return 'Este site está em modo só leitura.';
  }
  return null;
}
