import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export interface HarnessPostgres {
  /** se_app — subject to FORCE RLS (application connection). */
  prisma: PrismaClient;
  /** postgres — migrations, truncate, unrestricted seed. */
  adminPrisma: PrismaClient;
  adminUrl: string;
  appUrl: string;
  seAdminUrl: string;
  containerId: string;
}

interface HarnessStateFile {
  adminUrl: string;
  appUrl: string;
  seAdminUrl: string;
  containerId: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __SE_HARNESS_POSTGRES__: HarnessPostgres | undefined;
}

const STATE_PATH = join(__dirname, '.harness-postgres.json');

function writeState(state: HarnessStateFile): void {
  writeFileSync(STATE_PATH, JSON.stringify(state), 'utf8');
}

function readState(): HarnessStateFile | null {
  if (!existsSync(STATE_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as HarnessStateFile;
}

function applyEnv(state: Pick<HarnessStateFile, 'appUrl' | 'seAdminUrl'>): void {
  process.env.DATABASE_URL = state.appUrl;
  process.env.ADMIN_DATABASE_URL = state.seAdminUrl;
  process.env.TEST_JWT_SECRET = process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret';
  process.env.TEST_JWT_ISS = process.env.TEST_JWT_ISS ?? 'http://127.0.0.1/auth/v1';
  process.env.TEST_JWT_AUD = process.env.TEST_JWT_AUD ?? 'authenticated';
}

/**
 * Starts the shared Postgres once (Jest globalSetup).
 * Ryuk is disabled so the container survives the globalSetup process exit;
 * globalTeardown stops it by container id.
 */
export async function bootHarnessPostgres(): Promise<HarnessStateFile> {
  const existing = readState();
  if (existing) {
    applyEnv(existing);
    return existing;
  }

  process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('sejaengajado')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const adminUrl = container.getConnectionUri();
  const appUrl = `postgresql://se_app:se_app@${host}:${port}/sejaengajado`;
  const seAdminUrl = `postgresql://se_admin:se_admin@${host}:${port}/sejaengajado`;

  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: adminUrl },
    stdio: 'inherit',
  });

  // Migrations cannot set BYPASSRLS (needs superuser). Mirror production bootstrap.
  const bootstrap = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await bootstrap.$executeRawUnsafe(`ALTER ROLE se_admin WITH BYPASSRLS`);
    await bootstrap.$executeRawUnsafe(`ALTER ROLE se_app WITH NOBYPASSRLS`);
  } finally {
    await bootstrap.$disconnect();
  }

  const state: HarnessStateFile = {
    adminUrl,
    appUrl,
    seAdminUrl,
    containerId: container.getId(),
  };
  writeState(state);
  applyEnv(state);
  return state;
}

/** Connects Prisma clients in the Jest worker from the globalSetup state file. */
export async function connectHarnessPostgres(): Promise<HarnessPostgres> {
  if (globalThis.__SE_HARNESS_POSTGRES__) {
    return globalThis.__SE_HARNESS_POSTGRES__;
  }

  const state = readState();
  if (!state) {
    throw new Error(
      'Harness Postgres não iniciado — rode via jest globalSetup (test:int)',
    );
  }
  applyEnv(state);

  const prisma = new PrismaClient({
    datasources: { db: { url: state.appUrl } },
  });
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: state.adminUrl } },
  });
  await Promise.all([prisma.$connect(), adminPrisma.$connect()]);

  const harness: HarnessPostgres = { prisma, adminPrisma, ...state };
  globalThis.__SE_HARNESS_POSTGRES__ = harness;
  return harness;
}

/** Fallback for tools that call start outside Jest (still prefer globalSetup). */
export async function startHarnessPostgres(): Promise<HarnessPostgres> {
  if (globalThis.__SE_HARNESS_POSTGRES__) {
    return globalThis.__SE_HARNESS_POSTGRES__;
  }
  if (!readState()) {
    await bootHarnessPostgres();
  }
  return connectHarnessPostgres();
}

export function getHarnessPostgres(): HarnessPostgres {
  const harness = globalThis.__SE_HARNESS_POSTGRES__;
  if (!harness) {
    throw new Error('Harness Postgres ainda não foi iniciado');
  }
  return harness;
}

/** Stops the shared container (Jest globalTeardown). */
export async function shutdownHarnessPostgres(): Promise<void> {
  const local = globalThis.__SE_HARNESS_POSTGRES__;
  if (local) {
    await Promise.allSettled([
      local.prisma.$disconnect(),
      local.adminPrisma.$disconnect(),
    ]);
    globalThis.__SE_HARNESS_POSTGRES__ = undefined;
  }

  const state = readState();
  if (state) {
    try {
      execSync(`docker stop ${state.containerId}`, { stdio: 'ignore' });
    } catch {
      // already stopped
    }
    try {
      execSync(`docker rm -f ${state.containerId}`, { stdio: 'ignore' });
    } catch {
      // already removed
    }
    if (existsSync(STATE_PATH)) {
      unlinkSync(STATE_PATH);
    }
  }
}

export async function stopHarnessPostgres(): Promise<void> {
  await shutdownHarnessPostgres();
}
