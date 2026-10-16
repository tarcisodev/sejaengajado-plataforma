import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import type { Site } from '../../core/models/domain';
import { MockApiService } from '../../mocks/mock-api.service';
import { SiteEditorComponent } from './site-editor.component';

describe('SiteEditorComponent (#45)', () => {
  let fixture: ComponentFixture<SiteEditorComponent>;
  let api: MockApiService;
  let sites: Site[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SiteEditorComponent],
      providers: [
        provideRouter([]),
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
      ],
    });
    api = TestBed.inject(MockApiService);
    api.listSites().subscribe((rows) => (sites = rows));
  });

  function mount(site: Site, showAdvanced = false): void {
    fixture = TestBed.createComponent(SiteEditorComponent);
    fixture.componentRef.setInput('site', site);
    fixture.componentRef.setInput('showAdvanced', showAdvanced);
    fixture.detectChanges();
  }

  function el(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  it('renders the shared editor with live preview and labelled actions', () => {
    mount(sites[0]);
    expect(el('[data-site-editor]')).toBeTruthy();
    expect(el('[data-action="publish"]')).toBeTruthy();
    expect(fixture.componentInstance.tabs().map((t) => t.key)).toEqual([
      'identidade',
      'contato',
      'modulos',
    ]);
  });

  it('checks admin slug availability live, excluding the current site', fakeAsync(() => {
    const [site, other] = sites;
    const check = spyOn(api, 'checkAdminSlug').and.callThrough();
    mount(site, true);
    fixture.componentInstance.tab.set('avancado');
    fixture.detectChanges();

    const input = el('[data-field="advSlug"]') as HTMLInputElement;
    const hint = () => el('[data-advanced-panel] [data-slug-hint]')?.textContent ?? '';

    input.value = other.slug;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(hint()).toContain('Verificando');
    tick(350);
    fixture.detectChanges();
    expect(check).toHaveBeenCalledWith(other.slug, site.id);
    expect(hint()).toContain('Endereço indisponível');

    input.value = 'endereco-livre-45';
    input.dispatchEvent(new Event('input'));
    tick(350);
    fixture.detectChanges();
    expect(hint()).toContain('Endereço disponível');

    input.value = 'a!';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(hint()).toContain('Use de 3 a 31');

    // Voltar ao slug atual não consulta a API nem mostra aviso.
    check.calls.reset();
    input.value = site.slug;
    input.dispatchEvent(new Event('input'));
    tick(350);
    fixture.detectChanges();
    expect(check).not.toHaveBeenCalled();
    expect(hint().trim()).toBe('');
  }));

  it('blocks saving advanced meta while the slug is unavailable', fakeAsync(() => {
    const [site, other] = sites;
    mount(site, true);
    const emitted: unknown[] = [];
    fixture.componentInstance.metaSaved.subscribe((event) => emitted.push(event));
    fixture.componentInstance.tab.set('avancado');
    fixture.detectChanges();

    const input = el('[data-field="advSlug"]') as HTMLInputElement;
    input.value = other.slug;
    input.dispatchEvent(new Event('input'));
    tick(350);
    fixture.componentInstance.saveAdvanced();
    expect(emitted).toEqual([]);
    expect(fixture.componentInstance.notice()).toContain('indisponível');
  }));
});
