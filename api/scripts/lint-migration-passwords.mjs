#!/usr/bin/env node
/**
 * Fail if post-baseline Prisma migrations embed a role PASSWORD literal.
 * Historical migrations (≤ 20261015250000) may still contain legacy PASSWORD
 * for greenfield checksum stability — rotate via db-bootstrap-roles.md in prod.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const BASELINE_TS = '20261015250000';
const root = join(process.cwd(), 'prisma', 'migrations');
const bad = [];

function migrationTs(dirName) {
  return dirName.split('_')[0] ?? '';
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const ts = migrationTs(name);
      if (/^\d+$/.test(ts) && ts <= BASELINE_TS) {
        continue;
      }
      walk(path);
      continue;
    }
    if (!name.endsWith('.sql')) {
      continue;
    }
    const sql = readFileSync(path, 'utf8');
    if (/PASSWORD\s+'[^']+'/i.test(sql) || /PASSWORD\s+"[^"]+"/i.test(sql)) {
      bad.push(path);
    }
  }
}

walk(root);

if (bad.length) {
  console.error('lint-migration-passwords: PASSWORD literal found in post-baseline migration:');
  for (const path of bad) {
    console.error(' -', path);
  }
  process.exit(1);
}

console.log(`lint-migration-passwords: ok (baseline=${BASELINE_TS})`);
