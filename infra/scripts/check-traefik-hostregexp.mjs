#!/usr/bin/env node
/**
 * Ensures se-web HostRegexp survives YAML + Compose ($$ → $) with single backslashes.
 * Expected final label fragment:
 *   HostRegexp(`^[a-z0-9-]+\.sejaengajado\.com\.br$`)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const stackPath = join(root, 'infra/stack.yml');
const raw = readFileSync(stackPath, 'utf8');

const match = raw.match(
  /traefik\.http\.routers\.se-web\.rule=Host\(`sejaengajado\.com\.br`\) \|\| Host\(`app\.sejaengajado\.com\.br`\) \|\| HostRegexp\(`([^`]+)`\)/,
);
if (!match) {
  console.error('check-traefik-hostregexp: se-web.rule com HostRegexp não encontrado em infra/stack.yml');
  process.exit(1);
}

const regexpInFile = match[1];
// Docker Compose / stack deploy: $$ → $
const rendered = regexpInFile.replace(/\$\$/g, '$');
const expected = '^[a-z0-9-]+\\.sejaengajado\\.com\\.br$';

if (rendered !== expected) {
  console.error('check-traefik-hostregexp: HostRegexp renderizado incorreto');
  console.error('  arquivo :', JSON.stringify(regexpInFile));
  console.error('  swarm   :', JSON.stringify(rendered));
  console.error('  esperado:', JSON.stringify(expected));
  process.exit(1);
}

// Guard against the historical double-escape bug (\\\\. in the Swarm value).
if (/\\\\/.test(rendered)) {
  console.error('check-traefik-hostregexp: barras duplicadas no regex renderizado:', rendered);
  process.exit(1);
}

const probe = 'demo-forno.sejaengajado.com.br';
if (!new RegExp(rendered).test(probe)) {
  console.error('check-traefik-hostregexp: regex não casa', probe, rendered);
  process.exit(1);
}

console.log('check-traefik-hostregexp: ok', rendered);
