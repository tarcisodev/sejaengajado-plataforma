import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
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
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-reseller-sites',
  imports: [HlmBadge, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section hlmCard class="p-4 md:p-6">
      <h2 class="font-display text-xl">Criar site</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" (submit)="create($event)">
        <label class="grid gap-1 text-sm sm:col-span-2">
          Cliente
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="customerId"
            required
          >
            @for (customer of customers(); track customer.id) {
              <option [value]="customer.id">{{ customer.name }}</option>
            }
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Slug
          <input
            hlmInput
            class="h-11"
            name="slug"
            required
            (blur)="checkSlug($event)"
            autocomplete="off"
          />
          @if (slugHint()) {
            <span class="text-xs" [class.text-destructive]="!slugOk()">{{ slugHint() }}</span>
          }
        </label>
        <label class="grid gap-1 text-sm">
          Plano
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="planId"
            required
          >
            @for (plan of options()?.plans ?? []; track plan.id) {
              <option [value]="plan.id">{{ plan.name }} ({{ formatBrl(plan.priceCents) }})</option>
            }
          </select>
        </label>
        <label class="grid gap-1 text-sm sm:col-span-2">
          Template
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="templateId"
            required
          >
            @for (template of options()?.templates ?? []; track template.id) {
              <option [value]="template.id">{{ template.name }}</option>
            }
          </select>
        </label>
        <div class="sm:col-span-2">
          <button hlmBtn class="h-11" type="submit" [disabled]="!slugOk()">Criar rascunho</button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
      <table hlmTable class="w-full min-w-[36rem]">
        <thead>
          <tr hlmTr>
            <th hlmTh>Slug</th>
            <th hlmTh>Cliente</th>
            <th hlmTh>Status</th>
            <th hlmTh></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr hlmTr [attr.data-site-id]="row.id" [attr.data-reseller-id]="row.resellerId">
              <td hlmTd>
                <a class="underline" [href]="'https://' + row.slug + '.sejaengajado.com.br'">
                  {{ row.slug }}
                </a>
              </td>
              <td hlmTd>{{ row.customer?.name ?? row.customerId }}</td>
              <td hlmTd>
                <span hlmBadge variant="secondary">{{ row.status }}</span>
              </td>
              <td hlmTd>
                @if (row.status === 'DRAFT' || row.status === 'READ_ONLY') {
                  <button
                    hlmBtn
                    class="h-11"
                    type="button"
                    variant="outline"
                    (click)="publish(row.id)"
                  >
                    Publicar
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class ResellerSitesComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly rows = signal<ResellerSiteDto[]>([]);
  readonly customers = signal<ResellerCustomerDto[]>([]);
  readonly options = signal<SiteOptionsDto | null>(null);
  readonly slugHint = signal('');
  readonly slugOk = signal(true);

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
    });
  }

  checkSlug(event: Event): void {
    const slug = (event.target as HTMLInputElement).value.trim();
    if (!slug) {
      this.slugHint.set('');
      this.slugOk.set(true);
      return;
    }
    this.api.checkResellerSlug(slug).subscribe((result) => {
      this.slugOk.set(result.available);
      this.slugHint.set(
        result.available ? 'Slug disponível.' : `Slug indisponível (${result.code ?? 'erro'}).`,
      );
    });
  }

  create(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.api
      .createResellerSite({
        customerId: String(data.get('customerId') ?? ''),
        slug: String(data.get('slug') ?? ''),
        planId: String(data.get('planId') ?? ''),
        templateId: String(data.get('templateId') ?? ''),
      })
      .subscribe({
        next: () => {
          toast.success('Site criado.');
          (event.target as HTMLFormElement).reset();
          this.reload();
        },
        error: () => toast.error('Não foi possível criar o site.'),
      });
  }

  publish(siteId: string): void {
    this.api.publishResellerSite(siteId).subscribe({
      next: () => {
        toast.success('Site publicado.');
        this.reload();
      },
      error: () => toast.error('Não foi possível publicar.'),
    });
  }
}
