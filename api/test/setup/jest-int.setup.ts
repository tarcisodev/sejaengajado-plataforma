import { connectHarnessPostgres } from './postgres';
import { truncateAll } from './truncate';

beforeAll(async () => {
  await connectHarnessPostgres();
});

beforeEach(async () => {
  await truncateAll();
});
