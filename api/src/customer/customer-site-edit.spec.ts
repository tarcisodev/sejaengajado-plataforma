import { customerSiteNotEditableReason } from './customer-site-edit';

describe('customerSiteNotEditableReason', () => {
  it('blocks Pronto (ONE_TIME) with the support message', () => {
    expect(
      customerSiteNotEditableReason({
        editable: false,
        status: 'PUBLISHED',
        plan: { type: 'ONE_TIME' },
      }),
    ).toContain('Plano Pronto');
  });

  it('blocks READ_ONLY / SUSPENDED / ARCHIVED on Pro', () => {
    for (const status of ['READ_ONLY', 'SUSPENDED', 'ARCHIVED'] as const) {
      expect(
        customerSiteNotEditableReason({
          editable: true,
          status,
          plan: { type: 'RECURRING' },
        }),
      ).toBe('Este site está em modo só leitura.');
    }
  });

  it('allows Pro published editable sites', () => {
    expect(
      customerSiteNotEditableReason({
        editable: true,
        status: 'PUBLISHED',
        plan: { type: 'RECURRING' },
      }),
    ).toBeNull();
  });
});
