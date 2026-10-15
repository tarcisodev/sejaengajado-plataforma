import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { LedgerService } from './ledger.service';

function parseOptionalDate(raw: string | undefined, path: string): Date | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path, code: 'invalid_date', message: 'Data inválida' }],
    });
  }
  return date;
}

@Controller('reseller/ledger')
@Roles('RESELLER')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  statement(
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.ledger.statement({
      from: parseOptionalDate(fromRaw, 'from'),
      to: parseOptionalDate(toRaw, 'to'),
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Get('balance')
  balance(@Query('at') atRaw?: string) {
    return this.ledger.balance(parseOptionalDate(atRaw, 'at')).then((balanceCents) => ({
      balanceCents,
    }));
  }

  @Post('entries')
  createManual(@CurrentUser() _user: AuthUser, @Body() body: unknown) {
    return this.ledger.appendManual(body);
  }

  @Post('entries/:id/reverse')
  reverse(@Param('id') id: string) {
    return this.ledger.reverse(id);
  }
}
