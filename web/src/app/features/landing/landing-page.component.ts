import { AsyncPipe } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  Renderer2,
  inject,
  DOCUMENT,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Observable, combineLatest, map } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Plan } from '../../core/models/domain';
import {
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  LANDING_URL,
  WHATSAPP_HREF,
  formatBrl,
} from './landing-seo';

interface LandingOffer {
  pronto: Plan | null;
  pro: Plan | null;
  renewalCentavos: number;
}

@Component({
  selector: 'app-landing-page',
  imports: [AsyncPipe],
  templateUrl: './landing-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(API_PORT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private jsonLd: HTMLScriptElement | null = null;

  readonly whatsappHref = WHATSAPP_HREF;
  readonly formatBrl = formatBrl;
  readonly steps = [
    {
      n: '01',
      title: 'Escolhemos o ramo',
      text: 'Barbearia, cozinha ou serviço: o modelo já nasce com os blocos do seu dia.',
    },
    {
      n: '02',
      title: 'Publicamos o endereço',
      text: 'O site entra no ar em nome.sejaengajado.com.br, no subdomínio do negócio.',
    },
    {
      n: '03',
      title: 'A placa vai para a porta',
      text: 'QR e NFC pedem a avaliação no Google. Cada leitura passa pelo seu endereço.',
    },
  ];
  readonly questions = [
    {
      q: 'O site fica em qual endereço?',
      a: 'No subdomínio do negócio, como nome.sejaengajado.com.br. Quem visita vê o nome na barra do navegador.',
    },
    {
      q: 'Quem pode alterar o site?',
      a: 'No Pronto, a alteração é pelo suporte. No Engajado Pro, você edita catálogo, Pix, fotos e promoções no painel.',
    },
    {
      q: 'A placa entra nos dois planos?',
      a: 'No Engajado Pro ela é brinde, vinculada a 12 meses do plano. No Pronto, a placa é um adicional pago.',
    },
    {
      q: 'O site sai do ar no primeiro dia de atraso?',
      a: 'Não. O mensal atrasado começa com aviso. O site continua no ar antes de qualquer suspensão.',
    },
    {
      q: 'Atendem fora de Uberaba?',
      a: 'O atendimento presencial deste começo é em Uberaba, MG.',
    },
  ];

  readonly offer$: Observable<LandingOffer> = combineLatest([
    this.api.listPlans(),
    this.api.getPlatformConfig(),
  ]).pipe(
    map(([plans, config]) => ({
      pronto: plans.find((plan) => plan.code === 'PRONTO') ?? null,
      pro: plans.find((plan) => plan.code === 'ENGAJADO_PRO') ?? null,
      renewalCentavos: config.prontoRenewalCentavos,
    })),
  );

  ngOnInit(): void {
    this.title.setTitle(LANDING_TITLE);
    this.meta.updateTag({ name: 'description', content: LANDING_DESCRIPTION });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: LANDING_TITLE });
    this.meta.updateTag({ property: 'og:description', content: LANDING_DESCRIPTION });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: LANDING_URL });
    this.meta.updateTag({ property: 'og:locale', content: 'pt_BR' });
    this.upsertCanonical();
    this.upsertJsonLd();
  }

  ngOnDestroy(): void {
    this.jsonLd?.remove();
    this.document.head.querySelector('link[data-landing-canonical]')?.remove();
  }

  private upsertCanonical(): void {
    const existing = this.document.head.querySelector('link[data-landing-canonical]');
    const link = existing ?? this.renderer.createElement('link');
    this.renderer.setAttribute(link, 'rel', 'canonical');
    this.renderer.setAttribute(link, 'href', LANDING_URL);
    this.renderer.setAttribute(link, 'data-landing-canonical', 'true');
    if (!existing) {
      this.renderer.appendChild(this.document.head, link);
    }
  }

  private upsertJsonLd(): void {
    const script = this.renderer.createElement('script') as HTMLScriptElement;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'Seja Engajado',
      url: LANDING_URL,
      description: LANDING_DESCRIPTION,
      areaServed: { '@type': 'City', name: 'Uberaba' },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Uberaba',
        addressRegion: 'MG',
        addressCountry: 'BR',
      },
    });
    this.renderer.appendChild(this.document.head, script);
    this.jsonLd = script;
  }
}
