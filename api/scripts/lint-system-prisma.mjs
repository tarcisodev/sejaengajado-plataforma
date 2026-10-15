#!/usr/bin/env node
/**
 * SYSTEM_PRISMA = se_admin (BYPASSRLS). Only webhooks/jobs (+ auth bootstrap,
 * ledger append helper, public by-host) may inject it. Controllers never.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC =
  process.env.SYSTEM_PRISMA_LINT_SRC ||
  fileURLToPath(new URL('../src', import.meta.url));

const ALLOW_PREFIXES = [
  `tenant${sep}prisma.module.ts`,
  `auth${sep}supabase-jwt.guard.ts`,
  `payments${sep}webhooks${sep}`,
  `jobs${sep}`,
  `ledger${sep}ledger.service.ts`,
  // Public by-host has no tenant ALS; SECURITY DEFINER is the long-term fix.
  `public${sep}`,
];

const ALLOW_BILLING_JOB = /billing[/\\][^/\\]*(job|scheduler)[^/\\]*\.ts$/i;

/** Import / inject / provide — not prose in comments. */
const REF =
  /(?:import\s*\{[^}]*\bSYSTEM_PRISMA\b|@Inject\(\s*SYSTEM_PRISMA\s*\)|inject:\s*\[[^\]]*SYSTEM_PRISMA|provide:\s*SYSTEM_PRISMA|export const SYSTEM_PRISMA)/;

const hits = [];

function isAllowed(relPosix) {
  const rel = relPosix.split('/').join(sep);
  if (ALLOW_BILLING_JOB.test(rel)) {
    return true;
  }
  return ALLOW_PREFIXES.some(
    (prefix) => rel === prefix || rel.startsWith(prefix),
  );
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) {
      continue;
    }
    const rel = relative(SRC, full);
    const text = readFileSync(full, 'utf8');
    if (!REF.test(text)) {
      continue;
    }

    if (name.endsWith('.controller.ts') || name.includes('.controller.')) {
      hits.push(`${rel}: controller HTTP não pode referenciar SYSTEM_PRISMA`);
      continue;
    }

    if (!isAllowed(rel)) {
      hits.push(
        `${rel}: SYSTEM_PRISMA só em webhooks/jobs (e bootstrap auth/public/ledger)`,
      );
    }
  }
}

walk(SRC);

if (hits.length) {
  console.error('lint-system-prisma: falhou:');
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}

console.log('lint-system-prisma: ok');
