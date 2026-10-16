import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, InjectionToken, inject, signal } from '@angular/core';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { BrnDialogContent } from '@spartan-ng/brain/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { PlaquePenaltyQuote } from '../../core/api/plaque-penalty';
import { AuthService } from '../../core/auth/auth.service';
import { canEditSite, renewalLeadDays } from '../../core/customer/access';
import { siteDraftErrors } from '../../core/customer/draft-errors';
import { Cancellation, Site, SiteContent, SiteHours, Template } from '../../core/models/domain';
import { themeForTemplate } from '../../mocks/site-bios';
import { formatBrl } from '../landing/landing-seo';
import { SitePageComponent } from '../tenant-site/site-page.component';

const UPLOAD_ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const CUSTOMER_TODAY = new InjectionToken<Date>('CUSTOMER_TODAY');

@Component({
  selector: 'app-customer-studio',
  imports: [
    SitePageComponent,
    BrnAlertDialogContent,
    BrnDialogContent,
    HlmAlertDialogImports,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmCheckbox,
    HlmDialogImports,
    HlmFieldImports,
    HlmInput,
    HlmSelectImports,
    HlmTabsImports,
    HlmTextarea,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './customer-studio.component.html',
})
export class CustomerStudioComponent {
  private readonly api = inject(API_PORT);
  private readonly auth = inject(AuthService);
  readonly today = inject(CUSTOMER_TODAY, { optional: true }) ?? new Date();
  readonly formatBrl = formatBrl;
  readonly steps = ['Negócio', 'Links', 'Horários', 'Fotos', 'Modelo', 'Publicar'];
  readonly stepKeys: readonly string[] = [
    'negocio',
    'links',
    'horarios',
    'fotos',
    'modelo',
    'publicar',
  ];
  readonly step = signal(0);
  readonly sites = signal<Site[]>([]);
  readonly templates = signal<Template[]>([]);
  readonly draft = signal<Site | null>(null);
  readonly errors = signal<string[]>([]);
  readonly message = signal('');
  readonly quote = signal<PlaquePenaltyQuote | null>(null);
  readonly cancellation = signal<Cancellation | null>(null);
  readonly changeNote = signal('');
  readonly changeSent = signal(false);
  readonly monthlySent = signal(false);

  constructor() {
    if (!this.auth.me()) {
      return;
    }
    forkJoin({
      sites: this.api.listMySites(),
      templates: this.api.listCustomerTemplates(),
    }).subscribe(({ sites, templates }) => {
      this.templates.set(templates);
      this.sites.set(sites);
      if (sites.length === 1) {
        this.open(sites[0]);
      }
    });
  }

  readonly siteLabel = (id: string): string => {
    const site = this.sites().find((item) => item.id === id);
    return site ? `${site.content.businessName} · ${site.status}` : '';
  };

  readonly templateLabel = (id: string): string =>
    this.templates().find((item) => item.id === id)?.nome ?? '';

  activate(tab: string): void {
    const index = this.stepKeys.indexOf(tab);
    if (index >= 0) {
      this.step.set(index);
    }
  }

  openId(id: string | null | undefined): void {
    if (!id) {
      return;
    }
    const site = this.sites().find((item) => item.id === id);
    if (!site || site.id === this.draft()?.id) {
      return;
    }
    this.open(site);
  }

  open(site: Site): void {
    this.draft.set(structuredClone(site));
    this.errors.set([]);
    this.message.set('');
    this.cancellation.set(null);
    this.quote.set(null);
    this.changeSent.set(false);
    this.monthlySent.set(false);
    if (site.plaqueFidelityEndsAt) {
      this.api.quotePlaquePenalty(site.id, this.today).subscribe((quote) => this.quote.set(quote));
    }
  }

  editing(): boolean {
    const site = this.draft();
    return Boolean(site && canEditSite(site));
  }

  renewalDays(): number | null {
    return renewalLeadDays(this.draft()?.hostingRenewsAt ?? null, this.today);
  }

  renewalDate(): string {
    return civilLabel(this.draft()?.hostingRenewsAt);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  inputChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  rename(name: string): void {
    this.patch((content) => ({
      ...content,
      businessName: name,
      profile: { ...content.profile, nome: name },
    }));
  }

  patchProfile(field: 'slogan' | 'cidade' | 'uf', value: string): void {
    this.patch((content) => ({ ...content, profile: { ...content.profile, [field]: value } }));
  }

  patchAddress(value: string): void {
    this.patch((content) => ({
      ...content,
      address: {
        logradouro: value,
        cidade: content.profile.cidade,
        uf: content.profile.uf,
        cep: content.address?.cep,
      },
    }));
  }

  patchWhatsapp(numero: string): void {
    this.patch((content) => ({
      ...content,
      whatsapp: { numero, mensagem: content.whatsapp?.mensagem ?? 'Olá' },
    }));
  }

  patchPhone(phone: string): void {
    this.patch((content) => ({ ...content, phone }));
  }

  instagram(): string {
    return this.draft()?.content.links?.find((link) => link.tipo === 'instagram')?.url ?? '';
  }

  patchInstagram(url: string): void {
    this.patch((content) => {
      const links = [...(content.links ?? [])];
      const index = links.findIndex((link) => link.tipo === 'instagram');
      const next = { tipo: 'instagram' as const, titulo: 'Instagram', url };
      if (index >= 0) {
        links[index] = next;
      } else if (url.trim()) {
        links.push(next);
      }
      return { ...content, links };
    });
  }

  patchHour(index: number, field: keyof SiteHours, value: string | boolean): void {
    this.patch((content) => {
      const hours = (content.hours ?? []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      );
      return { ...content, hours };
    });
  }

  addHour(): void {
    this.patch((content) => ({
      ...content,
      hours: [...(content.hours ?? []), { dias: '', abre: '09:00', fecha: '18:00' }],
    }));
  }

  patchPhoto(index: number, url: string): void {
    this.patch((content) => {
      const gallery = [...(content.gallery ?? [])];
      gallery[index] = url;
      return { ...content, gallery };
    });
  }

  addPhoto(): void {
    this.patch((content) => ({ ...content, gallery: [...(content.gallery ?? []), ''] }));
  }

  patchColor(field: 'p1' | 'p2' | 'p3', value: string): void {
    this.patch((content) => ({ ...content, theme: { ...content.theme, [field]: value } }));
  }

  setTemplate(templateId: string | null | undefined): void {
    const current = this.draft();
    if (!templateId) {
      return;
    }
    if (!current) {
      return;
    }
    this.draft.set({
      ...current,
      templateId,
      content: { ...current.content, theme: themeForTemplate(templateId) },
    });
  }

  save(): void {
    const site = this.draft();
    if (!site || !this.editing()) {
      return;
    }
    const errors = siteDraftErrors(site.content);
    this.errors.set(errors);
    if (errors.length) {
      return;
    }
    this.api.updateSiteContent(site.id, site.content, site.templateId).subscribe({
      next: (saved) => {
        this.draft.set(saved);
        this.replaceSite(saved);
        this.message.set('Alterações salvas.');
        toast.success('Alterações salvas.');
      },
      error: (error: unknown) => this.toastApiError(error, 'Não foi possível salvar.'),
    });
  }

  publish(): void {
    const site = this.draft();
    if (!site || !this.editing()) {
      return;
    }
    const errors = siteDraftErrors(site.content);
    this.errors.set(errors);
    if (errors.length) {
      return;
    }
    this.api.updateSiteContent(site.id, site.content, site.templateId).subscribe({
      next: (saved) => {
        this.api.publishSite(saved.id).subscribe({
          next: (published) => {
            this.draft.set(published);
            this.replaceSite(published);
            this.message.set('Site publicado.');
            toast.success('Site publicado.');
          },
          error: (error: unknown) => this.toastApiError(error, 'Não foi possível publicar.'),
        });
      },
      error: (error: unknown) => this.toastApiError(error, 'Não foi possível salvar.'),
    });
  }

  onPhotoSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.editing()) {
      return;
    }
    if (!UPLOAD_ALLOWED.has(file.type)) {
      toast.error('Use JPEG, PNG ou WebP.');
      this.errors.set(['Use JPEG, PNG ou WebP.']);
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error('Arquivo muito grande (máximo 5 MB).');
      this.errors.set(['Arquivo muito grande (máximo 5 MB).']);
      return;
    }
    this.api
      .presignCustomerUpload({
        contentType: file.type,
        contentLength: file.size,
        filename: file.name,
      })
      .subscribe({
        next: (presign) => {
          this.patchPhoto(index, presign.publicUrl);
          this.errors.set([]);
          toast.success('Foto pronta para salvar.');
        },
        error: (error: unknown) => this.toastApiError(error, 'Upload inválido.'),
      });
  }

  confirmCancel(): void {
    const site = this.draft();
    if (!site) {
      return;
    }
    this.api.cancelSite(site.id, this.today).subscribe((cancellation) => {
      this.cancellation.set(cancellation);
    });
  }

  askChange(): void {
    const site = this.draft();
    const user = this.auth.me();
    if (!site || !user) {
      return;
    }
    if (!this.changeNote().trim()) {
      this.errors.set(['Descreva a alteração.']);
      toast.error('Descreva a alteração.');
      return;
    }
    this.api.requestSiteChange(site.id, user.id, this.changeNote()).subscribe(() => {
      this.errors.set([]);
      this.changeSent.set(true);
      toast.success('Pedido enviado ao suporte.');
    });
  }

  askMonthly(): void {
    const site = this.draft();
    const user = this.auth.me();
    if (!site || !user) {
      return;
    }
    this.api.requestMonthlyPlan(site.id, user.id).subscribe(() => {
      this.monthlySent.set(true);
      toast.success('Pedido do plano mensal registrado.');
    });
  }

  private patch(update: (content: SiteContent) => SiteContent): void {
    const current = this.draft();
    if (!current || !canEditSite(current)) {
      return;
    }
    this.draft.set({ ...current, content: update(current.content) });
  }

  private replaceSite(site: Site): void {
    this.sites.set(this.sites().map((item) => (item.id === site.id ? site : item)));
  }

  private toastApiError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { code?: string; message?: string } | null;
      if (body?.code === 'SITE_NOT_EDITABLE') {
        toast.error(body.message ?? 'Este site está em modo só leitura.');
        this.message.set(body.message ?? 'Este site está em modo só leitura.');
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

function civilLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
