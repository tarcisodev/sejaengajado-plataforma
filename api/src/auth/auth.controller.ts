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
import { AllowAal1, Roles } from './roles.decorator';
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

const selfPasswordSchema = z.object({
  password: z.string().min(8).max(128),
  clearMfa: z.boolean().optional().default(true),
});

@Controller()
export class AuthController {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly adminPrisma: AdminPrisma,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseAdminClient,
  ) {}

  @Get('auth/me')
  @Roles('ADMIN', 'RESELLER', 'CUSTOMER')
  @AllowAal1()
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      status: user.status,
      resellerStatus: user.resellerStatus,
      aal: user.aal,
    };
  }

  /**
   * Self-service password update (and optional MFA cleanup) that works with an aal1
   * recovery session even when GoTrue has an old TOTP factor enrolled.
   */
  @Post('auth/password')
  @Roles('ADMIN', 'RESELLER', 'CUSTOMER')
  @AllowAal1()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updateOwnPassword(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = selfPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'A nova senha deve ter pelo menos 8 caracteres.',
      });
    }
    try {
      if (parsed.data.clearMfa) {
        await this.supabaseAdmin.unenrollMfaFactors(user.supabaseId).catch(() => undefined);
      }
      if (this.supabaseAdmin.updateUserPassword) {
        await this.supabaseAdmin.updateUserPassword(user.supabaseId, parsed.data.password);
      }
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException({
        code: 'UNAVAILABLE',
        message: 'Não foi possível salvar a nova senha.',
      });
    }
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
