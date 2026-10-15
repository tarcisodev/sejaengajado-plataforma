import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../../auth/roles.decorator';
import { Audit } from '../../audit/audit.interceptor';
import {
  createResellerSchema,
  patchResellerSchema,
  ResellersService,
} from './resellers.service';

@Controller()
@Roles('ADMIN')
export class ResellersController {
  constructor(private readonly resellers: ResellersService) {}

  @Get('admin/resellers')
  async list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : 20;
    const page = await this.resellers.list({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Post('admin/resellers')
  @Audit({
    action: 'reseller.create',
    entity: 'Reseller',
    entityId: (result) => (result as { id: string }).id,
  })
  async create(@Body() body: unknown) {
    const parsed = createResellerSchema.safeParse(body);
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
    return this.resellers.create(parsed.data);
  }

  @Get('admin/resellers/:id')
  get(@Param('id') id: string) {
    return this.resellers.get(id);
  }

  @Patch('admin/resellers/:id')
  @Audit({ action: 'reseller.update', entity: 'Reseller', entityId: (_r, req) => req.params.id })
  async patch(@Param('id') id: string, @Body() body: unknown) {
    const parsed = patchResellerSchema.safeParse(body);
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
    return this.resellers.patch(id, parsed.data);
  }

  @Post('admin/resellers/:id/block')
  @Audit({ action: 'reseller.block', entity: 'Reseller', entityId: (_r, req) => req.params.id })
  block(@Param('id') id: string, @Body() body: unknown) {
    return this.resellers.block(id, body);
  }

  @Post('admin/resellers/:id/unblock')
  @Audit({ action: 'reseller.unblock', entity: 'Reseller', entityId: (_r, req) => req.params.id })
  unblock(@Param('id') id: string) {
    return this.resellers.unblock(id);
  }

  @Post('admin/resellers/:id/suspend-sites')
  @Audit({
    action: 'reseller.suspend_sites',
    entity: 'Reseller',
    entityId: (_r, req) => req.params.id,
  })
  suspendSites(@Param('id') id: string) {
    return this.resellers.suspendSites(id);
  }

  @Post('admin/resellers/:id/offer-migration')
  @Audit({
    action: 'reseller.offer_migration',
    entity: 'Reseller',
    entityId: (_r, req) => req.params.id,
  })
  offerMigration(@Param('id') id: string) {
    return this.resellers.offerMigration(id);
  }

  @Get('admin/resellers/:id/summary')
  summary(@Param('id') id: string) {
    return this.resellers.summary(id);
  }

  @Post('admin/resellers/:id/impersonate')
  @Audit({
    action: 'reseller.impersonate',
    entity: 'Reseller',
    entityId: (_r, req) => req.params.id,
  })
  impersonate(@Param('id') id: string) {
    return this.resellers.impersonate(id);
  }

  @Post('admin/plaques/movements')
  @Audit({
    action: 'plaque.movement',
    entity: 'PlaqueMovement',
    entityId: (result) => (result as { id: string }).id,
  })
  plaqueMovement(@Body() body: unknown) {
    return this.resellers.createPlaqueMovement(body);
  }

  @Get('admin/reseller-plans')
  listPlans() {
    return this.resellers.listPlans();
  }

  @Post('admin/reseller-plans')
  @Audit({
    action: 'reseller_plan.create',
    entity: 'ResellerPlan',
    entityId: (result) => (result as { id: string }).id,
  })
  createPlan(@Body() body: unknown) {
    return this.resellers.createPlan(body);
  }

  @Patch('admin/reseller-plans/:id')
  @Audit({
    action: 'reseller_plan.update',
    entity: 'ResellerPlan',
    entityId: (_r, req) => req.params.id,
  })
  patchPlan(@Param('id') id: string, @Body() body: unknown) {
    return this.resellers.patchPlan(id, body);
  }
}
