import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlaceMatch } from './place-match';

@Injectable()
export class GooglePlacesService {
  search(query: string): Observable<PlaceMatch[]> {
    const key = environment.googlePlacesApiKey.trim();
    const text = query.trim();
    if (!key) {
      return throwError(() => new Error('Busca do Google indisponível: falta a chave.'));
    }
    if (!text) {
      return throwError(() => new Error('Informe o nome do negócio.'));
    }
    return new Observable((subscriber) => {
      void import('./google-places-client')
        .then((client) => client.searchPlaces(text, key))
        .then(
          (rows) => {
            subscriber.next(rows);
            subscriber.complete();
          },
          (error: unknown) => subscriber.error(error),
        );
    });
  }
}
