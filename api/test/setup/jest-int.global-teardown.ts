import { shutdownHarnessPostgres } from './postgres';

export default async function globalTeardown(): Promise<void> {
  await shutdownHarnessPostgres();
}
