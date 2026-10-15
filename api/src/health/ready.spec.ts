import { checkReady } from './ready';

describe('checkReady', () => {
  it('is false when the database query fails', async () => {
    await expect(
      checkReady(
        {
          query: () => Promise.reject(new Error('down')),
        },
        true,
      ),
    ).resolves.toBe(false);
  });

  it('is true when the database and the queue are up', async () => {
    await expect(checkReady({ query: async () => ({ rows: [] }) }, true)).resolves.toBe(true);
  });

  it('is false when the queue is down', async () => {
    await expect(checkReady({ query: async () => ({ rows: [] }) }, false)).resolves.toBe(false);
  });
});
