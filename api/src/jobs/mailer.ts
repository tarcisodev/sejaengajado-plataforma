export const JOB_MAILER = Symbol('JOB_MAILER');

export interface JobMailer {
  sendOverdueWarning(input: {
    to: string;
    siteId: string;
    daysOverdue: number;
  }): Promise<void>;
}

export class FakeJobMailer implements JobMailer {
  readonly sent: { to: string; siteId: string; daysOverdue: number }[] = [];

  async sendOverdueWarning(input: {
    to: string;
    siteId: string;
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
