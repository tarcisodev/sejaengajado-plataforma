import { PlatformLocation } from '@angular/common';
import { isSlugBlocked, isValidSlug, SlugCheckState, slugHintText } from '../../core/site/slug';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideSearch } from '@ng-icons/lucide';
import { NavigationEnd, Router } from '@angular/router';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Subscription, catchError, filter, forkJoin, of, switchMap } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type { SiteOptionsDto } from '../../core/api/reseller-api.types';
import { GooglePlacesService } from '../../core/google/google-places.service';
import { PlaceMatch } from '../../core/google/place-match';
import { Customer, Plan, Site, SiteStatus, Template } from '../../core/models/domain';
import { siteStatusBadgeVariant, siteStatusLabel } from '../../core/site/site-status-label';
import { tenantPreviewUrl } from '../../core/tenant/resolve-host';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';
import {
  SiteEditorComponent,
  SiteEditorMetaEvent,
  SiteEditorSaveEvent,
} from '../site-editor/site-editor.component';

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
    ConfirmActionComponent,
    SiteEditorComponent,
  ],
  providers: [provideIcons({ lucideSearch, lucidePencil }), GooglePlacesService],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-sites.component.html',
})
export class AdminSitesComponent {
  private readonly api = inject(API_PORT);
  private readonly places = inject(GooglePlacesService);
  private readonly platform = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly query = signal('');
  readonly status = signal<SiteStatus | ''>('');
  readonly ready = signal(false);
  readonly creating = signal(false);
  readonly mode = signal<'google' | 'manual'>('manual');
  readonly rows = signal<Site[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly templates = signal<Template[]>([]);
  readonly resellers = signal<{ id: string; nome: string }[]>([]);
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
  readonly slugBlocked = computed(() => isSlugBlocked(this.slugState()));
  /** Feedback ao vivo do endereço no "Criar site" (GET /admin/slugs/check). */
  readonly slugState = signal<SlugCheckState>('idle');
  readonly slugHint = computed(() => slugHintText(this.slugState()));
  /** Planos e templates ativos para o "Criar site" (GET /admin/site-options). */
  readonly siteOptions = signal<SiteOptionsDto | null>(null);
  readonly createPlans = computed(() => {
    const options = this.siteOptions();
    return options
      ? options.plans.map((plan) => ({ id: plan.id, nome: plan.name }))
      : this.plans().map((plan) => ({ id: plan.id, nome: plan.nome }));
  });
  readonly createTemplates = computed(() => {
    const options = this.siteOptions();
    return options
      ? options.templates.map((template) => ({ id: template.id, nome: template.name }))
      : this.templates().map((template) => ({ id: template.id, nome: template.nome }));
  });
  private slugTimer: ReturnType<typeof setTimeout> | null = null;
  private slugSub: Subscription | null = null;
  readonly placeholders = [1, 2, 3];
  readonly editing = signal<Site | null>(null);
  readonly editorBusy = signal(false);
  readonly statusLabel = siteStatusLabel;
  readonly statusVariant = siteStatusBadgeVariant;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.resetSlugCheck());
    this.syncEditorFromPath();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncEditorFromPath());
    this.reload();
  }

  private syncEditorFromPath(): void {
    const id = siteIdFromPath(this.platform.pathname);
    if (!id) {
      this.editing.set(null);
      return;
    }
    this.editorBusy.set(true);
    this.api.getAdminSite(id).subscribe({
      next: (site) => {
        this.editing.set(site);
        this.editorBusy.set(false);
      },
      error: () => {
        this.editing.set(null);
        this.editorBusy.set(false);
        void this.router.navigateByUrl('/admin/sites');
      },
    });
  }

  openEditor(site: Site): void {
    this.editing.set(site);
    void this.router.navigateByUrl(`/admin/sites/${site.id}`);
  }

  closeEditor(): void {
    this.editing.set(null);
    void this.router.navigateByUrl('/admin/sites');
  }

  onEditorSave(event: SiteEditorSaveEvent): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.updateAdminSiteContent(site.id, event.content, event.templateId).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.editorBusy.set(false);
        this.reload();
      },
      error: () => this.editorBusy.set(false),
    });
  }

  onEditorMeta(event: SiteEditorMetaEvent): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.patchAdminSiteMeta(site.id, event).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.editorBusy.set(false);
        this.reload();
      },
      error: () => this.editorBusy.set(false),
    });
  }

  /** Admin publica direto do editor (com prévia ao vivo): salva o conteúdo e publica. */
  onEditorPublish(event: SiteEditorSaveEvent): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api
      .updateAdminSiteContent(site.id, event.content, event.templateId)
      .pipe(switchMap(() => this.api.publishAdminSite(site.id)))
      .subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.editorBusy.set(false);
        this.reload();
      },
      error: () => this.editorBusy.set(false),
    });
  }

  onEditorUnpublish(): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.unpublishAdminSite(site.id).subscribe({
      next: (updated) => {
        this.editing.set(updated);
        this.editorBusy.set(false);
        this.reload();
      },
      error: () => this.editorBusy.set(false),
    });
  }

  onEditorArchive(): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.archiveAdminSite(site.id).subscribe({
      next: () => {
        this.editorBusy.set(false);
        this.closeEditor();
        this.reload();
      },
      error: () => this.editorBusy.set(false),
    });
  }

  reload(): void {
    forkJoin({
      sites: this.api.listSites(),
      plans: this.api.listPlans(),
      customers: this.api.listCustomers(),
      templates: this.api.listTemplates(),
      resellers: this.api.listResellers(),
      options: this.api.listAdminSiteOptions().pipe(catchError(() => of(null))),
    }).subscribe(({ sites, plans, customers, templates, resellers, options }) => {
      this.rows.set(sites);
      this.siteOptions.set(options);
      this.plans.set(plans);
      this.customers.set(customers);
      this.templates.set(templates);
      this.resellers.set(resellers.map((row) => ({ id: row.id, nome: row.nome })));
      this.customerId.update((current) => current || customers[0]?.id || '');
      this.templateId.update((current) => current || this.createTemplates()[0]?.id || '');
      this.planId.update((current) => current || this.createPlans()[0]?.id || '');
      this.ready.set(true);
    });
  }

  visible(): Site[] {
    const query = (this.query() ?? '').trim().toLowerCase();
    const status = this.status();
    return this.rows().filter((row) => {
      const name = (
        row.content?.businessName ??
        row.content?.profile?.nome ??
        row.slug ??
        ''
      ).toLowerCase();
      const slug = (row.slug ?? '').toLowerCase();
      return (
        (!query || name.includes(query) || slug.includes(query)) &&
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

  filterStatusLabel = (value: string | null): string => {
    if (!value) {
      return 'Todos';
    }
    return siteStatusLabel(value);
  };

  setStatus(value: string | null | undefined): void {
    this.status.set((value ?? '') as SiteStatus | '');
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
    this.createTemplates().find((template) => template.id === value)?.nome ?? 'Template';

  planLabel = (value: string | null): string =>
    this.createPlans().find((plan) => plan.id === value)?.nome ?? this.planName(value ?? '');

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
    this.resetSlugCheck();
    this.customerId.set(
      this.customers().find((customer) => customer.id === 'cust_admin')?.id ??
        this.customers()[0]?.id ??
        '',
    );
    this.templateId.set(
      this.createTemplates().find((template) => template.id === 'tpl_personalizado')?.id ??
        this.createTemplates()[0]?.id ??
        '',
    );
    this.planId.set(this.planId() || this.createPlans()[0]?.id || '');
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
      this.setSlug(slugFromName(match.nome));
    }
  }

  onSlugInput(event: Event): void {
    this.setSlug(this.inputValue(event));
  }

  /** Atualiza o slug e agenda a checagem de disponibilidade (debounce). */
  setSlug(raw: string): void {
    const slug = raw.trim().toLowerCase();
    this.slug.set(slug);
    this.resetSlugCheck();
    if (!slug) {
      return;
    }
    if (!isValidSlug(slug)) {
      this.slugState.set('invalid');
      return;
    }
    this.slugState.set('checking');
    this.slugTimer = setTimeout(() => {
      this.slugTimer = null;
      this.slugSub = this.api.checkAdminSlug(slug).subscribe({
        next: (result) => {
          if (this.slug() === slug) {
            this.slugState.set(result.available ? 'available' : 'unavailable');
          }
        },
        error: () => {
          if (this.slug() === slug) {
            this.slugState.set('idle');
          }
        },
      });
    }, 350);
  }

  private resetSlugCheck(): void {
    if (this.slugTimer) {
      clearTimeout(this.slugTimer);
      this.slugTimer = null;
    }
    this.slugSub?.unsubscribe();
    this.slugSub = null;
    this.slugState.set('idle');
  }

  save(event: Event): void {
    event.preventDefault();
    this.error.set('');
    const slugState = this.slugState();
    if (isSlugBlocked(slugState)) {
      this.error.set(
        slugState === 'checking' ? 'Aguarde a verificação do endereço.' : this.slugHint(),
      );
      return;
    }
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
        next: (created) => {
          this.creating.set(false);
          this.editing.set(created);
          this.reload();
          void this.router.navigateByUrl(`/admin/sites/${created.id}`);
        },
        error: (error: Error) => {
          this.error.set(siteError(error.message));
        },
      });
  }
}

function siteIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  // /admin/sites/:id (UUID em produção; ids mock site_*)
  if (parts[0] === 'admin' && parts[1] === 'sites' && parts[2]) {
    const id = parts[2];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return id;
    }
    if (/^[a-z][a-z0-9_-]*$/i.test(id)) {
      return id;
    }
  }
  return null;
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
