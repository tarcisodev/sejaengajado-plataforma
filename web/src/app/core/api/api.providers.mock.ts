import { Provider } from '@angular/core';

import { MockApiService } from '../../mocks/mock-api.service';
import { API_PORT } from './api-port';

export const mockApiProviders: Provider[] = [
  MockApiService,
  { provide: API_PORT, useExisting: MockApiService },
];
