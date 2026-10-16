import { isSlugBlocked, isValidSlug, SlugCheckState, slugHintText } from '../../core/site/slug';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideArrowLeft,
  lucideArrowRight,
  lucideEye,
  lucideEyeOff,
  lucideImagePlus,
  lucideMapPin,
  lucidePlus,
  lucideSave,
  lucideSmartphone,
  lucideTrash2,
  lucideUpload,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import type { Subscription } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';

import type {
  Plan,
  Site,
  SiteContent,
  SiteGalleryImage,
  SiteLink,
  SiteProduct,
  SiteSocial,
  SiteStatus,
  SiteTheme,
  SiteWeeklyHours,
  WeekdayKey,
} from '../../core/models/domain';
import {
  INVALID_URL_SCHEME_MESSAGE,
  WEEKDAYS,
  centsToInput,
  defaultWeeklyHours,
  formatCents,
  galleryImages,
  legacyHoursOf,
  looksLikeUrl,
  mapsSearchUrl,
  mapsUrlOf,
  normalizeUrl,
  normalizeWhatsapp,
  parseBrlToCents,
  pixKeyOf,
  pixNameOf,
  productAlt,
  productCents,
  testimonialsOf,
  weeklyHoursOf,
} from '../../core/site/site-content';
import {
  ImageKind,
  ImageUploadService,
  UPLOAD_ACCEPT,
  UploadScope,
} from '../../core/upload/image-upload';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';
import { SitePageComponent } from '../tenant-site/site-page.component';

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

/** Feedback ao vivo do slug no Avançado (admin). */
export type { SlugCheckState } from '../../core/site/slug';

/** edit = painel (admin/revendedor/Estúdio); wizard = passo Conteúdo do Novo site. */
export type SiteEditorMode = 'edit' | 'wizard';
export type SiteEditorTab = 'identidade' | 'contato' | 'modulos' | 'avancado';

type NicheKey = NonNullable<SiteTheme['niche']>;

interface DayDraft {
  open: boolean;
  from: string;
  to: string;
}

interface ProductDraft {
  base: Partial<SiteProduct>;
  categoria: string;
  nome: string;
  descricao: string;
  /** Input em reais, pt-BR ("29,90"). Convertido para centavos ao salvar. */
  price: string;
  fotoUrl: string;
  fotoAlt: string;
}

interface LinkDraft {
  base: Partial<SiteLink>;
  titulo: string;
  url: string;
}

interface EditorDraft {
  businessName: string;
  slogan: string;
  about: string;
  logoUrl: string;
  logoAlt: string;
  coverUrl: string;
  coverAlt: string;
  niche: NicheKey;
  brandColor: string;
  cidade: string;
  uf: string;

  whatsapp: string;
  whatsappMsg: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  website: string;
  logradouro: string;
  bairro: string;
  cep: string;
  mapsUrl: string;
  hasHours: boolean;
  week: Record<WeekdayKey, DayDraft>;
  hoursNote: string;
  googleReviewUrl: string;

  catalog: boolean;
  products: ProductDraft[];
  gallery: boolean;
  photos: SiteGalleryImage[];
  pix: boolean;
  pixKey: string;
  pixName: string;
  links: boolean;
  linkItems: LinkDraft[];
  testimonials: boolean;
  testimonialItems: { name: string; text: string }[];
}

type DraftKey = keyof EditorDraft;

const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'site'] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

export const NICHE_CHOICES: { value: NicheKey; label: string }[] = [
  { value: 'generico', label: 'Geral' },
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'restaurante', label: 'Restaurante / Lanchonete' },
  { value: 'moda', label: 'Moda / Loja' },
  { value: 'beleza', label: 'Beleza / Estética' },
  { value: 'saude', label: 'Saúde / Clínica' },
];

export const BRAND_SWATCHES = [
  '#1e3a5f',
  '#0f766e',
  '#7c3aed',
  '#be123c',
  '#c2410c',
  '#15803d',
  '#111827',
  '#b45309',
];

const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const TAB_ORDER: SiteEditorTab[] = ['identidade', 'contato', 'modulos'];

function errorTab(key: string): SiteEditorTab {
  const root = key.split('.')[0];
  if (
    [
      'businessName',
      'slogan',
      'about',
      'logoUrl',
      'logoAlt',
      'coverUrl',
      'coverAlt',
      'brandColor',
      'cidade',
      'uf',
    ].includes(root)
  ) {
    return 'identidade';
  }
  if (['products', 'photos', 'pixKey', 'pixName', 'linkItems', 'testimonialItems'].includes(root)) {
    return 'modulos';
  }
  return 'contato';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function socialHandleUrl(kind: SocialKey, raw: string): string {
  const value = raw.trim();
  if (!value) {
    return '';
  }
  if (kind === 'site' || looksLikeUrl(value)) {
    // `null` = esquema proibido (javascript:, data:...) → descarta.
    return normalizeUrl(value) ?? '';
  }
  const handle = value.replace(/^@/, '');
  switch (kind) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    default:
      return `https://${value}`;
  }
}

@Component({
  selector: 'app-site-editor',
  imports: [NgIcon, HlmButton, HlmCardImports, HlmInput, ConfirmActionComponent, SitePageComponent],
  providers: [
    provideIcons({
      lucideSave,
      lucideEye,
      lucideEyeOff,
      lucideArchive,
      lucidePlus,
      lucideTrash2,
      lucideUpload,
      lucideSmartphone,
      lucideArrowLeft,
      lucideArrowRight,
      lucideImagePlus,
      lucideMapPin,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './site-editor.component.html',
})
export class SiteEditorComponent implements OnChanges {
  private readonly uploader = inject(ImageUploadService);
  /** Opcional: só o modo admin (Avançado) consulta disponibilidade de slug. */
  private readonly api = inject(API_PORT, { optional: true });
  private slugTimer: ReturnType<typeof setTimeout> | null = null;
  private slugSub: Subscription | null = null;

  readonly site = input.required<Site>();
  readonly mode = input<SiteEditorMode>('edit');
  /** Endpoint de presign: admin, reseller ou customer (Estúdio). */
  readonly uploadScope = input<UploadScope>('reseller');
  readonly canPublish = input(true);
  readonly canUnpublish = input(false);
  readonly canArchive = input(false);
  readonly busy = input(false);
  readonly showAdvanced = input(false);
  readonly plans = input<Plan[]>([]);
  readonly customers = input<{ id: string; nome: string }[]>([]);
  readonly resellers = input<{ id: string; nome: string }[]>([]);

  /** Salvar conteúdo (no wizard: rascunho a cada aba). */
  readonly saved = output<SiteEditorSaveEvent>();
  readonly metaSaved = output<SiteEditorMetaEvent>();
  /** Publicar: leva o conteúdo atual para o pai salvar antes de publicar. */
  readonly published = output<SiteEditorSaveEvent>();
  readonly unpublished = output<void>();
  readonly archived = output<void>();
  /** Wizard: última aba concluída e válida. */
  readonly completed = output<SiteEditorSaveEvent>();
  /** Wizard: "Voltar" na primeira aba. */
  readonly back = output<void>();

  readonly weekdays = WEEKDAYS;
  readonly nicheChoices = NICHE_CHOICES;
  readonly swatches = BRAND_SWATCHES;
  readonly accept = UPLOAD_ACCEPT;
  readonly formatCents = formatCents;

  readonly tab = signal<SiteEditorTab>('identidade');
  readonly showPreview = signal(true);
  readonly notice = signal('');
  readonly attempted = signal(false);
  readonly touched = signal<ReadonlySet<string>>(new Set());
  readonly uploading = signal<string | null>(null);

  readonly d = signal<EditorDraft>(this.emptyDraft());

  // Avançado (admin)
  readonly advSlug = signal('');
  readonly advSlugState = signal<SlugCheckState>('idle');
  readonly advSlugHint = computed(() => slugHintText(this.advSlugState()));
  readonly advPlanId = signal('');
  readonly advStatus = signal<SiteStatus>('DRAFT');
  readonly advCustomerId = signal('');
  readonly advResellerId = signal('');

  readonly errors = computed(() => this.validate(this.d()));
  readonly errorCount = computed(() => Object.keys(this.errors()).length);
  readonly tabs = computed<{ key: SiteEditorTab; label: string }[]>(() => {
    const list: { key: SiteEditorTab; label: string }[] = [
      { key: 'identidade', label: 'Identidade' },
      { key: 'contato', label: 'Contato' },
      { key: 'modulos', label: 'Módulos' },
    ];
    if (this.showAdvanced() && this.mode() === 'edit') {
      list.push({ key: 'avancado', label: 'Avançado' });
    }
    return list;
  });

  readonly previewSite = computed<Site>(() => {
    const s = this.site();
    return { ...s, content: this.buildContent(this.d(), s.content) };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.slugTimer) {
        clearTimeout(this.slugTimer);
      }
      this.slugSub?.unsubscribe();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['site']) {
      const prev = changes['site'].previousValue as Site | undefined;
      const next = changes['site'].currentValue as Site;
      // Mantém o rascunho local quando o pai só devolve o mesmo site salvo.
      if (!prev || prev.id !== next.id || this.mode() === 'edit') {
        this.syncFromSite();
      }
    }
  }

  // ---------- estado ----------

  private emptyDraft(): EditorDraft {
    const week = {} as Record<WeekdayKey, DayDraft>;
    const defaults = defaultWeeklyHours();
    for (const day of WEEKDAYS) {
      const value = defaults[day.key];
      week[day.key] = value
        ? { open: true, from: value.open, to: value.close }
        : { open: false, from: '09:00', to: '18:00' };
    }
    return {
      businessName: '',
      slogan: '',
      about: '',
      logoUrl: '',
      logoAlt: '',
      coverUrl: '',
      coverAlt: '',
      niche: 'generico',
      brandColor: '',
      cidade: '',
      uf: '',
      whatsapp: '',
      whatsappMsg: '',
      phone: '',
      email: '',
      instagram: '',
      facebook: '',
      tiktok: '',
      youtube: '',
      website: '',
      logradouro: '',
      bairro: '',
      cep: '',
      mapsUrl: '',
      hasHours: false,
      week,
      hoursNote: '',
      googleReviewUrl: '',
      catalog: false,
      products: [],
      gallery: false,
      photos: [],
      pix: false,
      pixKey: '',
      pixName: '',
      links: false,
      linkItems: [],
      testimonials: false,
      testimonialItems: [],
    };
  }

  syncFromSite(): void {
    const site = this.site();
    const c = (site.content ?? {}) as SiteContent;
    const p = c.profile ?? { nome: '', cidade: '', uf: '' };
    const wizard = this.mode() === 'wizard';
    const draft = this.emptyDraft();
    const modules = c.modules ?? {};

    draft.businessName = c.businessName || p.nome || '';
    draft.slogan = p.slogan || '';
    draft.about = c.seo?.about || '';
    draft.logoUrl = p.logoUrl || '';
    draft.logoAlt = p.logoAlt || '';
    draft.coverUrl = p.coverUrl || '';
    draft.coverAlt = p.coverAlt || '';
    draft.niche = (c.theme?.niche as NicheKey) || 'generico';
    draft.brandColor = c.theme?.brandColor || '';
    draft.cidade = p.cidade || c.address?.cidade || '';
    draft.uf = p.uf || c.address?.uf || '';

    draft.whatsapp = c.whatsapp?.numero || '';
    draft.whatsappMsg = c.whatsapp?.mensagem || '';
    draft.phone = c.phone || c.telefone || '';
    draft.email = c.email || '';
    const redes = c.redes ?? [];
    const rede = (tipo: string) => redes.find((r) => r.tipo === tipo)?.url || '';
    draft.instagram = rede('instagram');
    draft.facebook = rede('facebook');
    draft.tiktok = rede('tiktok');
    draft.youtube = rede('youtube');
    draft.website = rede('site');

    draft.logradouro = c.address?.logradouro || '';
    draft.bairro = c.address?.bairro || '';
    draft.cep = c.address?.cep || '';
    draft.mapsUrl = mapsUrlOf(c);

    const weekly = weeklyHoursOf(c);
    if (weekly) {
      draft.hasHours = true;
      for (const day of WEEKDAYS) {
        const value = weekly[day.key];
        draft.week[day.key] = value
          ? { open: true, from: value.open, to: value.close }
          : { open: false, from: draft.week[day.key].from, to: draft.week[day.key].to };
      }
    } else {
      // Wizard novo (conteúdo nunca salvo pelo editor): já sugere seg–sáb.
      draft.hasHours = wizard && !c.modules && legacyHoursOf(c).length === 0;
    }
    draft.hoursNote = c.hoursNote || '';
    draft.googleReviewUrl =
      c.googleReviewUrl ||
      (c.google?.placeId
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(c.google.placeId)}`
        : '');

    const products = c.products ?? [];
    draft.products = products.map((item) => ({
      base: item,
      categoria: item.categoria || '',
      nome: item.nome || '',
      descricao: item.descricao || '',
      price: centsToInput(productCents(item) ?? parseBrlToCents(item.precoTexto ?? '')),
      fotoUrl: item.fotoUrl || '',
      fotoAlt: item.fotoUrl ? productAlt(item) : '',
    }));
    draft.catalog = modules.catalog ?? products.length > 0;
    if (!products.length && wizard && modules.catalog === undefined) {
      draft.catalog = true;
      draft.products = [this.newProduct(), this.newProduct(), this.newProduct()];
    }

    draft.photos = galleryImages(c);
    draft.gallery = modules.gallery ?? draft.photos.length > 0;

    draft.pixKey = pixKeyOf(c);
    draft.pixName = pixNameOf(c);
    draft.pix = modules.pix ?? (!!draft.pixKey || wizard);

    draft.linkItems = (c.links ?? []).map((l) => ({ base: l, titulo: l.titulo || '', url: l.url || '' }));
    draft.links = modules.links ?? draft.linkItems.length > 0;

    draft.testimonialItems = testimonialsOf(c);
    draft.testimonials = modules.testimonials ?? draft.testimonialItems.length > 0;

    this.d.set(draft);
    this.attempted.set(false);
    this.touched.set(new Set());

    this.advSlug.set(site.slug);
    this.resetSlugCheck();
    this.advPlanId.set(site.planId);
    this.advStatus.set(site.status);
    this.advCustomerId.set(site.customerId);
    this.advResellerId.set(site.resellerId ?? '');
  }

  patch<K extends DraftKey>(key: K, value: EditorDraft[K]): void {
    this.d.update((draft) => ({ ...draft, [key]: value }));
  }

  val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  touch(key: string): void {
    if (this.touched().has(key)) {
      return;
    }
    this.touched.update((set) => new Set([...set, key]));
  }

  /** Mensagem de erro do campo (após tocar no campo ou tentar avançar/salvar). */
  err(key: string): string {
    const message = this.errors()[key];
    if (!message) {
      return '';
    }
    const root = key.split('.')[0];
    return this.attempted() || this.touched().has(root) || this.touched().has(key) ? message : '';
  }

  tabHasErrors(tab: SiteEditorTab): boolean {
    return this.attempted() && Object.keys(this.errors()).some((key) => errorTab(key) === tab);
  }

  setDay(key: WeekdayKey, patch: Partial<DayDraft>): void {
    this.d.update((draft) => ({
      ...draft,
      week: { ...draft.week, [key]: { ...draft.week[key], ...patch } },
    }));
  }

  copyMondayToWeekdays(): void {
    const mon = this.d().week.mon;
    this.d.update((draft) => ({
      ...draft,
      week: {
        ...draft.week,
        tue: { ...mon },
        wed: { ...mon },
        thu: { ...mon },
        fri: { ...mon },
      },
    }));
  }

  fillMapsFromAddress(): void {
    const query = this.addressQuery();
    if (!query) {
      this.notice.set('Preencha o endereço para gerar o link do Maps.');
      return;
    }
    this.patch('mapsUrl', mapsSearchUrl(query));
  }

  addressQuery(): string {
    const draft = this.d();
    return [draft.logradouro, draft.bairro, draft.cidade, draft.uf, draft.cep]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
  }

  // ---------- listas ----------

  private newProduct(): ProductDraft {
    return {
      base: {},
      categoria: 'Destaques',
      nome: '',
      descricao: '',
      price: '',
      fotoUrl: '',
      fotoAlt: '',
    };
  }

  addProduct(): void {
    this.d.update((draft) => ({
      ...draft,
      products: [
        ...draft.products,
        {
          ...this.newProduct(),
          categoria: draft.products.at(-1)?.categoria || 'Destaques',
        },
      ],
    }));
  }

  updateProduct(index: number, patch: Partial<ProductDraft>): void {
    this.d.update((draft) => ({
      ...draft,
      products: draft.products.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  formatPrice(index: number): void {
    const item = this.d().products[index];
    if (!item) {
      return;
    }
    const cents = parseBrlToCents(item.price);
    this.updateProduct(index, { price: cents === null ? item.price : centsToInput(cents) });
    this.touch('products');
  }

  removeProduct(index: number): void {
    this.d.update((draft) => ({
      ...draft,
      products: draft.products.filter((_, i) => i !== index),
    }));
  }

  removePhoto(index: number): void {
    this.d.update((draft) => ({ ...draft, photos: draft.photos.filter((_, i) => i !== index) }));
  }

  updatePhoto(index: number, patch: Partial<SiteGalleryImage>): void {
    this.d.update((draft) => ({
      ...draft,
      photos: draft.photos.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  addLink(): void {
    this.d.update((draft) => ({
      ...draft,
      linkItems: [...draft.linkItems, { base: { tipo: 'url' }, titulo: '', url: '' }],
    }));
  }

  updateLink(index: number, patch: Partial<LinkDraft>): void {
    this.d.update((draft) => ({
      ...draft,
      linkItems: draft.linkItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  removeLink(index: number): void {
    this.d.update((draft) => ({
      ...draft,
      linkItems: draft.linkItems.filter((_, i) => i !== index),
    }));
  }

  addTestimonial(): void {
    this.d.update((draft) => ({
      ...draft,
      testimonialItems: [...draft.testimonialItems, { name: '', text: '' }],
    }));
  }

  updateTestimonial(index: number, patch: Partial<{ name: string; text: string }>): void {
    this.d.update((draft) => ({
      ...draft,
      testimonialItems: draft.testimonialItems.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  removeTestimonial(index: number): void {
    this.d.update((draft) => ({
      ...draft,
      testimonialItems: draft.testimonialItems.filter((_, i) => i !== index),
    }));
  }

  // ---------- uploads ----------

  async onUpload(
    event: Event,
    target: 'logo' | 'cover' | 'gallery' | `product-${number}`,
  ): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) {
      return;
    }
    const kind: ImageKind =
      target === 'logo' ? 'square' : target === 'cover' ? 'cover' : 'photo';
    this.uploading.set(target);
    this.notice.set('Enviando foto…');
    try {
      const url = await this.uploader.upload(file, this.uploadScope(), kind);
      const name = this.d().businessName.trim() || 'o negócio';
      if (target === 'logo') {
        this.d.update((draft) => ({
          ...draft,
          logoUrl: url,
          logoAlt: draft.logoAlt || `Logo de ${name}`,
        }));
      } else if (target === 'cover') {
        this.d.update((draft) => ({
          ...draft,
          coverUrl: url,
          coverAlt: draft.coverAlt || `Capa de ${name}`,
        }));
      } else if (target === 'gallery') {
        this.d.update((draft) => ({
          ...draft,
          gallery: true,
          photos: [...draft.photos, { url, alt: `Foto de ${name}` }],
        }));
      } else {
        const index = Number(target.slice('product-'.length));
        const item = this.d().products[index];
        this.updateProduct(index, {
          fotoUrl: url,
          fotoAlt: item?.fotoAlt || item?.nome || `Produto de ${name}`,
        });
      }
      this.notice.set('Foto enviada.');
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Falha no upload.');
    } finally {
      this.uploading.set(null);
    }
  }

  // ---------- validação ----------

  private validate(draft: EditorDraft): Record<string, string> {
    const e: Record<string, string> = {};
    const url = (key: string, value: string, message = 'Link inválido. Ex.: https://exemplo.com') => {
      if (!value.trim()) {
        return;
      }
      const normalized = normalizeUrl(value);
      if (normalized === null) {
        e[key] = INVALID_URL_SCHEME_MESSAGE;
      } else if (!URL_RE.test(normalized)) {
        e[key] = message;
      }
    };
    if (!draft.businessName.trim()) {
      e['businessName'] = 'Informe o nome do negócio.';
    } else if (draft.businessName.trim().length > 80) {
      e['businessName'] = 'Use no máximo 80 caracteres.';
    }
    if (draft.slogan.trim().length > 120) {
      e['slogan'] = 'Use no máximo 120 caracteres.';
    }
    if (draft.about.trim().length > 600) {
      e['about'] = 'Use no máximo 600 caracteres.';
    }
    if (draft.logoUrl.trim() && !draft.logoUrl.startsWith('data:image/')) {
      url('logoUrl', draft.logoUrl);
    }
    if (draft.coverUrl.trim() && !draft.coverUrl.startsWith('data:image/')) {
      url('coverUrl', draft.coverUrl);
    }
    if (draft.brandColor && !HEX_RE.test(draft.brandColor)) {
      e['brandColor'] = 'Cor inválida. Use o formato #RRGGBB.';
    }
    if (draft.uf.trim() && !/^[A-Za-z]{2}$/.test(draft.uf.trim())) {
      e['uf'] = 'UF com duas letras (ex.: SP).';
    }

    const wa = draft.whatsapp.replace(/\D/g, '');
    if (draft.whatsapp.trim() && (wa.length < 10 || wa.length > 13)) {
      e['whatsapp'] = 'WhatsApp com DDD e número (ex.: 11 99999-8888).';
    }
    const phone = draft.phone.replace(/\D/g, '');
    if (draft.phone.trim() && (phone.length < 8 || phone.length > 13)) {
      e['phone'] = 'Telefone inválido. Inclua o DDD.';
    }
    if (draft.email.trim() && !EMAIL_RE.test(draft.email.trim())) {
      e['email'] = 'E-mail inválido.';
    }
    for (const key of ['instagram', 'facebook', 'tiktok', 'youtube'] as const) {
      const value = draft[key].trim();
      if (!value) {
        continue;
      }
      if (looksLikeUrl(value)) {
        url(key, value);
      } else if (!/^@?[\w.-]{2,}$/.test(value)) {
        e[key] = 'Use @perfil ou o link completo.';
      }
    }
    url('website', draft.website, 'Site inválido. Ex.: minhaloja.com.br');
    if (draft.cep.trim() && draft.cep.replace(/\D/g, '').length !== 8) {
      e['cep'] = 'CEP com 8 dígitos.';
    }
    url('mapsUrl', draft.mapsUrl);
    url('googleReviewUrl', draft.googleReviewUrl);
    if (draft.hasHours) {
      for (const day of WEEKDAYS) {
        const value = draft.week[day.key];
        if (!value.open) {
          continue;
        }
        if (!TIME_RE.test(value.from) || !TIME_RE.test(value.to)) {
          e[`hours.${day.key}`] = `${day.long}: informe abertura e fechamento.`;
        } else if (value.from >= value.to) {
          e[`hours.${day.key}`] = `${day.long}: o fechamento deve ser depois da abertura.`;
        }
      }
    }

    if (draft.catalog) {
      draft.products.forEach((item, i) => {
        const empty = !item.nome.trim() && !item.price.trim() && !item.fotoUrl;
        if (empty) {
          return;
        }
        if (!item.nome.trim()) {
          e[`products.${i}.nome`] = 'Informe o nome do item.';
        }
        if (item.price.trim() && parseBrlToCents(item.price) === null) {
          e[`products.${i}.price`] = 'Preço inválido (ex.: 29,90).';
        }
      });
      if (!draft.products.some((item) => item.nome.trim())) {
        e['products'] = 'Adicione pelo menos um item ou desligue o catálogo.';
      }
    }
    if (draft.gallery && !draft.photos.length) {
      e['photos'] = 'Envie pelo menos uma foto ou desligue a galeria.';
    }
    if (draft.pix && !draft.pixKey.trim()) {
      e['pixKey'] = 'Informe a chave Pix ou desligue o Pix.';
    }
    if (draft.links) {
      draft.linkItems.forEach((item, i) => {
        if (!item.titulo.trim() && !item.url.trim()) {
          return;
        }
        if (!item.titulo.trim()) {
          e[`linkItems.${i}.titulo`] = 'Informe o título do link.';
        }
        const normalized = normalizeUrl(item.url);
        if (normalized === null) {
          e[`linkItems.${i}.url`] = INVALID_URL_SCHEME_MESSAGE;
        } else if (
          !URL_RE.test(normalized) &&
          !/^(tel:|mailto:)\S+/i.test(normalized) &&
          !/^\/(?!\/)\S*$/.test(normalized)
        ) {
          e[`linkItems.${i}.url`] = 'Link inválido. Ex.: https://exemplo.com';
        }
      });
    }
    if (draft.testimonials) {
      draft.testimonialItems.forEach((item, i) => {
        if (!item.name.trim() && !item.text.trim()) {
          return;
        }
        if (!item.name.trim()) {
          e[`testimonialItems.${i}.name`] = 'Informe o nome de quem avaliou.';
        }
        if (!item.text.trim()) {
          e[`testimonialItems.${i}.text`] = 'Escreva o depoimento.';
        }
      });
    }
    return e;
  }

  // ---------- conteúdo ----------

  private buildContent(draft: EditorDraft, base: SiteContent): SiteContent {
    const name = draft.businessName.trim() || base.businessName || this.site().slug;
    const t = (value: string) => value.trim() || undefined;

    const managed = new Set<string>(SOCIAL_KEYS);
    const redes: SiteSocial[] = (base.redes ?? []).filter((r) => !managed.has(r.tipo));
    const socialValues: Record<SocialKey, string> = {
      instagram: draft.instagram,
      facebook: draft.facebook,
      tiktok: draft.tiktok,
      youtube: draft.youtube,
      site: draft.website,
    };
    for (const kind of SOCIAL_KEYS) {
      const href = socialHandleUrl(kind, socialValues[kind]);
      if (href) {
        redes.push({ tipo: kind, url: href });
      }
    }

    let weekly: SiteWeeklyHours | undefined;
    if (draft.hasHours) {
      weekly = {};
      for (const day of WEEKDAYS) {
        const value = draft.week[day.key];
        weekly[day.key] = value.open ? { open: value.from, close: value.to } : null;
      }
    }
    const legacyHours = legacyHoursOf(base);

    const products: SiteProduct[] = draft.products
      .filter((item) => item.nome.trim())
      .map((item) => {
        const cents = parseBrlToCents(item.price);
        const alt = item.fotoUrl ? item.fotoAlt.trim() || item.nome.trim() : undefined;
        // Só os nomes oficiais do schema da API (`precoCentavos`, `alt`); remove chaves legadas.
        const { priceCents: _legacyCents, fotoAlt: _legacyAlt, ...rest } = item.base;
        const product: SiteProduct = {
          ...rest,
          nome: item.nome.trim(),
          categoria: t(item.categoria),
          descricao: t(item.descricao),
          precoCentavos: cents,
          precoTexto: cents === null ? item.price.trim() : formatCents(cents),
          fotoUrl: t(item.fotoUrl),
          alt,
        };
        return product;
      });

    const photos = draft.photos.map((photo) => ({
      url: photo.url,
      alt: photo.alt?.trim() || `Foto de ${name}`,
    }));

    const links: SiteLink[] = draft.linkItems
      .map((item) => ({ item, url: normalizeUrl(item.url) }))
      // `null` = esquema proibido (javascript:, data:...) → não vai para a API.
      .filter(({ item, url }) => item.titulo.trim() && url)
      .map(({ item, url }) => ({
        ...item.base,
        tipo: item.base.tipo ?? 'url',
        titulo: item.titulo.trim(),
        url: url as string,
      }));

    const testimonials = draft.testimonialItems
      .filter((item) => item.name.trim() && item.text.trim())
      .map((item) => ({
        nome: item.name.trim(),
        texto: item.text.trim(),
      }));

    const pixKey = draft.pixKey.trim();
    const pixName = draft.pixName.trim() || name;
    const whatsapp = normalizeWhatsapp(draft.whatsapp);

    const content: SiteContent = {
      ...base,
      businessName: name,
      profile: {
        ...base.profile,
        nome: name,
        slogan: t(draft.slogan),
        logoUrl: t(draft.logoUrl),
        logoAlt: draft.logoUrl.trim() ? draft.logoAlt.trim() || `Logo de ${name}` : undefined,
        coverUrl: t(draft.coverUrl),
        coverAlt: draft.coverUrl.trim() ? draft.coverAlt.trim() || `Capa de ${name}` : undefined,
        cidade: draft.cidade.trim(),
        uf: draft.uf.trim().toUpperCase(),
      },
      theme: {
        ...base.theme,
        niche: draft.niche,
        brandColor: HEX_RE.test(draft.brandColor) ? draft.brandColor : base.theme?.brandColor,
      },
      whatsapp: whatsapp
        ? {
            ...base.whatsapp,
            numero: whatsapp,
            mensagem: draft.whatsappMsg.trim() || 'Olá! Vim pelo site.',
          }
        : undefined,
      phone: t(draft.phone),
      telefone: undefined,
      email: t(draft.email),
      redes: redes.length ? redes : undefined,
      address: draft.logradouro.trim()
        ? {
            ...base.address,
            logradouro: draft.logradouro.trim(),
            bairro: t(draft.bairro),
            cidade: draft.cidade.trim(),
            uf: draft.uf.trim().toUpperCase(),
            cep: t(draft.cep),
          }
        : undefined,
      mapsUrl: normalizeUrl(draft.mapsUrl) || undefined,
      // `hours` segue o schema da API (objeto semanal); lista legada só é mantida se não houver semanal.
      hours: (weekly ?? (legacyHours.length ? legacyHours : undefined)) as SiteContent['hours'],
      weeklyHours: weekly,
      hoursNote: t(draft.hoursNote),
      googleReviewUrl: normalizeUrl(draft.googleReviewUrl) || undefined,
      modules: {
        catalog: draft.catalog,
        gallery: draft.gallery,
        pix: draft.pix,
        links: draft.links,
        testimonials: draft.testimonials,
        hours: draft.hasHours || (!weekly && legacyHours.length > 0),
      },
      products: products.length ? products : undefined,
      gallery: photos.length ? photos : undefined,
      pix: pixKey
        ? {
            ...base.pix,
            chave: pixKey,
            nome: pixName,
            key: pixKey,
            receiverName: pixName,
          }
        : undefined,
      links: links.length ? links : undefined,
      testimonials: testimonials.length ? testimonials : undefined,
      seo: {
        ...base.seo,
        about: t(draft.about),
      },
    };
    return content;
  }

  /** Conteúdo pronto para a API (sem chaves undefined). */
  private currentEvent(): SiteEditorSaveEvent {
    const content = JSON.parse(JSON.stringify(this.previewSite().content)) as SiteContent;
    return { content, templateId: this.site().templateId };
  }

  private focusFirstError(): void {
    const first = Object.keys(this.errors())[0];
    if (first) {
      this.tab.set(errorTab(first));
    }
  }

  private tabValid(tab: SiteEditorTab): boolean {
    return !Object.keys(this.errors()).some((key) => errorTab(key) === tab);
  }

  // ---------- ações ----------

  goTab(tab: SiteEditorTab): void {
    this.tab.set(tab);
  }

  save(): void {
    this.attempted.set(true);
    if (this.errorCount()) {
      this.notice.set('Corrija os campos destacados antes de salvar.');
      this.focusFirstError();
      return;
    }
    this.saved.emit(this.currentEvent());
    this.notice.set('Salvando…');
  }

  publish(): void {
    this.attempted.set(true);
    if (this.errorCount()) {
      this.notice.set('Corrija os campos destacados antes de publicar.');
      this.focusFirstError();
      return;
    }
    this.published.emit(this.currentEvent());
  }

  /** Wizard: valida a aba, salva o rascunho e avança. */
  next(): void {
    const current = this.tab();
    if (!this.tabValid(current)) {
      this.attempted.set(true);
      this.notice.set('Corrija os campos destacados para continuar.');
      return;
    }
    const index = TAB_ORDER.indexOf(current);
    if (index < TAB_ORDER.length - 1) {
      this.saved.emit(this.currentEvent());
      this.notice.set('Rascunho salvo.');
      this.tab.set(TAB_ORDER[index + 1]);
      return;
    }
    this.attempted.set(true);
    if (this.errorCount()) {
      this.notice.set('Corrija os campos destacados para continuar.');
      this.focusFirstError();
      return;
    }
    this.completed.emit(this.currentEvent());
  }

  prev(): void {
    const index = TAB_ORDER.indexOf(this.tab());
    if (index <= 0) {
      this.back.emit();
      return;
    }
    this.tab.set(TAB_ORDER[index - 1]);
  }

  isLastTab(): boolean {
    return this.tab() === TAB_ORDER[TAB_ORDER.length - 1];
  }

  /** Avançado: digita o slug e consulta /admin/slugs/check (com debounce, excluindo o próprio site). */
  onAdvSlugInput(event: Event): void {
    const slug = this.val(event).trim().toLowerCase();
    this.advSlug.set(slug);
    this.resetSlugCheck();
    if (!slug || slug === this.site().slug) {
      return;
    }
    if (!isValidSlug(slug)) {
      this.advSlugState.set('invalid');
      return;
    }
    if (!this.api) {
      return;
    }
    const api = this.api;
    this.advSlugState.set('checking');
    this.slugTimer = setTimeout(() => {
      this.slugTimer = null;
      this.slugSub = api.checkAdminSlug(slug, this.site().id).subscribe({
        next: (result) => {
          if (this.advSlug() === slug) {
            this.advSlugState.set(result.available ? 'available' : 'unavailable');
          }
        },
        error: () => {
          if (this.advSlug() === slug) {
            this.advSlugState.set('idle');
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
    this.advSlugState.set('idle');
  }

  saveAdvanced(): void {
    const site = this.site();
    const patch: SiteEditorMetaEvent = {};
    const slug = this.advSlug().trim().toLowerCase();
    if (slug && slug !== site.slug) {
      const state = this.advSlugState();
      if (isSlugBlocked(state)) {
        this.notice.set(
          state === 'checking' ? 'Aguarde a verificação do endereço.' : this.advSlugHint(),
        );
        return;
      }
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
