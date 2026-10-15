import { Body, Controller, Get, Headers, Put } from '@nestjs/common';

import { Audit } from '../../audit/audit.interceptor';
import { Roles } from '../../auth/roles.decorator';
import { PlatformConfigService } from './config.service';

@Controller('admin/config')
@Roles('ADMIN')
export class PlatformConfigController {
  constructor(private readonly config: PlatformConfigService) {}

  @Get()
  get() {
    return this.config.get();
  }

  @Put()
  @Audit({
    action: 'config.update',
    entity: 'PlatformConfig',
    entityId: () => 'default',
  })
  put(
    @Body() body: unknown,
    // Idempotent by body: same payload → same row (upsert).
    @Headers('idempotency-key') _idempotencyKey?: string,
  ) {
    return this.config.put(body);
  }
}
