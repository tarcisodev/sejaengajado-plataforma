import { ForbiddenException } from '@nestjs/common';

export function assertResellerOperable(status: string): void {
  if (status === 'BLOCKED') {
    throw new ForbiddenException({
      code: 'RESELLER_BLOCKED',
      message: 'Revendedor bloqueado',
    });
  }
  if (status === 'DELINQUENT') {
    throw new ForbiddenException({
      code: 'RESELLER_DELINQUENT',
      message: 'Revendedor inadimplente',
    });
  }
}
