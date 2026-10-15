import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { SalesService } from './sales.service';

@Controller('reseller/sales')
@Roles('RESELLER')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@Query('limit') limitRaw?: string, @Query('cursor') cursor?: string) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.sales.list({
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sales.get(id);
  }

  @Post()
  record(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.sales.record(body, idempotencyKey);
  }

  @Post(':id/void')
  voidSale(@Param('id') id: string) {
    return this.sales.void(id);
  }
}
