import { openNowStatus } from './site-open-now';

describe('openNowStatus', () => {
  const weekly = {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: null,
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: { open: '10:00', close: '14:00' },
    sun: null,
  };

  it('reports open inside business hours in America/Sao_Paulo', () => {
    // 2026-10-16 is a Friday; 14:30 -03:00
    const now = new Date('2026-10-16T17:30:00.000Z');
    const status = openNowStatus(weekly, 'America/Sao_Paulo', now);
    expect(status.kind).toBe('open');
    expect(status.label).toContain('Aberto agora');
    expect(status.label).toContain('18:00');
  });

  it('reports closed after hours and points to next open day', () => {
    const now = new Date('2026-10-16T22:00:00.000Z'); // Fri 19:00 -03
    const status = openNowStatus(weekly, 'America/Sao_Paulo', now);
    expect(status.kind).toBe('closed');
    expect(status.label).toMatch(/Abre sábado às 10:00/);
  });

  it('handles day boundary across timezones', () => {
    // Saturday 23:30 in Tokyo → still Saturday locally
    const now = new Date('2026-10-17T14:30:00.000Z');
    const status = openNowStatus(
      { sat: { open: '10:00', close: '14:00' }, sun: { open: '09:00', close: '12:00' } },
      'Asia/Tokyo',
      now,
    );
    expect(status.kind).toBe('closed');
    expect(status.label).toMatch(/domingo/);
  });
});
