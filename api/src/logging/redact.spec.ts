import { Writable } from 'node:stream';

import pino from 'pino';

import { redact } from './redact';

describe('redact', () => {
  it('removes authorization, password and the webhook payload', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ redact }, stream);

    logger.info({
      password: 's3cret',
      authorization: 'Bearer abc',
      req: {
        headers: { authorization: 'Bearer abc', cookie: 'sid=1' },
        body: { webhook: { id: 'segredo-webhook' } },
      },
    });

    const output = lines.join('');
    expect(output).not.toContain('s3cret');
    expect(output).not.toContain('Bearer abc');
    expect(output).not.toContain('sid=1');
    expect(output).not.toContain('segredo-webhook');
    expect(output).toContain('[Redacted]');
  });
});
