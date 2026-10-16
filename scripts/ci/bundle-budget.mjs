#!/usr/bin/env node
/**
 * Orçamento de bundle pós `ng build` (produção).
 * Falha se initial chunks (main/polyfills/styles) somarem acima do teto.
 * Env: WEB_DIST (default web/dist/web/browser), BUNDLE_BUDGET_BYTES (default 1310720 = 1.25MB)
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.env.WEB_DIST || join('web', 'dist', 'web', 'browser');
const budget = Number(process.env.BUNDLE_BUDGET_BYTES || 1_310_720);

function listJsCss(dir) {
  try {
    return readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
  } catch (err) {
    console.error(`dist não encontrado: ${dir}`, err.message);
    process.exit(1);
  }
}

const files = listJsCss(dist);
// Initial-ish: main.*, polyfills.*, styles.*, sem lazy chunk-* com hash longo só
const initial = files.filter(
  (f) =>
    /^(main|polyfills|styles)(\.|$)/.test(f) ||
    (/^chunk-/.test(f) === false && /\.(js|css)$/.test(f) && !f.includes('server')),
);

let total = 0;
const rows = [];
for (const f of initial) {
  const size = statSync(join(dist, f)).size;
  total += size;
  rows.push({ f, size });
}

rows.sort((a, b) => b.size - a.size);
console.log('Bundle budget (initial-ish):');
for (const r of rows.slice(0, 20)) {
  console.log(`  ${(r.size / 1024).toFixed(1)} KiB  ${r.f}`);
}
console.log(`Total: ${(total / 1024).toFixed(1)} KiB / budget ${(budget / 1024).toFixed(1)} KiB`);

if (total > budget) {
  console.error('FAIL: orçamento de bundle excedido');
  process.exit(1);
}
console.log('OK');
