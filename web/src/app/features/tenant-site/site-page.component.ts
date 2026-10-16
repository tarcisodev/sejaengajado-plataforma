import { NgStyle } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Renderer2,
  SimpleChanges,
  afterNextRender,
  inject,
  signal,
  DOCUMENT,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';

import { Site } from '../../core/models/domain';
import { resolveTheme, themeToCssVars } from '../../core/theme/niche-themes';
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
  schemaTypeForContent,
  siteCanonical,
  siteDescription,
  siteJsonLd,
  siteTitle,
  whatsappHref,
} from './site-seo';
import { OpenNowStatus, openNowStatus } from './site-open-now';
import { AnimatedStripComponent } from './ui/animated-strip.component';
import { SectionDividerComponent } from './ui/section-divider.component';

@Component({
  selector: 'app-site-page',
  imports: [NgStyle, SectionDividerComponent, AnimatedStripComponent],
  templateUrl: './site-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './site-page.component.scss',
})
export class SitePageComponent implements OnChanges, OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private timer: ReturnType<typeof setInterval> | null = null;
  private jsonLd: HTMLScriptElement | null = null;

  @Input({ required: true }) site!: Site;
  @Input() embed = false;

  readonly schemaType = signal('LocalBusiness');
  readonly clock = signal<ClockParts | null>(null);
  readonly copied = signal(false);
  readonly themeVars = signal<Record<string, string>>({});
  readonly mapLoaded = signal(false);
  readonly mapSrc = signal<SafeResourceUrl | null>(null);
  readonly openNow = signal<OpenNowStatus | null>(null);
  readonly categoryFilter = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.timer = setInterval(() => this.refreshClock(), 1000);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['site']) {
      this.syncTheme();
      this.mapLoaded.set(false);
      this.mapSrc.set(null);
      this.refreshOpenNow();
      this.categoryFilter.set(null);
    }
  }

  ngOnInit(): void {
    this.syncTheme();
    this.refreshOpenNow();
    this.refreshClock();
    // schemaType comes from public by-host — never call /admin or /customer/templates on tenant SSR.
    this.schemaType.set(schemaTypeForContent(this.site.content, this.site.schemaType));
    if (!this.embed) {
      this.applyHead(this.schemaType());
    }
  }

  private syncTheme(): void {
    if (!this.site) {
      return;
    }
    this.themeVars.set(themeToCssVars(resolveTheme(this.site.content)));
  }

  private refreshOpenNow(): void {
    if (!this.site) {
      this.openNow.set(null);
      return;
    }
    this.openNow.set(
      openNowStatus(
        this.site.content.weeklyHours,
        this.site.content.timezone ?? 'America/Sao_Paulo',
      ),
    );
  }

  loadMap(): void {
    if (!this.site?.content.address) {
      return;
    }
    this.mapSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(mapsEmbedUrl(this.site.content)));
    this.mapLoaded.set(true);
  }

  categories(): string[] {
    const tags = new Set<string>();
    for (const product of this.site.content.products ?? []) {
      if (product.categoria) {
        tags.add(product.categoria);
      }
    }
    return [...tags];
  }

  filteredProducts() {
    const products = this.site.content.products ?? [];
    const filter = this.categoryFilter();
    if (!filter) {
      return products;
    }
    return products.filter((item) => item.categoria === filter);
  }

  setCategory(category: string | null): void {
    this.categoryFilter.set(category);
  }

  googleRatingLabel(): string {
    const rating = this.site.content.google?.rating;
    return typeof rating === 'number' && Number.isFinite(rating) ? rating.toFixed(1) : '—';
  }

  googleReviewCountLabel(): string {
    const count = this.site.content.google?.reviewCount;
    return typeof count === 'number' && Number.isFinite(count) ? String(count) : '—';
  }

  pixIsExample(): boolean {
    const chave = this.site.content.pix?.chave?.toLowerCase() ?? '';
    const nome = this.site.content.pix?.nome?.toLowerCase() ?? '';
    return chave.includes('exemplo') || nome.includes('exemplo') || !chave;
  }

  ngOnDestroy(): void {
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
    if (!chave) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(chave);
      } else {
        const input = this.document.createElement('textarea');
        input.value = chave;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        this.document.body.appendChild(input);
        input.select();
        this.document.execCommand('copy');
        input.remove();
      }
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
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
    this.meta.updateTag({
      name: 'robots',
      content: 'index, follow, max-image-preview:large',
    });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:locale', content: 'pt_BR' });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:site_name', content: 'Seja Engajado' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
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
