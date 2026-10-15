import { bootHarnessPostgres } from './postgres';

export default async function globalSetup(): Promise<void> {
  await bootHarnessPostgres();
}
