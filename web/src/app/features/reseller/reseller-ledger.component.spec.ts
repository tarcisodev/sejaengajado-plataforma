import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { formatBrl } from '../landing/landing-seo';
import { ResellerLedgerComponent } from './reseller-ledger.component';

describe('ResellerLedgerComponent (AW5)', () => {
  it('renders ledger statement as read-only balances and rows', () => {
    TestBed.configureTestingModule({
      imports: [ResellerLedgerComponent],
      providers: [
        {
          provide: API_PORT,
          useValue: {
            getResellerLedger: () =>
              of({
                items: [
                  {
                    id: 'led-1',
                    resellerId: 'r1',
                    type: 'IN',
                    category: 'SALE',
                    amountCents: 2500,
                    refType: 'Sale',
                    refId: 's1',
                    reversalOfId: null,
                    createdAt: '2026-10-16T12:00:00.000Z',
                  },
                ],
                nextCursor: null,
                openingCents: 1000,
                closingCents: 3500,
              }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResellerLedgerComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const opening = root.querySelector('[data-opening]')!.textContent!.replace(/\u00a0/g, ' ');
    const closing = root.querySelector('[data-closing]')!.textContent!.replace(/\u00a0/g, ' ');
    expect(opening).toContain(formatBrl(1000).replace(/\u00a0/g, ' '));
    expect(closing).toContain(formatBrl(3500).replace(/\u00a0/g, ' '));
    expect(root.querySelector('[data-ledger-id="led-1"]')).toBeTruthy();
    expect(root.querySelector('form')).toBeNull();
  });
});
