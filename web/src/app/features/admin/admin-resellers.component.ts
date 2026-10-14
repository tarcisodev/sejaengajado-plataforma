import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin } from 'rxjs';

import { migrationAvailable } from '../../core/admin/migration';
import { API_PORT } from '../../core/api/api-port';
import { Reseller, Site } from '../../core/models/domain';

const ACTOR = 'user_admin';

@Component({
  selector: 'app-admin-resellers',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-resellers.component.html',
})
export class AdminResellersComponent {
  private readonly api = inject(API_PORT);
  today = new Date();
  readonly rows = signal<Reseller[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly graceDays = signal(30);
  readonly message = signal('');
  readonly error = signal('');

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      rows: this.api.listResellers(),
      sites: this.api.listSites(),
      config: this.api.getPlatformConfig(),
    }).subscribe(({ rows, sites, config }) => {
      this.rows.set(rows);
      this.sites.set(sites);
      this.graceDays.set(config.resellerGraceDays);
    });
  }

  owned(resellerId: string): Site[] {
    return this.sites().filter((site) => site.resellerId === resellerId);
  }

  canMigrate(reseller: Reseller): boolean {
    return migrationAvailable(
      reseller.status,
      reseller.delinquentSince,
      this.today,
      this.graceDays(),
    );
  }

  block(resellerId: string, event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '');
    if (!reason.trim()) {
      this.error.set('Motivo obrigatório');
      return;
    }
    this.error.set('');
    this.api
      .blockReseller(resellerId, {
        actorId: ACTOR,
        reason,
        siteIds: data.getAll('siteId').map(String),
        blockedAt: new Date().toISOString(),
      })
      .subscribe(() => {
        this.message.set('Revendedor bloqueado. Os sites marcados foram suspensos.');
        this.reload();
      });
  }

  unblock(resellerId: string): void {
    this.api.unblockReseller(resellerId, ACTOR, new Date().toISOString()).subscribe(() => {
      this.message.set('Revendedor desbloqueado. Os sites suspensos continuam fora do ar.');
      this.reload();
    });
  }

  offer(resellerId: string): void {
    this.api.offerMigration(resellerId, ACTOR, this.today).subscribe(() => {
      this.message.set('Migração oferecida. O cliente ainda não foi transferido.');
    });
  }
}
