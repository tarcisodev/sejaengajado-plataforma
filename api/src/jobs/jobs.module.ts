import { Module } from '@nestjs/common';

import { JobsController } from './jobs.controller';
import { JobsScheduler } from './jobs.scheduler';
import { JobsService } from './jobs.service';
import { JOB_MAILER, NoopJobMailer } from './mailer';

@Module({
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsScheduler,
    { provide: JOB_MAILER, useClass: NoopJobMailer },
  ],
  exports: [JobsService, JOB_MAILER],
})
export class JobsModule {}
