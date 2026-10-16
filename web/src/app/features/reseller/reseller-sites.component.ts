import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type {
  ResellerCustomerDto,
  ResellerSiteDto,
  SiteOptionsDto,
} from '../../core/api/reseller-api.types';
import { AuthService } from '../../core/auth/auth.service';
import type { Site, SiteContent } from '../../core/models/domain';
import { siteStatusBadgeVariant, siteStatusLabel } from '../../core/site/site-status-label';
import { SitePageComponent } from '../tenant-site/site-page.component';
import { formatBrl } from '../landing/landing-seo';
import { plaqueNfcPayload, plaqueReviewUrl, plaqueSiteUrl } from './plaque-links';
import { qrPngDataUrl, qrSvg } from './qr-code';

type WizardStep = 'cliente' | 'template' | 'conteudo' | 'slug' | 'previa';
type PlaqueType = 'QR' | 'NFC';

@Component({
  selector: 'app-reseller-sites',
  imports: [
    HlmAlert,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmTableImports,
    SitePageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reseller-sites.component.html',
})
export class ResellerSitesComponent {
  private readonly api = inject(API_PORT);
  private readonly auth = inject(AuthService);
  readonly formatBrl = formatBrl;
  readonly rows = signal<ResellerSiteDto[]>([]);
  readonly query = signal('');
  readonly customers = signal<ResellerCustomerDto[]>([]);
  readonly options = signal<SiteOptionsDto | null>(null);
  readonly statusLabel = siteStatusLabel;
  readonly statusVariant = siteStatusBadgeVariant;
  readonly step = signal<WizardStep>('cliente');
  readonly wizardOpen = signal(false);
  readonly customerId = signal('');
  readonly newCustomerName = signal('');
  readonly newCustomerWhatsapp = signal('');
  readonly planId = signal('');
  readonly templateId = signal('');
  readonly niche = signal('generico');
  readonly pixKey = signal('');
  readonly googleReviewUrl = signal('');
  readonly slug = signal('');
  readonly slugHint = signal('');
  readonly slugOk = signal(false);
  readonly draft = signal<ResellerSiteDto | null>(null);
  readonly busy = signal(false);
  readonly plaqueSite = signal<ResellerSiteDto | null>(null);
  readonly plaqueType = signal<PlaqueType>('QR');
  readonly plaqueSvg = signal('');
  readonly plaquePng = signal('');
  readonly plaqueBusy = signal(false);
  readonly previewSite = computed(() => {
    const draft = this.draft();
    return draft ? toPreviewSite(draft) : null;
  });
  readonly plaqueReviewLink = computed(() => {
    const site = this.plaqueSite();
    return site ? plaqueReviewUrl(site.slug) : '';
  });
  readonly plaqueSiteLink = computed(() => {
    const site = this.plaqueSite();
    return site ? plaqueSiteUrl(site.slug) : '';
  });
  readonly plaqueNfcLink = computed(() => {
    const site = this.plaqueSite();
    return site ? plaqueNfcPayload(site.slug) : '';
  });

  readonly operable = computed(() => {
    const status = this.auth.me()?.resellerStatus ?? 'ACTIVE';
    return status !== 'DELINQUENT' && status !== 'BLOCKED';
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      sites: this.api.listResellerSites(),
      customers: this.api.listResellerCustomers(),
      options: this.api.listResellerSiteOptions(),
    }).subscribe(({ sites, customers, options }) => {
      this.rows.set(sites.items);
      this.customers.set(customers.items);
      this.options.set(options);
      if (!this.customerId() && customers.items[0]) {
        this.customerId.set(customers.items[0].id);
      }
      if (!this.planId() && options.plans[0]) {
        this.planId.set(options.plans[0].id);
      }
      if (!this.templateId() && options.templates[0]) {
        this.templateId.set(options.templates[0].id);
        this.niche.set(options.templates[0].niche || 'generico');
      }
    });
  }

  openWizard(): void {
    if (!this.operable()) {
      return;
    }
    this.wizardOpen.set(true);
    this.step.set('cliente');
    this.draft.set(null);
    this.slug.set('');
    this.slugHint.set('');
    this.slugOk.set(false);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
  }

  nextFromCliente(): void {
    if (this.customerId()) {
      this.step.set('template');
      return;
    }
    const name = this.newCustomerName().trim();
    if (!name) {
      toast.error('Selecione um cliente ou informe o nome do negócio.');
      return;
    }
    this.busy.set(true);
    this.api
      .createResellerCustomer({
        name,
        whatsapp: this.newCustomerWhatsapp().trim() || undefined,
      })
      .subscribe({
        next: (customer) => {
          this.busy.set(false);
          this.customers.update((rows) => [customer, ...rows]);
          this.customerId.set(customer.id);
          this.newCustomerName.set('');
          this.newCustomerWhatsapp.set('');
          this.step.set('template');
        },
        error: () => {
          this.busy.set(false);
          toast.error('Não foi possível criar o cliente.');
        },
      });
  }

  nextFromTemplate(): void {
    if (!this.planId() || !this.templateId()) {
      toast.error('Escolha plano e template.');
      return;
    }
    const template = this.options()?.templates.find((item) => item.id === this.templateId());
    if (template?.niche) {
      this.niche.set(template.niche);
    }
    this.step.set('conteudo');
  }

  nextFromConteudo(): void {
    this.step.set('slug');
  }

  onSlugInput(event: Event): void {
    this.slug.set((event.target as HTMLInputElement).value.trim().toLowerCase());
    this.slugOk.set(false);
    this.slugHint.set('');
  }

  checkSlug(): void {
    const value = this.slug();
    if (!value) {
      this.slugHint.set('Informe o slug.');
      this.slugOk.set(false);
      return;
    }
    this.api.checkResellerSlug(value).subscribe((result) => {
      this.slugOk.set(result.available);
      this.slugHint.set(
        result.available ? 'Slug disponível.' : `Slug indisponível (${result.code ?? 'erro'}).`,
      );
    });
  }

  createDraft(): void {
    if (!this.operable() || !this.slugOk() || this.busy()) {
      return;
    }
    this.busy.set(true);
    const customer = this.customers().find((row) => row.id === this.customerId());
    const businessName = customer?.name || this.slug();
    const reviewUrl = this.googleReviewUrl().trim();
    // Payload alinhado ao siteContentSchema da Nest (não ao SiteContent do mock).
    const content: Record<string, unknown> = {
      theme: { niche: 'generico', brandColor: '#1e3a5f' },
      pix: {
        key: this.pixKey().trim() || '',
        receiverName: businessName,
      },
      ...(reviewUrl ? { googleReviewUrl: reviewUrl } : {}),
    };
    this.api
      .createResellerSite({
        customerId: this.customerId(),
        slug: this.slug(),
        planId: this.planId(),
        templateId: this.templateId(),
        content,
      })
      .subscribe({
        next: (site) => {
          this.busy.set(false);
          this.draft.set(site);
          this.step.set('previa');
          this.reload();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.toastApiError(error, 'Não foi possível criar o site.');
        },
      });
  }

  publishDraft(): void {
    const site = this.draft();
    if (!site || !this.operable()) {
      return;
    }
    this.busy.set(true);
    this.api.publishResellerSite(site.id).subscribe({
      next: () => {
        this.busy.set(false);
        toast.success('Site publicado.');
        this.wizardOpen.set(false);
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toastApiError(error, 'Não foi possível publicar.');
      },
    });
  }

  publish(siteId: string): void {
    if (!this.operable()) {
      return;
    }
    this.api.publishResellerSite(siteId).subscribe({
      next: () => {
        toast.success('Site publicado.');
        this.reload();
      },
      error: (error: unknown) => this.toastApiError(error, 'Não foi possível publicar.'),
    });
  }

  unpublish(siteId: string): void {
    this.api.unpublishResellerSite(siteId).subscribe({
      next: () => {
        toast.success('Site despublicado.');
        this.reload();
      },
      error: () => toast.error('Não foi possível despublicar.'),
    });
  }

  publicUrl(slug: string): string {
    return `https://${slug}.sejaengajado.com.br`;
  }

  visibleRows(): ResellerSiteDto[] {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return this.rows();
    }
    return this.rows().filter((row) => {
      const customer = row.customer?.name?.toLowerCase() ?? '';
      return (
        row.slug.includes(q) || customer.includes(q) || row.customerId.toLowerCase().includes(q)
      );
    });
  }

  openPlaque(site: ResellerSiteDto): void {
    this.plaqueSite.set(site);
    this.plaqueType.set('QR');
    void this.refreshPlaqueQr();
  }

  closePlaque(): void {
    this.plaqueSite.set(null);
    this.plaqueSvg.set('');
    this.plaquePng.set('');
  }

  onPlaqueTypeChange(event: Event): void {
    this.plaqueType.set((event.target as HTMLSelectElement).value as PlaqueType);
  }

  async refreshPlaqueQr(): Promise<void> {
    const url = this.plaqueReviewLink();
    if (!url) {
      return;
    }
    const [svg, png] = await Promise.all([qrSvg(url), qrPngDataUrl(url)]);
    this.plaqueSvg.set(svg);
    this.plaquePng.set(png);
  }

  assignPlaque(): void {
    const site = this.plaqueSite();
    if (!site || this.plaqueBusy() || !this.operable()) {
      return;
    }
    this.plaqueBusy.set(true);
    const key = crypto.randomUUID();
    this.api
      .recordResellerPlaqueMovement(
        {
          type: 'OUT',
          plaqueType: this.plaqueType(),
          qty: 1,
          reason: 'ASSIGN',
          siteId: site.id,
        },
        key,
      )
      .subscribe({
        next: () => {
          this.plaqueBusy.set(false);
          toast.success('Placa registrada no estoque (saída).');
        },
        error: (error: unknown) => {
          this.plaqueBusy.set(false);
          this.toastApiError(error, 'Não foi possível baixar a placa do estoque.');
        },
      });
  }

  downloadPlaqueSvg(): void {
    const svg = this.plaqueSvg();
    const site = this.plaqueSite();
    if (!svg || !site) {
      return;
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `placa-${site.slug}.svg`;
    a.click();
    URL.revokeObjectURL(href);
  }

  downloadPlaquePng(): void {
    const png = this.plaquePng();
    const site = this.plaqueSite();
    if (!png || !site) {
      return;
    }
    const a = document.createElement('a');
    a.href = png;
    a.download = `placa-${site.slug}.png`;
    a.click();
  }

  onCustomerChange(event: Event): void {
    this.customerId.set((event.target as HTMLSelectElement).value);
  }

  onPlanChange(event: Event): void {
    this.planId.set((event.target as HTMLSelectElement).value);
  }

  onTemplateChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.templateId.set(id);
    const template = this.options()?.templates.find((item) => item.id === id);
    if (template?.niche) {
      this.niche.set(template.niche);
    }
  }

  private toastApiError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { code?: string; message?: string } | null;
      if (body?.code === 'RESELLER_DELINQUENT' || body?.code === 'RESELLER_BLOCKED') {
        toast.error(body.message ?? 'Conta do revendedor bloqueada para esta ação.');
        return;
      }
      if (body?.message) {
        toast.error(body.message);
        return;
      }
    }
    toast.error(fallback);
  }
}

function defaultPreviewTheme(): SiteContent['theme'] {
  return {
    p1: '#1e3a5f',
    p2: '#3d5a4c',
    p3: '#d5e2dc',
    on3: '#102018',
    hi: '#f4f7f6',
    fontHeading: 'Fraunces, Palatino, serif',
    fontBody: 'Literata, Georgia, serif',
    fontScale: 1,
    italic: 'normal',
  };
}

function toPreviewSite(row: ResellerSiteDto): Site {
  const raw = (row.content ?? {}) as Partial<SiteContent> & Record<string, unknown>;
  const profile = (raw['profile'] ?? {}) as Partial<SiteContent['profile']>;
  const themeRaw = (raw['theme'] ?? {}) as Partial<SiteContent['theme']>;
  const pixRaw = (raw['pix'] ?? {}) as Record<string, unknown>;
  const waRaw = (raw['whatsapp'] ?? {}) as Record<string, unknown>;
  const businessName = String(raw['businessName'] ?? row.customer?.name ?? row.slug);
  return {
    id: row.id,
    customerId: row.customerId,
    resellerId: row.resellerId,
    slug: row.slug,
    customDomain: null,
    templateId: row.templateId,
    content: {
      businessName,
      profile: {
        nome: String(profile?.nome ?? businessName),
        cidade: String(profile?.cidade ?? ''),
        uf: String(profile?.uf ?? ''),
      },
      theme: {
        ...defaultPreviewTheme(),
        ...themeRaw,
        italic: themeRaw.italic === 'italic' ? 'italic' : 'normal',
      },
      whatsapp:
        typeof waRaw['numero'] === 'string'
          ? {
              numero: waRaw['numero'],
              mensagem: String(waRaw['mensagem'] ?? 'Olá! Vim pelo site.'),
            }
          : typeof waRaw['e164'] === 'string'
            ? {
                numero: String(waRaw['e164']),
                mensagem: 'Olá! Vim pelo site.',
              }
            : undefined,
      pix: {
        chave: String(pixRaw['chave'] ?? pixRaw['key'] ?? 'exemplo-chave-pix'),
        nome: String(pixRaw['nome'] ?? pixRaw['receiverName'] ?? 'exemplo'),
      },
      google: raw['google'] as SiteContent['google'],
    },
    status: row.status as Site['status'],
    planId: row.planId,
    editable: row.editable,
    publishedAt: row.publishedAt,
    hostingRenewsAt: row.hostingRenewsAt,
    plaqueFidelityEndsAt: row.plaqueFidelityEndsAt,
  };
}
