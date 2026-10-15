import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reseller')
@Roles('RESELLER')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboardForCurrent();
  }

  @Get('reports/sales')
  salesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.salesReportForCurrent({ from, to, cursor, limit });
  }
}
