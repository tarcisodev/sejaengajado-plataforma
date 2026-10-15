import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { Public } from '../../auth/public.decorator';
import { PublicSitesService } from './public-sites.service';

@Controller('public')
@Public()
export class PublicSitesController {
  constructor(private readonly sites: PublicSitesService) {}

  @Get('sites/by-host')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async byHost(
    @Query('host') host: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!host?.trim()) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Site não encontrado',
      });
    }

    const { body, etag } = await this.sites.byHost(host);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('ETag', etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return;
    }
    return body;
  }

  @Get('r/:slug/avaliar')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async avaliar(
    @Param('slug') slug: string,
    @Headers('x-forwarded-for') forwarded: string | undefined,
    @Headers('x-real-ip') realIp: string | undefined,
    @Res() res: Response,
  ) {
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
    const url = await this.sites.reviewRedirect(slug, ip);
    return res.redirect(302, url);
  }
}
