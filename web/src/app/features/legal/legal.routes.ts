import { Routes } from '@angular/router';

import { LegalPageComponent } from './legal-page.component';

/** Páginas públicas jurídicas (apex e app.). */
export const legalRoutes: Routes = [
  { path: 'termos', component: LegalPageComponent, data: { legalSlug: 'termos' } },
  { path: 'privacidade', component: LegalPageComponent, data: { legalSlug: 'privacidade' } },
  { path: 'uso-aceitavel', component: LegalPageComponent, data: { legalSlug: 'uso-aceitavel' } },
  { path: 'cobranca', component: LegalPageComponent, data: { legalSlug: 'cobranca' } },
  {
    path: 'contrato-revenda',
    component: LegalPageComponent,
    data: { legalSlug: 'contrato-revenda' },
  },
];
