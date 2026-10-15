import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../tenant/prisma.module';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';
import { SUPABASE_ADMIN, type SupabaseAdminClient } from './supabase-admin';

const inviteSchema = z
  .object({
    email: z.string().email(),
    resellerId: z.string().uuid().optional(),
    role: z.enum(['ADMIN', 'RESELLER', 'CUSTOMER']).default('RESELLER'),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'ADMIN' && !value.resellerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resellerId'],
        message: 'resellerId obrigatório',
      });
    }
  });

const resetSchema = z.object({
  email: z.string().email(),
});

@Controller()
export class AuthController {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly adminPrisma: AdminPrisma,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseAdminClient,
  ) {}

  @Get('auth/me')
  @Roles('ADMIN', 'RESELLER', 'CUSTOMER')
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      status: user.status,
      aal: user.aal,
    };
  }

  @Get('admin/session/ping')
  @Roles('ADMIN')
  adminPing(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Post('admin/auth/invite')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async invite(@Body() body: unknown) {
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    const input = parsed.data;
    const invited = await this.supabaseAdmin.inviteUserByEmail(input.email);
    const user = await this.adminPrisma.user.create({
      data: {
        supabaseId: invited.id,
        email: invited.email.toLowerCase(),
        role: input.role,
        resellerId: input.role === 'ADMIN' ? null : input.resellerId!,
        status: 'ACTIVE',
      },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      supabaseId: user.supabaseId,
    };
  }

  @Post('admin/auth/reset-link')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetLink(@Body() body: unknown) {
    const input = resetSchema.parse(body);
    try {
      const link = await this.supabaseAdmin.generateRecoveryLink(input.email);
      return { actionLink: link.actionLink };
    } catch {
      throw new ServiceUnavailableException({
        code: 'UNAVAILABLE',
        message: 'Falha ao gerar link de reset',
      });
    }
  }
}
