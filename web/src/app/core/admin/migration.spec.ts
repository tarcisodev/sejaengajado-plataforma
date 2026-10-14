import { migrationAvailable } from './migration';

describe('migrationAvailable', () => {
  const today = new Date('2026-10-14T15:00:00.000Z');

  it('offers migration only after the delinquent grace', () => {
    expect(migrationAvailable('DELINQUENT', '2026-09-01', today, 30)).toBeTrue();
    expect(migrationAvailable('DELINQUENT', '2026-10-01', today, 30)).toBeFalse();
    expect(migrationAvailable('ACTIVE', '2026-09-01', today, 30)).toBeFalse();
    expect(migrationAvailable('BLOCKED', '2026-09-01', today, 30)).toBeFalse();
    expect(migrationAvailable('DELINQUENT', null, today, 30)).toBeFalse();
  });
});
