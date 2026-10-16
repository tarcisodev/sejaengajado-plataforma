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
import { formatBrl } from '../landing/landing-seo';

type WizardStep = 'cliente' | 'template' | 'conteudo' | 'slug' | 'previa';

@Component({
  selector: 'app-reseller-sites',
  imports: [HlmAlert, HlmBadge, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reseller-sites.component.html',
})
export class ResellerSitesComponent {
  private readonly api = inject(API_PORT);
  private readonly auth = inject(AuthService);
  readonly formatBrl = formatBrl;
  readonly rows = signal<ResellerSiteDto[]>([]);
  readonly customers = signal<ResellerCustomerDto[]>([]);
  readonly options = signal<SiteOptionsDto | null>(null);
  readonly step = signal<WizardStep>('cliente');
  readonly wizardOpen = signal(false);
  readonly customerId = signal('');
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
    if (!this.customerId()) {
      toast.error('Selecione um cliente.');
      return;
    }
    this.step.set('template');
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
    const niche = this.niche() || 'generico';
    const content: Record<string, unknown> = {
      theme: { niche },
      pix: {
        key: this.pixKey().trim() || 'exemplo-chave-pix',
        receiverName: 'exemplo',
      },
    };
    const review = this.googleReviewUrl().trim();
    if (review) {
      content['googleReviewUrl'] = review;
    }
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
