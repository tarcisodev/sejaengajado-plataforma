import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';

import { Audit } from '../audit/audit.interceptor';
import { Roles } from '../auth/roles.decorator';
import { StockService } from './stock.service';

@Controller()
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('admin/plaques/stock')
  @Roles('ADMIN')
  adminStock(@Query('resellerId') resellerId: string) {
    return this.stock.listStock(resellerId);
  }

  @Get('admin/plaques/movements')
  @Roles('ADMIN')
  async adminMovements(
    @Query('resellerId') resellerId: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const page = await this.stock.listMovements(resellerId, { limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Post('admin/plaques/movements')
  @Roles('ADMIN')
  @Audit({
    action: 'plaque.movement',
    entity: 'PlaqueMovement',
    entityId: (result) => (result as { id: string }).id,
  })
  adminMove(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.stock.adminMove(body, idempotencyKey);
  }

  @Post('admin/plaques/transfer')
  @Roles('ADMIN')
  @Audit({
    action: 'plaque.transfer',
    entity: 'PlaqueMovement',
    entityId: (result) =>
      (result as { resellerIn?: { id: string } }).resellerIn?.id ?? 'transfer',
  })
  transfer(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.stock.transfer(body, idempotencyKey);
  }

  @Get('reseller/plaques/stock')
  @Roles('RESELLER')
  resellerStock() {
    return this.stock.listStockForCurrent();
  }

  @Get('reseller/plaques/movements')
  @Roles('RESELLER')
  async resellerMovements(
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const page = await this.stock.listMovementsForCurrent({ limit, cursor });
    return { items: page.items, nextCursor: page.nextCursor };
  }

  @Post('reseller/plaques/movements')
  @Roles('RESELLER')
  resellerMove(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.stock.resellerMove(body, idempotencyKey);
  }
}
