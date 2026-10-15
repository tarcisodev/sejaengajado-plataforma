import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const lintSrc = join(__dirname, 'lint-system-prisma.mjs');

describe('lint-system-prisma', () => {
  it('fails when a common HTTP controller injects SYSTEM_PRISMA', () => {
    const root = mkdtempSync(join(tmpdir(), 'se-sys-prisma-'));
    try {
      mkdirSync(join(root, 'sales'), { recursive: true });
      writeFileSync(
        join(root, 'sales', 'sales.controller.ts'),
        `
import { Controller, Inject } from '@nestjs/common';
import { SYSTEM_PRISMA } from '../tenant/prisma.module';
@Controller('sales')
export class SalesController {
  constructor(@Inject(SYSTEM_PRISMA) private readonly db: unknown) {}
}
`,
      );

      expect(() =>
        execFileSync(process.execPath, [lintSrc], {
          env: { ...process.env, SYSTEM_PRISMA_LINT_SRC: root },
          stdio: 'pipe',
        }),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes on the real api/src tree', () => {
    expect(() =>
      execFileSync(process.execPath, [lintSrc], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});
