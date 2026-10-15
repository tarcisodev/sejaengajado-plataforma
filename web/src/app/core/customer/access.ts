import { SiteStatus } from '../models/domain';
import { diffCivilDays, toCivilDate } from '../api/plaque-penalty';

const BLOCKED_STATUS = new Set<SiteStatus>(['READ_ONLY', 'SUSPENDED', 'ARCHIVED']);

/** Pronto stays read-only. Overdue READ_ONLY blocks editing even on the monthly plan. */
export function canEditSite(site: { editable: boolean; status: SiteStatus }): boolean {
  return site.editable && !BLOCKED_STATUS.has(site.status);
}

/** Days until annual hosting renewal, when it falls inside the lead window. */
export function renewalLeadDays(
  hostingRenewsAt: string | null,
  today: Date,
  leadDays = 90,
): number | null {
  if (!hostingRenewsAt) {
    return null;
  }
  const days = diffCivilDays(toCivilDate(hostingRenewsAt), toCivilDate(today));
  if (days < 0 || days > leadDays) {
    return null;
  }
  return days;
}
