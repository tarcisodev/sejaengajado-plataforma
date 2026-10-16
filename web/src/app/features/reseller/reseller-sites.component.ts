import { HttpErrorResponse } from '@angular/common/http';
import { isValidSlug, slugHintText } from '../../core/site/slug';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideExternalLink,
  lucideEye,
  lucidePencil,
  lucidePlus,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin, switchMap } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type {
  ResellerCustomerDto,
  ResellerSiteDto,
  SiteOptionsDto,
} from '../../core/api/reseller-api.types';
import { AuthService } from '../../core/auth/auth.service';
import type { Site } from '../../core/models/domain';
import { siteStatusBadgeVariant, siteStatusLabel } from '../../core/site/site-status-label';
import { normalizeSiteContent } from '../../core/api/public-site.mapper';
import { normalizeWhatsapp } from '../../core/site/site-content';
import { SiteEditorComponent, SiteEditorSaveEvent } from '../site-editor/site-editor.component';
import { SitePageComponent } from '../tenant-site/site-page.component';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';
import { formatBrl } from '../landing/landing-seo';
import { plaqueNfcPayload, plaqueReviewUrl, plaqueSiteUrl } from './plaque-links';
import { qrPngDataUrl, qrSvg } from './qr-code';

type WizardStep = 'cliente' | 'template' | 'conteudo' | 'slug' | 'previa';
type PlaqueType = 'QR' | 'NFC';

@Component({
  selector: 'app-reseller-sites',
  imports: [
    NgIcon,
    HlmAlert,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmTableImports,
    ConfirmActionComponent,
    SiteEditorComponent,
    SitePageComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideExternalLink,
      lucideEye,
      lucidePencil,
      lucidePlus,
    }),
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
  readonly editing = signal<Site | null>(null);
  readonly editorBusy = signal(false);
  readonly customerId = signal('');
  readonly newCustomerName = signal('');
  readonly newCustomerWhatsapp = signal('');
  readonly planId = signal('');
  readonly templateId = signal('');
  readonly slug = signal('');
  readonly slugHint = signal('');
  readonly slugOk = signal(false);
  readonly draft = signal<ResellerSiteDto | null>(null);
  /** Site do rascunho para o site-editor (fixo durante o passo Conteúdo). */
  readonly draftSite = signal<Site | null>(null);
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
    this.draftSite.set(null);
    this.slug.set('');
    this.slugHint.set('');
    this.slugOk.set(false);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.draft.set(null);
    this.draftSite.set(null);
    this.reload();
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

  /** Passo 2 → cria (ou atualiza) o rascunho DRAFT com slug sugerido e vai para o Conteúdo. */
  nextFromTemplate(): void {
    if (!this.planId() || !this.templateId()) {
      toast.error('Escolha plano e template.');
      return;
    }
    if (!this.operable() || this.busy()) {
      return;
    }
    const existing = this.draft();
    this.busy.set(true);
    if (existing) {
      this.api
        .patchResellerSite(existing.id, { planId: this.planId(), templateId: this.templateId() })
        .subscribe({
          next: (site) => this.afterDraftSaved(site, 'conteudo'),
          error: (error: unknown) => this.failBusy(error, 'Não foi possível salvar o rascunho.'),
        });
      return;
    }
    const customer = this.customers().find((row) => row.id === this.customerId());
    const name = customer?.name?.trim() || 'Meu negócio';
    const base = slugify(name);
    const template = this.options()?.templates.find((item) => item.id === this.templateId());
    const content: Record<string, unknown> = {
      businessName: name,
      profile: { nome: name, cidade: customer?.city?.trim() || '', uf: '' },
      theme: { niche: template?.niche || 'generico' },
      ...(customer?.whatsapp
        ? {
            whatsapp: {
              numero: normalizeWhatsapp(customer.whatsapp),
              mensagem: 'Olá! Vim pelo site.',
            },
          }
        : {}),
      ...(customer?.email ? { email: customer.email } : {}),
    };
    this.findFreeSlug(base, 0, (slug) => {
      this.api
        .createResellerSite({
          customerId: this.customerId(),
          slug,
          planId: this.planId(),
          templateId: this.templateId(),
          content,
        })
        .subscribe({
          next: (site) => {
            this.slug.set(site.slug);
            this.slugOk.set(true);
            this.slugHint.set('');
            this.afterDraftSaved(site, 'conteudo');
            toast.success('Rascunho criado. Agora preencha o conteúdo.');
          },
          error: (error: unknown) => this.failBusy(error, 'Não foi possível criar o rascunho.'),
        });
    });
  }

  /** Tenta base, base-2, base-3… e por fim um sufixo aleatório. */
  private findFreeSlug(base: string, attempt: number, done: (slug: string) => void): void {
    const candidate =
      attempt === 0
        ? base
        : attempt < 4
          ? `${base.slice(0, 27)}-${attempt + 1}`
          : `${base.slice(0, 26)}-${Math.random().toString(36).slice(2, 6)}`;
    this.api.checkResellerSlug(candidate).subscribe({
      next: (result) => {
        if (result.available || attempt >= 5) {
          done(candidate);
          return;
        }
        this.findFreeSlug(base, attempt + 1, done);
      },
      error: () => done(candidate),
    });
  }

  private afterDraftSaved(site: ResellerSiteDto, nextStep?: WizardStep): void {
    this.busy.set(false);
    this.draft.set(site);
    // O editor em modo wizard só ressincroniza quando o id muda; manter o site atualizado
    // garante que voltar ao passo Conteúdo reabra com o rascunho salvo.
    this.draftSite.set(toPreviewSite(site));
    if (nextStep) {
      this.step.set(nextStep);
    }
  }

  private failBusy(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.toastApiError(error, fallback);
  }

  /** Rascunho salvo a cada aba do Conteúdo (Identidade → Contato → Módulos). */
  onWizardContentSave(event: SiteEditorSaveEvent, nextStep?: WizardStep): void {
    const site = this.draft();
    if (!site) {
      return;
    }
    this.busy.set(true);
    this.api
      .patchResellerSite(site.id, {
        content: event.content as unknown as Record<string, unknown>,
        templateId: event.templateId,
      })
      .subscribe({
        next: (updated) => {
          this.afterDraftSaved(updated, nextStep);
          if (nextStep) {
            this.slug.set(updated.slug);
            this.slugOk.set(true);
          }
        },
        error: (error: unknown) => this.failBusy(error, 'Não foi possível salvar o rascunho.'),
      });
  }

  onSlugInput(event: Event): void {
    this.slug.set(slugify((event.target as HTMLInputElement).value, false));
    this.slugOk.set(false);
    this.slugHint.set('');
  }

  checkSlug(): void {
    const value = this.slug();
    const current = this.draft()?.slug;
    if (value && value === current) {
      this.slugOk.set(true);
      this.slugHint.set('Este é o endereço atual do rascunho.');
      return;
    }
    if (!isValidSlug(value)) {
      this.slugHint.set(slugHintText('invalid'));
      this.slugOk.set(false);
      return;
    }
    this.api.checkResellerSlug(value).subscribe((result) => {
      this.slugOk.set(result.available);
      this.slugHint.set(
        slugHintText(result.available ? 'available' : 'unavailable'),
      );
    });
  }

  /** Passo 4: confirma/troca o slug do rascunho e vai para a Prévia. */
  confirmSlug(): void {
    const site = this.draft();
    if (!site || this.busy()) {
      return;
    }
    const value = this.slug();
    if (value === site.slug) {
      this.step.set('previa');
      return;
    }
    if (!this.slugOk()) {
      this.checkSlug();
      return;
    }
    this.busy.set(true);
    this.api.patchResellerSite(site.id, { slug: value }).subscribe({
      next: (updated) => {
        this.afterDraftSaved(updated, 'previa');
      },
      error: (error: unknown) => this.failBusy(error, 'Não foi possível trocar o endereço.'),
    });
  }

  openEditor(row: ResellerSiteDto): void {
    this.editing.set(toPreviewSite(row));
  }

  closeEditor(): void {
    this.editing.set(null);
  }

  onEditorSave(event: SiteEditorSaveEvent): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api
      .patchResellerSite(site.id, {
        content: event.content as unknown as Record<string, unknown>,
        templateId: event.templateId,
      })
      .subscribe({
        next: (updated) => {
          this.editing.set(toPreviewSite(updated));
          this.editorBusy.set(false);
          this.reload();
          toast.success('Conteúdo salvo.');
        },
        error: (error: unknown) => {
          this.editorBusy.set(false);
          this.toastApiError(error, 'Não foi possível salvar.');
        },
      });
  }

  /** Salva o conteúdo atual do editor e publica. */
  onEditorPublish(event: SiteEditorSaveEvent): void {
    const site = this.editing();
    if (!site || !this.operable()) {
      return;
    }
    this.editorBusy.set(true);
    this.api
      .patchResellerSite(site.id, {
        content: event.content as unknown as Record<string, unknown>,
        templateId: event.templateId,
      })
      .pipe(switchMap(() => this.api.publishResellerSite(site.id)))
      .subscribe({
        next: (updated) => {
          this.editing.set(toPreviewSite(updated));
          this.editorBusy.set(false);
          this.reload();
          toast.success('Site publicado.');
        },
        error: (error: unknown) => {
          this.editorBusy.set(false);
          this.toastApiError(error, 'Não foi possível publicar.');
        },
      });
  }

  onEditorUnpublish(): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.unpublishResellerSite(site.id).subscribe({
      next: (updated) => {
        this.editing.set(toPreviewSite(updated));
        this.editorBusy.set(false);
        this.reload();
        toast.success('Site despublicado.');
      },
      error: () => {
        this.editorBusy.set(false);
        toast.error('Não foi possível despublicar.');
      },
    });
  }

  onEditorArchive(): void {
    const site = this.editing();
    if (!site) {
      return;
    }
    this.editorBusy.set(true);
    this.api.deleteResellerSite(site.id).subscribe({
      next: () => {
        this.editorBusy.set(false);
        this.closeEditor();
        this.reload();
        toast.success('Site arquivado.');
      },
      error: () => {
        this.editorBusy.set(false);
        toast.error('Não foi possível arquivar.');
      },
    });
  }

  publishDraft(): void {
    const site = this.draft();
    if (!site || !this.operable() || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.publishResellerSite(site.id).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.draft.set(updated);
        toast.success(`Site publicado em ${this.publicUrl(updated.slug)}`);
        this.wizardOpen.set(false);
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toastApiError(error, 'Não foi possível publicar.');
      },
    });
  }

  /** Sai do wizard mantendo o rascunho salvo. */
  saveDraftAndExit(): void {
    toast.success('Rascunho salvo. Você pode continuar depois em Sites.');
    this.closeWizard();
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

/** "Pizzaria Bella Vista!" → "pizzaria-bella-vista" (3–31 chars). */
function slugify(value: string, pad = true): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .slice(0, 31);
  if (!pad) {
    return slug;
  }
  const trimmed = slug.replace(/-$/, '');
  return trimmed.length >= 3 ? trimmed : `${trimmed || 'site'}-bio`.slice(0, 31);
}

function toPreviewSite(row: ResellerSiteDto): Site {
  const content = normalizeSiteContent(row.content ?? {}, row.slug);
  const raw = (row.content ?? {}) as Record<string, unknown>;
  if (!content.whatsapp?.numero) {
    const wa = raw['whatsapp'] as Record<string, unknown> | undefined;
    if (typeof wa?.['e164'] === 'string') {
      content.whatsapp = { numero: wa['e164'], mensagem: 'Olá! Vim pelo site.' };
    }
  }
  if (!raw['businessName'] && row.customer?.name) {
    content.businessName = row.customer.name;
    content.profile = { ...content.profile, nome: row.customer.name };
  }
  return {
    id: row.id,
    customerId: row.customerId,
    resellerId: row.resellerId,
    slug: row.slug,
    customDomain: null,
    templateId: row.templateId,
    content,
    status: row.status as Site['status'],
    planId: row.planId,
    editable: row.editable,
    publishedAt: row.publishedAt,
    hostingRenewsAt: row.hostingRenewsAt,
    plaqueFidelityEndsAt: row.plaqueFidelityEndsAt,
  };
}
