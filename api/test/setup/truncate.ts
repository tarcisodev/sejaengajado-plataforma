import { getHarnessPostgres } from './postgres';

const TABLES = ['"HarnessProbe"'] as const;

export async function truncateAll(): Promise<void> {
  const { prisma } = getHarnessPostgres();
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}
