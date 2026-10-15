import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { Params } from 'nestjs-pino';

export const redact = {
  paths: [
    'authorization',
    'password',
    'token',
    'email',
    'whatsapp',
    'cpf',
    'cnpj',
    '*.authorization',
    '*.password',
    '*.token',
    '*.email',
    '*.whatsapp',
    '*.cpf',
    '*.cnpj',
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.webhook',
  ],
  censor: '[Redacted]',
};

export const loggerParams: Params = {
  pinoHttp: {
    genReqId: (req: IncomingMessage) => {
      const header = req.headers['x-request-id'];
      return typeof header === 'string' && header.length > 0 ? header : randomUUID();
    },
    redact,
  },
};
