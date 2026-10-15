import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';

export type AsaasHttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

export interface AsaasClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Default 15s. */
  timeoutMs?: number;
  logger?: {
    warn: (obj: Record<string, unknown>, msg: string) => void;
    error: (obj: Record<string, unknown>, msg: string) => void;
  };
}

export class AsaasHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'AsaasHttpError';
  }
}

/**
 * Thin Asaas HTTP client (Node http/https — nock-friendly).
 * - Never logs the API key or request/response bodies (PII / card / pix secrets).
 * - Retries GET and requests that carry Idempotency-Key (backoff).
 */
export class AsaasClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly logger: AsaasClientOptions['logger'];

  constructor(options: AsaasClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.logger = options.logger;
  }

  async request<T>(
    method: AsaasHttpMethod,
    path: string,
    options: {
      body?: unknown;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const idempotent =
      method === 'GET' || Boolean(options.idempotencyKey?.trim());
    const maxAttempts = idempotent ? 3 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.once<T>(method, path, options);
      } catch (error) {
        lastError = error;
        const retryable =
          idempotent &&
          (error instanceof AsaasHttpError
            ? error.status >= 500 || error.status === 429
            : true);
        if (!retryable || attempt === maxAttempts) {
          throw error;
        }
        this.logger?.warn(
          { path, method, attempt, status: (error as AsaasHttpError).status },
          'asaas retry',
        );
        await sleep(backoffMs(attempt));
      }
    }

    throw lastError;
  }

  private once<T>(
    method: AsaasHttpMethod,
    path: string,
    options: { body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const lib = url.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = {
      accept: 'application/json',
      access_token: this.apiKey,
    };
    const payload =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    if (payload !== undefined) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (options.idempotencyKey?.trim()) {
      headers['Idempotency-Key'] = options.idempotencyKey.trim();
    }

    return new Promise<T>((resolve, reject) => {
      const req = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          timeout: this.timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
              this.logger?.error({ path, method, status }, 'asaas http error');
              reject(
                new AsaasHttpError(
                  status,
                  path,
                  `Asaas ${method} ${path} → ${status}`,
                ),
              );
              return;
            }
            if (status === 204) {
              resolve(undefined as T);
              return;
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) {
              resolve(undefined as T);
              return;
            }
            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              this.logger?.error({ path, method }, 'asaas invalid json');
              reject(new Error(`Asaas ${method} ${path}: JSON inválido`));
            }
          });
        },
      );

      req.on('timeout', () => {
        req.destroy();
        this.logger?.error({ path, method }, 'asaas timeout');
        reject(new Error(`Asaas ${method} ${path}: timeout`));
      });
      req.on('error', (error) => {
        this.logger?.error({ path, method }, 'asaas network error');
        reject(error);
      });

      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  }
}

function backoffMs(attempt: number): number {
  return 100 * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
