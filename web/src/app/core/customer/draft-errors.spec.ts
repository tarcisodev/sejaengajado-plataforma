import { SiteContent } from '../models/domain';
import { siteDraftErrors } from './draft-errors';

describe('siteDraftErrors', () => {
  it('requires the business name and a complete open hour', () => {
    const content = {
      businessName: ' ',
      profile: { nome: ' ', cidade: 'Uberaba', uf: 'MG' },
      theme: {
        p1: '#112233',
        p2: '#445566',
        p3: '#778899',
        on3: '#000000',
        hi: '#ffffff',
        fontHeading: 'Fraunces',
        fontBody: 'Literata',
        fontScale: 1,
        italic: 'normal',
      },
      hours: [{ dias: 'ter', abre: '', fecha: '' }],
    } as SiteContent;

    expect(siteDraftErrors(content)).toContain('Informe o nome do negócio.');
    expect(
      siteDraftErrors(content).some((error) => error.startsWith('Horário incompleto')),
    ).toBeTrue();
  });
});
