import { BadRequestException, HttpException } from '@nestjs/common';
import { z } from 'zod';

import { toErrorBody } from './api-exception.filter';

describe('toErrorBody', () => {
  it('maps a zod error to validation fields', () => {
    const parsed = z.object({ nome: z.string() }).safeParse({});
    if (parsed.success) {
      throw new Error('expected failure');
    }

    const { status, body } = toErrorBody(parsed.error);

    expect(status).toBe(400);
    expect(body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path: 'nome', code: 'invalid_type', message: 'Valor inválido' }],
    });
  });

  it('maps an http exception to a portuguese message', () => {
    const { status, body } = toErrorBody(new BadRequestException());

    expect(status).toBe(400);
    expect(body).toEqual({ code: 'BAD_REQUEST', message: 'Requisição inválida' });
  });

  it('hides unknown errors', () => {
    const { status, body } = toErrorBody(new Error('secret'));

    expect(status).toBe(500);
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Erro interno' });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('keeps fields attached to an http exception', () => {
    const exception = new HttpException(
      { fields: [{ path: 'slug', code: 'taken', message: 'Valor inválido' }] },
      400,
    );

    expect(toErrorBody(exception).body.fields).toEqual([
      { path: 'slug', code: 'taken', message: 'Valor inválido' },
    ]);
  });
});
