#!/usr/bin/env node
/**
 * Fail if money-related code uses parseFloat / Decimal (centavos must stay Int).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src', import.meta.url));
const FORBIDDEN = [
  { re: /\bparseFloat\s*\(/, label: 'parseFloat(' },
  { re: /\bDecimal\b/, label: 'Decimal' },
  { re: /from\s+['"]decimal\.js['"]/, label: "from 'decimal.js'" },
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
      const trimmed = line.trim();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*')
      ) {
        return;
      }
      for (const rule of FORBIDDEN) {
        if (rule.re.test(line)) {
          hits.push(`${relative(ROOT, full)}:${i + 1}: ${rule.label}`);
        }
      }
    });
  }
}

walk(ROOT);

if (hits.length) {
  console.error('lint-money: uso proibido de float/Decimal em valores monetários:');
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}

console.log('lint-money: ok');
