import { Provider } from '@angular/core';

import { API_PORT } from './api-port';
import { HttpApiService } from './http-api.service';

export const httpApiProviders: Provider[] = [
  HttpApiService,
  { provide: API_PORT, useExisting: HttpApiService },
];

export const apiProviders = httpApiProviders;
