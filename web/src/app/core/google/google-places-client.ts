import { SiteAddress } from '../models/domain';
import { PlaceMatch } from './place-match';

interface PlaceComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface PlaceResult {
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  formattedAddress?: string;
  addressComponents?: PlaceComponent[];
}

interface PlacesTextResponse {
  places?: PlaceResult[];
}

export async function searchPlaces(query: string, apiKey: string): Promise<PlaceMatch[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.nationalPhoneNumber,places.formattedAddress,places.addressComponents',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', regionCode: 'BR' }),
  });
  if (!response.ok) {
    throw new Error('A busca do Google falhou.');
  }
  const body = (await response.json()) as PlacesTextResponse;
  return (body.places ?? []).map(toMatch);
}

export function toMatch(place: PlaceResult): PlaceMatch {
  const component = (type: string, form: 'long' | 'short' = 'long'): string => {
    const found = place.addressComponents?.find((item) => item.types?.includes(type));
    return (form === 'short' ? found?.shortText : found?.longText) ?? '';
  };
  const street = [component('route'), component('street_number')].filter(Boolean).join(', ');
  const address: SiteAddress = {
    logradouro: street || place.formattedAddress || '',
    cidade: component('locality') || component('administrative_area_level_2'),
    uf: component('administrative_area_level_1', 'short'),
    cep: component('postal_code') || undefined,
  };
  return {
    nome: place.displayName?.text ?? '',
    telefone: place.nationalPhoneNumber ?? '',
    address,
  };
}
