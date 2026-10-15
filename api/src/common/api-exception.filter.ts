import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

export interface FieldError {
  path: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  fields?: FieldError[];
}

const statusMap: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: { code: 'BAD_REQUEST', message: 'Requisição inválida' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Sem permissão' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Não encontrado' },
  [HttpStatus.SERVICE_UNAVAILABLE]: { code: 'UNAVAILABLE', message: 'Serviço indisponível' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Muitas solicitações. Tente novamente em breve.',
  },
};

export function toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
  if (exception instanceof ZodError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: 'Valor inválido',
        })),
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const known = statusMap[status] ?? {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno',
    };
    const response = exception.getResponse();
    if (typeof response === 'object' && response !== null) {
      const payload = response as {
        code?: string;
        message?: string;
        fields?: FieldError[];
      };
      if (typeof payload.code === 'string') {
        return {
          status,
          body: {
            code: payload.code,
            message:
              typeof payload.message === 'string' ? payload.message : known.message,
            ...(payload.fields ? { fields: payload.fields } : {}),
          },
        };
      }
      if (payload.fields) {
        return { status, body: { ...known, fields: payload.fields } };
      }
    }
    return { status, body: known };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code: 'INTERNAL_ERROR', message: 'Erro interno' },
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = toErrorBody(exception);
    response.status(status).json(body);
  }
}
