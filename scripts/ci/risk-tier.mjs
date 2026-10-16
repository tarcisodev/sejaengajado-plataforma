#!/usr/bin/env node
/**
 * Lê o diff do PR (ou BASE…HEAD) e imprime o maior trilho tocado.
 * Uso: node scripts/ci/risk-tier.mjs [--base origin/master] [--head HEAD] [--json]
 */
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RANK = { baixo: 1, medio: 2, alto: 3 };

function parseArgs(argv) {
  let base = process.env.BASE_REF || process.env.GITHUB_BASE_REF || 'origin/master';
  let head = process.env.HEAD_REF || process.env.GITHUB_SHA || 'HEAD';
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') base = argv[++i];
    else if (argv[i] === '--head') head = argv[++i];
    else if (argv[i] === '--json') json = true;
  }
  if (base && !base.includes('/') && !/^origin\//.test(base) && base !== 'HEAD') {
    base = `origin/${base}`;
  }
  return { base, head, json };
}

function loadPaths() {
  const raw = readFileSync(join(root, '.github/risk-paths.yml'), 'utf8');
  const tiers = { baixo: [], medio: [], alto: [] };
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const key = t.match(/^(baixo|medio|alto):\s*$/);
    if (key) {
      current = key[1];
      continue;
    }
    const m = t.match(/^-\s*"([^"]+)"\s*$/) || t.match(/^-\s+'([^']+)'\s*$/) || t.match(/^-\s+(\S+)\s*$/);
    if (m && current) tiers[current].push(m[1]);
  }
  return tiers;
}

function globToRegExp(glob) {
  const g = glob.replace(/\\/g, '/');
  let re = '^';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      re += '.*';
      i++;
      if (g[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if ('.+^$()[]{}|'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(re + '$');
}

function matchTier(file, patterns) {
  const path = file.replace(/\\/g, '/');
  let hit = false;
  for (const p of patterns) {
    if (p.startsWith('!')) {
      if (globToRegExp(p.slice(1)).test(path)) hit = false;
    } else if (globToRegExp(p).test(path)) {
      hit = true;
    }
  }
  return hit;
}

function classify(file, tiers) {
  if (matchTier(file, tiers.alto)) return 'alto';
  if (matchTier(file, tiers.medio)) return 'medio';
  if (matchTier(file, tiers.baixo)) return 'baixo';
  return 'medio';
}

function changedFiles(base, head) {
  try {
    execSync(`git rev-parse --verify ${base}`, { cwd: root, stdio: 'ignore' });
  } catch {
    execSync('git fetch --no-tags --depth=50 origin master', { cwd: root, stdio: 'inherit' });
  }
  const out = execSync(`git diff --name-only ${base}...${head}`, {
    cwd: root,
    encoding: 'utf8',
  });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const { base, head, json } = parseArgs(process.argv.slice(2));
const tiers = loadPaths();
const files = changedFiles(base, head);
let max = 'baixo';
const byFile = [];
for (const file of files) {
  const tier = classify(file, tiers);
  byFile.push({ file, tier });
  if (RANK[tier] > RANK[max]) max = tier;
}
const result = { tier: max, files: byFile, base, head };
if (json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  process.stdout.write(max + '\n');
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `tier=${max}\n`);
}
