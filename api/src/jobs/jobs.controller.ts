import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';

import { Audit } from '../audit/audit.interceptor';
import { Roles } from '../auth/roles.decorator';
import { JobsService } from './jobs.service';

const runBodySchema = z.object({
  now: z.string().datetime().optional(),
});

@Controller('admin/jobs')
@Roles('ADMIN')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('run')
  @Audit({
    action: 'jobs.run',
    entity: 'Job',
    entityId: () => 'lifecycle',
  })
  run(@Body() body: unknown) {
    const parsed = runBodySchema.safeParse(body ?? {});
    const now = parsed.success && parsed.data.now ? new Date(parsed.data.now) : new Date();
    return this.jobs.runOnce(now);
  }
}
