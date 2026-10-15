import { renewalLeadDays, canEditSite } from './access';

describe('customer access', () => {
  const today = new Date('2026-10-14T15:00:00.000Z');

  it('lets the monthly plan edit and blocks Pronto and overdue sites', () => {
    expect(canEditSite({ editable: true, status: 'PUBLISHED' })).toBeTrue();
    expect(canEditSite({ editable: true, status: 'DRAFT' })).toBeTrue();
    expect(canEditSite({ editable: false, status: 'PUBLISHED' })).toBeFalse();
    expect(canEditSite({ editable: true, status: 'READ_ONLY' })).toBeFalse();
    expect(canEditSite({ editable: true, status: 'SUSPENDED' })).toBeFalse();
    expect(canEditSite({ editable: true, status: 'ARCHIVED' })).toBeFalse();
  });

  it('warns when annual hosting renews within 90 days', () => {
    expect(renewalLeadDays('2027-01-10', today)).toBe(88);
    expect(renewalLeadDays('2027-08-01', today)).toBeNull();
    expect(renewalLeadDays(null, today)).toBeNull();
    expect(renewalLeadDays('2026-10-01', today)).toBeNull();
  });
});
