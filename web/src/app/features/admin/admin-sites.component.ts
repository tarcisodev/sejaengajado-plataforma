import { PlatformLocation } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { GooglePlacesService } from '../../core/google/google-places.service';
import { PlaceMatch } from '../../core/google/place-match';
import { Customer, Plan, Site, SiteStatus, Template } from '../../core/models/domain';
import { tenantPreviewUrl } from '../../core/tenant/resolve-host';

@Component({
  selector: 'app-admin-sites',
  imports: [
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmSelectImports,
    HlmSkeleton,
    HlmTableImports,
  ],
  providers: [provideIcons({ lucideSearch }), GooglePlacesService],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-sites.component.html',
})
export class AdminSitesComponent {
  private readonly api = inject(API_PORT);
  private readonly places = inject(GooglePlacesService);
  private readonly platform = inject(PlatformLocation);
  readonly query = signal('');
  readonly status = signal<SiteStatus | ''>('');
  readonly ready = signal(false);
  readonly creating = signal(false);
  readonly mode = signal<'google' | 'manual'>('manual');
  readonly rows = signal<Site[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly templates = signal<Template[]>([]);
  readonly matches = signal<PlaceMatch[]>([]);
  readonly notice = signal('');
  readonly error = signal('');
  readonly googleQuery = signal('');
  readonly customerId = signal('');
  readonly templateId = signal('');
  readonly planId = signal('');
  readonly businessName = signal('');
  readonly phone = signal('');
  readonly street = signal('');
  readonly city = signal('');
  readonly stateCode = signal('');
  readonly postalCode = signal('');
  readonly slug = signal('');
  readonly placeholders = [1, 2, 3];

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      sites: this.api.listSites(),
      plans: this.api.listPlans(),
      customers: this.api.listCustomers(),
      templates: this.api.listTemplates(),
    }).subscribe(({ sites, plans, customers, templates }) => {
      this.rows.set(sites);
      this.plans.set(plans);
      this.customers.set(customers);
      this.templates.set(templates);
      this.customerId.update((current) => current || customers[0]?.id || '');
      this.templateId.update((current) => current || templates[0]?.id || '');
      this.planId.update((current) => current || plans[0]?.id || '');
      this.ready.set(true);
    });
  }

  visible(): Site[] {
    const query = this.query().trim().toLowerCase();
    const status = this.status();
    return this.rows().filter((row) => {
      const name = row.content.businessName.toLowerCase();
      return (
        (!query || name.includes(query) || row.slug.includes(query)) &&
        (!status || row.status === status)
      );
    });
  }

  previewHref(slug: string): string {
    return tenantPreviewUrl(slug, {
      protocol: this.platform.protocol,
      hostname: this.platform.hostname,
      port: this.platform.port,
    });
  }

  planName(planId: string): string {
    return this.plans().find((plan) => plan.id === planId)?.nome ?? planId;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  statusLabel = (value: string | null): string => {
    switch (value) {
      case 'PUBLISHED':
        return 'Publicado';
      case 'READ_ONLY':
        return 'Só leitura';
      case 'SUSPENDED':
        return 'Suspenso';
      case 'DRAFT':
        return 'Rascunho';
      case 'ARCHIVED':
        return 'Arquivado';
      default:
        return 'Todos';
    }
  };

  setStatus(value: string | null | undefined): void {
    this.status.set((value ?? '') as SiteStatus | '');
  }

  tone(status: string): 'destructive' | 'secondary' {
    return status === 'SUSPENDED' || status === 'READ_ONLY' ? 'destructive' : 'secondary';
  }

  suspend(site: Site): void {
    this.api.setSiteStatus(site.id, 'SUSPENDED').subscribe(() => this.reload());
  }

  reactivate(site: Site): void {
    this.api.setSiteStatus(site.id, 'PUBLISHED').subscribe(() => this.reload());
  }

  customerLabel = (value: string | null): string =>
    this.customers().find((customer) => customer.id === value)?.nome ?? 'Cliente';

  templateLabel = (value: string | null): string =>
    this.templates().find((template) => template.id === value)?.nome ?? 'Template';

  planLabel = (value: string | null): string => this.planName(value ?? '');

  openCreate(): void {
    this.error.set('');
    this.notice.set('');
    this.matches.set([]);
    this.mode.set('manual');
    this.googleQuery.set('');
    this.businessName.set('');
    this.phone.set('');
    this.street.set('');
    this.city.set('');
    this.stateCode.set('');
    this.postalCode.set('');
    this.slug.set('');
    this.customerId.set(
      this.customers().find((customer) => customer.id === 'cust_admin')?.id ?? '',
    );
    this.templateId.set(
      this.templates().find((template) => template.id === 'tpl_personalizado')?.id ?? '',
    );
    this.creating.set(true);
  }

  searchGoogle(): void {
    this.notice.set('');
    this.places.search(this.googleQuery()).subscribe({
      next: (rows) => {
        this.matches.set(rows);
        if (rows.length === 1) {
          this.applyPlace(rows[0]);
          return;
        }
        if (rows.length === 0) {
          this.notice.set('Nenhum lugar encontrado.');
        }
      },
      error: (error: Error) => {
        this.matches.set([]);
        this.notice.set(error.message);
      },
    });
  }

  applyPlace(match: PlaceMatch): void {
    this.businessName.set(match.nome);
    this.phone.set(match.telefone);
    this.street.set(match.address.logradouro);
    this.city.set(match.address.cidade);
    this.stateCode.set(match.address.uf);
    this.postalCode.set(match.address.cep ?? '');
    if (!this.slug()) {
      this.slug.set(slugFromName(match.nome));
    }
  }

  save(event: Event): void {
    event.preventDefault();
    this.error.set('');
    this.api
      .createSite({
        customerId: this.customerId(),
        templateId: this.templateId(),
        planId: this.planId(),
        slug: this.slug(),
        businessName: this.businessName(),
        phone: this.phone(),
        address: {
          logradouro: this.street(),
          cidade: this.city(),
          uf: this.stateCode(),
          cep: this.postalCode() || undefined,
        },
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.reload();
        },
        error: (error: Error) => {
          this.error.set(siteError(error.message));
        },
      });
  }
}

function slugFromName(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 31);
}

function siteError(message: string): string {
  if (message === 'slug taken') {
    return 'Esse endereço já está em uso.';
  }
  if (message === 'invalid slug') {
    return 'O endereço do site precisa ter letras minúsculas, números e hífen.';
  }
  return 'Não foi possível criar o site.';
}
