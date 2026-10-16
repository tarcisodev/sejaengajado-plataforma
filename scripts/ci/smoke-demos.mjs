#!/usr/bin/env node
/**
 * Stable biosite smoke: N GETs per demo must be 200 with the business name needle.
 * Usage: node scripts/ci/smoke-demos.mjs [attempts=50]
 * Env: SMOKE_BASE=https://{slug}.sejaengajado.com.br (default)
 */
const attempts = Math.max(1, Number(process.argv[2] || process.env.SMOKE_ATTEMPTS || 50));
const demos = [
  { slug: 'demo-forno', needle: 'Forno' },
  { slug: 'demo-barbearia', needle: 'Barbearia' },
  { slug: 'demo-estudio', needle: 'Luz' },
];

let failed = 0;
for (const { slug, needle } of demos) {
  let ok = 0;
  for (let i = 0; i < attempts; i++) {
    const url = `https://${slug}.sejaengajado.com.br/`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      if (
        res.status === 200 &&
        text.includes(needle) &&
        !/Negócio não encontrado|Não encontramos esse negócio/i.test(text)
      ) {
        ok += 1;
      }
    } catch {
      /* count as miss */
    }
  }
  const line = `${slug}: ${ok}/${attempts}`;
  if (ok < attempts) {
    console.error(`FAIL ${line}`);
    failed += 1;
  } else {
    console.log(`OK   ${line}`);
  }
}
process.exit(failed ? 1 : 0);
