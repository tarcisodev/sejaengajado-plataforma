import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ENV, type Env } from '../config/env';
import type { PlaceMatch } from './place-match';
import { searchPlaces } from './places-client';

@Injectable()
export class PlacesService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async search(query: string): Promise<PlaceMatch[]> {
    const text = query.trim();
    if (!text) {
      throw new BadRequestException({
        code: 'PLACES_QUERY_REQUIRED',
        message: 'Informe o nome do negócio.',
      });
    }

    const key = this.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException({
        code: 'PLACES_UNAVAILABLE',
        message: 'Busca do Google indisponível: falta a chave.',
      });
    }

    try {
      return await searchPlaces(text, key);
    } catch {
      throw new ServiceUnavailableException({
        code: 'PLACES_UPSTREAM_FAILED',
        message: 'A busca do Google falhou.',
      });
    }
  }
}
