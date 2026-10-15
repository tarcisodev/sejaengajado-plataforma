import { Component, InjectionToken, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { PlaquePenaltyQuote } from '../../core/api/plaque-penalty';
import { canEditSite, renewalLeadDays } from '../../core/customer/access';
import { siteDraftErrors } from '../../core/customer/draft-errors';
import { Cancellation, Site, SiteContent, SiteHours, Template } from '../../core/models/domain';
import { themeForTemplate } from '../../mocks/site-bios';
import { formatBrl } from '../landing/landing-seo';
import { SitePageComponent } from '../tenant-site/site-page.component';
import { CustomerSession } from './customer-session';

export const CUSTOMER_TODAY = new InjectionToken<Date>('CUSTOMER_TODAY');

@Component({
  selector: 'app-customer-studio',
  imports: [SitePageComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './customer-studio.component.html',
})
export class CustomerStudioComponent {
  private readonly api = inject(API_PORT);
  private readonly session = inject(CustomerSession);
  readonly today = inject(CUSTOMER_TODAY, { optional: true }) ?? new Date();
  readonly formatBrl = formatBrl;
  readonly steps = ['Negócio', 'Links', 'Horários', 'Fotos', 'Modelo', 'Publicar'];
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
    const user = this.session.user();
    if (!user) {
      return;
    }
    forkJoin({
      customers: this.api.listCustomers(),
      templates: this.api.listTemplates(),
    }).subscribe(({ customers, templates }) => {
      this.templates.set(templates);
      const customer = customers.find((item) => item.userId === user.id);
      if (!customer) {
        return;
      }
      this.api.listSitesByCustomer(customer.id).subscribe((sites) => {
        this.sites.set(sites);
        if (sites.length === 1) {
          this.open(sites[0]);
        }
      });
    });
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

  setTemplate(templateId: string): void {
    const current = this.draft();
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
    this.api.updateSiteContent(site.id, site.content, site.templateId).subscribe((saved) => {
      this.draft.set(saved);
      this.replaceSite(saved);
      this.message.set('Alterações salvas.');
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
    this.api.updateSiteContent(site.id, site.content, site.templateId).subscribe((saved) => {
      this.api.publishSite(saved.id).subscribe((published) => {
        this.draft.set(published);
        this.replaceSite(published);
        this.message.set('Site publicado.');
      });
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
    const user = this.session.user();
    if (!site || !user) {
      return;
    }
    if (!this.changeNote().trim()) {
      this.errors.set(['Descreva a alteração.']);
      return;
    }
    this.api.requestSiteChange(site.id, user.id, this.changeNote()).subscribe(() => {
      this.errors.set([]);
      this.changeSent.set(true);
    });
  }

  askMonthly(): void {
    const site = this.draft();
    const user = this.session.user();
    if (!site || !user) {
      return;
    }
    this.api.requestMonthlyPlan(site.id, user.id).subscribe(() => this.monthlySent.set(true));
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
}

function civilLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
