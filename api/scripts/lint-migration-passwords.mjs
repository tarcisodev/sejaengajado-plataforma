#!/usr/bin/env node
/**
 * Fail if any Prisma migration embeds a role PASSWORD literal.
 * Passwords belong in Swarm secrets + db-bootstrap-roles.md only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'prisma', 'migrations');
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
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
  console.error('lint-migration-passwords: PASSWORD literal found in:');
  for (const path of bad) {
    console.error(' -', path);
  }
  process.exit(1);
}

console.log('lint-migration-passwords: ok');
