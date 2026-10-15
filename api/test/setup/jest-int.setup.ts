import { startHarnessPostgres, stopHarnessPostgres } from './postgres';
import { truncateAll } from './truncate';

beforeAll(async () => {
  await startHarnessPostgres();
}, 180_000);

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await stopHarnessPostgres();
}, 60_000);
