import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlaceMatch } from './place-match';

@Injectable()
export class GooglePlacesService {
  private readonly http = inject(HttpClient);

  search(query: string): Observable<PlaceMatch[]> {
    const text = query.trim();
    if (!text) {
      return throwError(() => new Error('Informe o nome do negócio.'));
    }

    const base = environment.apiUrl.replace(/\/$/, '');
    if (!base) {
      return throwError(() => new Error('Busca do Google indisponível: aponte o web para a API.'));
    }

    return this.http.get<PlaceMatch[]>(`${base}/places/search`, { params: { q: text } }).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const message =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'A busca do Google falhou.';
          return throwError(() => new Error(message));
        }
        return throwError(() => new Error('A busca do Google falhou.'));
      }),
    );
  }
}
