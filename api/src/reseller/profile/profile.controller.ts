import { Body, Controller, Get, Patch } from '@nestjs/common';

import { Roles } from '../../auth/roles.decorator';
import { Audit } from '../../audit/audit.interceptor';
import { ResellerProfileService } from './profile.service';

@Controller('reseller')
@Roles('RESELLER')
export class ResellerProfileController {
  constructor(private readonly profile: ResellerProfileService) {}

  @Get('me')
  getMe() {
    return this.profile.getMe();
  }

  @Patch('me')
  @Audit({ action: 'reseller.self_update', entity: 'Reseller' })
  patchMe(@Body() body: unknown) {
    return this.profile.patchMe(body);
  }
}
