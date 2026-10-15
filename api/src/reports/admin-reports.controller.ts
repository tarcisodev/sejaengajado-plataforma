import { Controller, Get, Param, Query } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('admin/resellers')
@Roles('ADMIN')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.reports.dashboardForReseller(id);
  }

  @Get(':id/reports/sales')
  salesReport(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.salesReportForReseller(id, from, to);
  }
}
