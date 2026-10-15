export const JOB_MAILER = Symbol('JOB_MAILER');

export type JobEmailBand = 'WARN' | 'READ_ONLY' | 'SUSPENDED' | 'ARCHIVED';

export interface JobMailer {
  sendOverdueWarning(input: {
    to: string;
    resellerId: string;
    band: JobEmailBand;
    daysOverdue: number;
  }): Promise<void>;
}

export class FakeJobMailer implements JobMailer {
  readonly sent: {
    to: string;
    resellerId: string;
    band: JobEmailBand;
    daysOverdue: number;
  }[] = [];

  async sendOverdueWarning(input: {
    to: string;
    resellerId: string;
    band: JobEmailBand;
    daysOverdue: number;
  }): Promise<void> {
    this.sent.push(input);
  }
}

export class NoopJobMailer implements JobMailer {
  async sendOverdueWarning(): Promise<void> {
    // production SMTP wiring is ⏳P15 / 05 — job only needs the seam
  }
}
