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
import {
  lucideArchive,
  lucideEye,
  lucideEyeOff,
  lucideSave,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';

import { Site, SiteContent } from '../../core/models/domain';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';

export type SiteEditorSaveEvent = { content: SiteContent; templateId: string };

/**
 * Editor compartilhado (admin / revenda / cliente) — campos do fluxo feliz M1.
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

  readonly saved = output<SiteEditorSaveEvent>();
  readonly published = output<void>();
  readonly unpublished = output<void>();
  readonly archived = output<void>();

  readonly businessName = signal('');
  readonly whatsapp = signal('');
  readonly phone = signal('');
  readonly description = signal('');
  readonly logoUrl = signal('');
  readonly notice = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['site']) {
      this.syncFromSite();
    }
  }

  syncFromSite(): void {
    const site = this.site();
    this.businessName.set(site.content.businessName || site.content.profile?.nome || '');
    this.whatsapp.set(site.content.whatsapp?.numero || '');
    this.phone.set(site.content.phone || '');
    this.description.set(site.content.seo?.about || site.content.profile?.slogan || '');
    this.logoUrl.set(site.content.profile?.logoUrl || site.content.gallery?.[0] || '');
  }

  save(): void {
    const site = this.site();
    const logo = this.logoUrl().trim();
    const gallery = logo
      ? [logo, ...(site.content.gallery ?? []).filter((url) => url !== logo)]
      : site.content.gallery;
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
      seo: {
        ...site.content.seo,
        about: this.description().trim() || site.content.seo?.about,
      },
    };
    this.saved.emit({ content, templateId: site.templateId });
    this.notice.set('Alterações salvas.');
  }
}
