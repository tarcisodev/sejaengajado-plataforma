import { Provider } from '@angular/core';

import { environment } from '../../../environments/environment';
import { httpApiProviders } from './api.providers.http';
import { mockApiProviders } from './api.providers.mock';

export const apiProviders: Provider[] = environment.apiUrl ? httpApiProviders : mockApiProviders;
