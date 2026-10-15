import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/public.decorator';
import { READY_PROBE, type ReadyProbe } from './ready';

@Controller('health')
@SkipThrottle()
@Public()
export class HealthController {
  constructor(@Inject(READY_PROBE) private readonly ready: ReadyProbe) {}

  @Get()
  @HttpCode(200)
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readyCheck(): Promise<{ status: 'ok' }> {
    const ok = await this.ready.check();
    if (!ok) {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok' };
  }
}
