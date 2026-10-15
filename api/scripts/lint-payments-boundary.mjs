#!/usr/bin/env node
/**
 * Domain must not import Asaas (or any payments adapter).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOMAIN = fileURLToPath(new URL('../src/payments/domain', import.meta.url));
const FORBIDDEN = [
  /from\s+['"][^'"]*adapters\/asaas[^'"]*['"]/,
  /from\s+['"]\.\.\/adapters[^'"]*['"]/,
  /from\s+['"][^'"]*\/asaas\.[^'"]*['"]/,
  /require\(\s*['"][^'"]*adapters\/asaas[^'"]*['"]\s*\)/,
];

const hits = [];

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
    const lines = readFileSync(full, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const re of FORBIDDEN) {
        if (re.test(line)) {
          hits.push(`${relative(DOMAIN, full)}:${i + 1}: ${line.trim()}`);
        }
      }
    });
  }
}

walk(DOMAIN);

if (hits.length) {
  console.error('lint-payments-boundary: domínio não pode importar adapters/asaas:');
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}

console.log('lint-payments-boundary: ok');
