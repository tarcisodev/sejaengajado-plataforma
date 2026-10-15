import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';

@Controller('admin/audit-logs')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'limit', code: 'invalid', message: 'Limite inválido' }],
      });
    }
    try {
      const page = await this.audit.list({ limit, cursor });
      return {
        items: page.items.map((row) => ({
          id: row.id,
          actorId: row.actorId,
          role: row.role,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          diff: row.diff,
          ip: row.ip,
          createdAt: row.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      };
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'cursor', code: 'invalid', message: 'Cursor inválido' }],
      });
    }
  }
}
