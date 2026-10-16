import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArchive, lucideEye, lucideEyeOff, lucideSave } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';

import { Plan, Site, SiteContent, SiteStatus } from '../../core/models/domain';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';

export interface SiteEditorSaveEvent {
  content: SiteContent;
  templateId: string;
}

export interface SiteEditorMetaEvent {
  slug?: string;
  planId?: string;
  status?: SiteStatus;
  customerId?: string;
  resellerId?: string;
}

/**
 * Editor compartilhado (admin / revenda / cliente) — campos do fluxo feliz M1 + FORMULA.
 * Preview ao vivo fica a cargo do hospedeiro (site-page embed).
 */
@Component({
  selector: 'app-site-editor',
  imports: [NgIcon, HlmButton, HlmCardImports, HlmInput, ConfirmActionComponent],
  providers: [provideIcons({ lucideSave, lucideEye, lucideEyeOff, lucideArchive })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './site-editor.component.html',
})
export class SiteEditorComponent implements OnChanges {
  readonly site = input.required<Site>();
  readonly canPublish = input(true);
  readonly canUnpublish = input(false);
  readonly canArchive = input(false);
  readonly busy = input(false);
  /** Admin: show Advanced tab (slug, plan, status, customer, reseller). */
  readonly showAdvanced = input(false);
  readonly plans = input<Plan[]>([]);
  readonly customers = input<{ id: string; nome: string }[]>([]);
  readonly resellers = input<{ id: string; nome: string }[]>([]);

  readonly saved = output<SiteEditorSaveEvent>();
  readonly metaSaved = output<SiteEditorMetaEvent>();
  readonly published = output<void>();
  readonly unpublished = output<void>();
  readonly archived = output<void>();

  readonly tab = signal<'conteudo' | 'formula' | 'avancado'>('conteudo');
  readonly businessName = signal('');
  readonly whatsapp = signal('');
  readonly phone = signal('');
  readonly description = signal('');
  readonly logoUrl = signal('');
  readonly pixKey = signal('');
  readonly pixName = signal('');
  readonly videoId = signal('');
  readonly servicosText = signal('');
  readonly notice = signal('');

  readonly advSlug = signal('');
  readonly advPlanId = signal('');
  readonly advStatus = signal<SiteStatus>('DRAFT');
  readonly advCustomerId = signal('');
  readonly advResellerId = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['site']) {
      this.syncFromSite();
    }
  }

  syncFromSite(): void {
    const site = this.site();
    this.businessName.set(site.content.businessName || site.content.profile?.nome || '');
    this.whatsapp.set(site.content.whatsapp?.numero || '');
    this.phone.set(site.content.phone || site.content.telefone || '');
    this.description.set(site.content.seo?.about || site.content.profile?.slogan || '');
    this.logoUrl.set(site.content.profile?.logoUrl || site.content.gallery?.[0] || '');
    this.pixKey.set(site.content.pix?.chave || '');
    this.pixName.set(site.content.pix?.nome || '');
    this.videoId.set(site.content.video?.youtubeId || '');
    this.servicosText.set((site.content.servicos ?? []).map((s) => s.nome).join('\n'));
    this.advSlug.set(site.slug);
    this.advPlanId.set(site.planId);
    this.advStatus.set(site.status);
    this.advCustomerId.set(site.customerId);
    this.advResellerId.set(site.resellerId ?? '');
  }

  save(): void {
    const site = this.site();
    const logo = this.logoUrl().trim();
    const gallery = logo
      ? [logo, ...(site.content.gallery ?? []).filter((url) => url !== logo)]
      : site.content.gallery;
    const servicos = this.servicosText()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((nome) => ({ nome }));
    const pixKey = this.pixKey().trim();
    const videoId = this.videoId().trim();
    const content: SiteContent = {
      ...site.content,
      businessName: this.businessName().trim() || site.content.businessName,
      phone: this.phone().trim() || undefined,
      profile: {
        ...site.content.profile,
        nome: this.businessName().trim() || site.content.profile.nome,
        slogan: this.description().trim() || site.content.profile.slogan,
        ...(logo ? { logoUrl: logo } : {}),
      },
      gallery,
      whatsapp: this.whatsapp().trim()
        ? {
            numero: this.whatsapp().trim(),
            mensagem: site.content.whatsapp?.mensagem ?? '',
          }
        : site.content.whatsapp,
      pix: pixKey
        ? {
            chave: pixKey,
            nome: this.pixName().trim() || this.businessName().trim() || site.content.businessName,
            qrUrl: site.content.pix?.qrUrl,
          }
        : site.content.pix,
      servicos: servicos.length ? servicos : site.content.servicos,
      video: videoId
        ? { youtubeId: videoId, titulo: site.content.video?.titulo }
        : site.content.video,
      seo: {
        ...site.content.seo,
        about: this.description().trim() || site.content.seo?.about,
      },
    };
    this.saved.emit({ content, templateId: site.templateId });
    this.notice.set('Alterações salvas.');
  }

  saveAdvanced(): void {
    const site = this.site();
    const patch: SiteEditorMetaEvent = {};
    const slug = this.advSlug().trim().toLowerCase();
    if (slug && slug !== site.slug) {
      patch.slug = slug;
    }
    if (this.advPlanId() && this.advPlanId() !== site.planId) {
      patch.planId = this.advPlanId();
    }
    if (this.advStatus() && this.advStatus() !== site.status) {
      patch.status = this.advStatus();
    }
    if (this.advCustomerId() && this.advCustomerId() !== site.customerId) {
      patch.customerId = this.advCustomerId();
    }
    if (this.advResellerId() && this.advResellerId() !== (site.resellerId ?? '')) {
      patch.resellerId = this.advResellerId();
    }
    if (!Object.keys(patch).length) {
      this.notice.set('Nenhuma alteração avançada.');
      return;
    }
    this.metaSaved.emit(patch);
    this.notice.set('Metadados enviados.');
  }
}
