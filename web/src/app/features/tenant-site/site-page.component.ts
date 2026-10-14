import { DOCUMENT } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, Renderer2, afterNextRender, inject, signal } from '@angular/core';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Site } from '../../core/models/domain';
import {
  ClockParts,
  aboutText,
  addressLine,
  countdownParts,
  displayName,
  hourLine,
  initials,
  mapsEmbed as mapsEmbedUrl,
  mapsLink as mapsLinkUrl,
  ogImageUrl,
  siteCanonical,
  siteDescription,
  siteJsonLd,
  siteTitle,
  whatsappHref,
} from './site-seo';

@Component({
  selector: 'app-site-page',
  templateUrl: './site-page.component.html',
  styleUrl: './site-page.component.scss',
})
export class SitePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(API_PORT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private templatesSub: Subscription | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private jsonLd: HTMLScriptElement | null = null;

  @Input({ required: true }) site!: Site;

  readonly schemaType = signal('LocalBusiness');
  readonly clock = signal<ClockParts | null>(null);
  readonly copied = signal(false);

  constructor() {
    afterNextRender(() => {
      this.timer = setInterval(() => this.refreshClock(), 1000);
    });
  }

  ngOnInit(): void {
    this.refreshClock();
    this.applyHead(this.schemaType());
    this.templatesSub = this.api.listTemplates().subscribe((templates) => {
      const found = templates.find((item) => item.id === this.site.templateId);
      this.schemaType.set(found?.schemaType ?? 'LocalBusiness');
      this.applyHead(this.schemaType());
    });
  }

  ngOnDestroy(): void {
    this.templatesSub?.unsubscribe();
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.jsonLd?.remove();
    this.document.head.querySelector('link[data-site-canonical]')?.remove();
  }

  nome(): string {
    return displayName(this.site.content);
  }

  initials(): string {
    return initials(this.nome());
  }

  tags(): string[] {
    return (this.site.content.profile.tags ?? []).slice(0, 4);
  }

  about(): string {
    return aboutText(this.site.content);
  }

  addressLine(): string {
    return addressLine(this.site.content);
  }

  mapsEmbed(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(mapsEmbedUrl(this.site.content));
  }

  mapsLink(): string {
    return mapsLinkUrl(this.site.content);
  }

  hourLine = hourLine;

  whatsappHref(): string {
    const whatsapp = this.site.content.whatsapp;
    if (!whatsapp) {
      return '';
    }
    return whatsappHref(whatsapp.numero, whatsapp.mensagem);
  }

  interestHref(nome: string): string {
    const whatsapp = this.site.content.whatsapp;
    if (!whatsapp) {
      return '';
    }
    return whatsappHref(whatsapp.numero, `Tenho interesse em: ${nome}`);
  }

  async copyPix(): Promise<void> {
    const chave = this.site.content.pix?.chave;
    if (!chave || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(chave);
    this.copied.set(true);
  }

  private refreshClock(): void {
    const end = this.site.content.promo?.terminaEm;
    this.clock.set(end ? countdownParts(end) : null);
  }

  private applyHead(schemaType: string): void {
    const content = this.site.content;
    const title = siteTitle(content);
    const description = siteDescription(content);
    const url = siteCanonical(this.site.slug);
    const image = ogImageUrl(content);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:locale', content: 'pt_BR' });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.upsertCanonical(url);
    this.upsertJsonLd(schemaType);
  }

  private upsertCanonical(url: string): void {
    const existing = this.document.head.querySelector('link[data-site-canonical]');
    const link = existing ?? this.renderer.createElement('link');
    this.renderer.setAttribute(link, 'rel', 'canonical');
    this.renderer.setAttribute(link, 'href', url);
    this.renderer.setAttribute(link, 'data-site-canonical', 'true');
    if (!existing) {
      this.renderer.appendChild(this.document.head, link);
    }
  }

  private upsertJsonLd(schemaType: string): void {
    this.jsonLd?.remove();
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    script.type = 'application/ld+json';
    script.setAttribute('data-site-jsonld', 'true');
    script.text = siteJsonLd(this.site.content, this.site.slug, schemaType);
    this.renderer.appendChild(this.document.head, script);
    this.jsonLd = script;
  }
}
