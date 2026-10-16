import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Roles } from '../auth/roles.decorator';
import type { PlaceMatch } from './place-match';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('search')
  @Roles('ADMIN', 'RESELLER')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  search(@Query('q') q: string): Promise<PlaceMatch[]> {
    return this.places.search(q ?? '');
  }
}
