import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { Application, DomainSummary } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';
import { DnsEditor } from './dns-editor';

/**
 * Un domaine : son échéance et son renouvellement, l'application à laquelle il est relié (ou le
 * relier en un geste), et, pour qui le veut, la vue avancée des DNS.
 */
@Component({
  selector: 'idm-domain',
  imports: [DatePipe, FormsModule, RouterLink, TranslateModule, IdemLoaderComponent, Illustration, XafPipe, DnsEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-10">
      <a routerLink="/domains" class="button-ghost button-sm inline-flex items-center gap-2"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ 'domain.back' | translate }}</a>

      @if (error()) {
        <section class="glass-card mt-6 flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="110" />
          <p class="mt-4 text-sm">{{ error() }}</p>
        </section>
      } @else if (!domain()) {
        <div class="mt-6 space-y-3"><div class="skeleton h-24 rounded-xl"></div><div class="skeleton h-40 rounded-xl"></div></div>
      } @else {
        @let d = domain()!;
        <h1 class="mt-4 break-all text-2xl font-semibold">{{ d.name }}</h1>

        <section class="glass-card mt-6 grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'domain.expires' | translate }}</p>
            <p class="mt-1 font-semibold" [style.color]="(d.daysLeft ?? 99) <= 30 ? 'var(--color-warning)' : null">{{ d.expiresAt ? (d.expiresAt | date: 'd MMMM y') : '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'domain.renewal' | translate }}</p>
            <p class="mt-1 font-semibold">{{ d.renewalXaf | xaf }} <span class="text-xs font-normal text-[var(--color-text-tertiary)]">{{ 'home.perYear' | translate }}</span></p>
          </div>
          <div>
            <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'domain.registrar' | translate }}</p>
            @if (registrar() !== undefined) {
              <p class="mt-1 text-sm">{{ registrar() || '—' }}</p>
            } @else {
              <button type="button" class="button-ghost button-sm mt-1 !px-0" (click)="showRegistrar()">{{ 'domain.showRegistrar' | translate }}</button>
            }
          </div>
          @if ((d.daysLeft ?? 99) <= 30) {
            <p class="text-sm text-[var(--color-text-secondary)] sm:col-span-3">{{ 'domain.renewSoon' | translate }}</p>
          }
        </section>

        <!-- Relier à une application. -->
        <section class="glass-card mt-4 p-5">
          <h2 class="font-semibold">{{ 'domain.connectionTitle' | translate }}</h2>
          @if (d.connection; as c) {
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <span class="h-2 w-2 rounded-full" [style.background]="c.status === 'active' ? 'var(--color-success)' : c.status === 'failed' ? 'var(--color-warning)' : 'var(--color-text-tertiary)'" aria-hidden="true"></span>
              <span class="flex-1 text-sm">{{ appName(c.appUuid) }} · {{ ('connection.status.' + c.status) | translate }}</span>
              <a [routerLink]="['/connections', c.id]" class="outer-button button-sm">{{ 'domain.follow' | translate }}</a>
            </div>
          } @else {
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'domain.connectWhy' | translate }}</p>
            @if (apps() === null) {
              <idem-loader size="sm" block />
            } @else if (apps()!.length) {
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <label for="connect-app" class="sr-only">{{ 'domain.chooseApp' | translate }}</label>
                <select id="connect-app" class="flex-1" [(ngModel)]="appUuid">
                  <option [ngValue]="null" disabled>{{ 'domain.chooseApp' | translate }}</option>
                  @for (a of apps(); track a.uuid) { <option [ngValue]="a.uuid">{{ a.name }}</option> }
                </select>
                <button type="button" class="inner-button inline-flex items-center gap-2" [disabled]="!appUuid || connecting()" (click)="connect()">
                  @if (connecting()) { <idem-loader size="xs" /> }
                  {{ 'domain.connect' | translate }}
                </button>
              </div>
            } @else {
              <p class="mt-2 text-sm text-[var(--color-text-secondary)]">{{ 'checkout.noApps' | translate }}</p>
            }
            @if (connectError()) { <p class="mt-2 text-sm text-[var(--color-danger)]" role="alert">{{ connectError() }}</p> }
          }
        </section>

        @if (d.dnsMode === 'managed') {
          <details class="glass-card mt-4 px-5 py-4">
            <summary class="cursor-pointer select-none text-sm font-medium">{{ 'domain.advancedDns' | translate }}</summary>
            <p class="mb-4 mt-2 text-sm text-[var(--color-text-secondary)]">{{ 'domain.advancedDnsWhy' | translate }}</p>
            <idm-dns-editor [domainId]="d.id" />
          </details>
        }
      }
    </div>
  `,
})
export class DomainPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  readonly id = input.required<string>();

  protected readonly domain = signal<DomainSummary | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly apps = signal<Application[] | null>(null);
  protected readonly registrar = signal<string | null | undefined>(undefined);
  protected readonly connecting = signal(false);
  protected readonly connectError = signal<string | null>(null);
  protected appUuid: string | null = null;

  constructor() {
    queueMicrotask(() => {
      this.api.domain(this.id()).subscribe({
        next: (d) => this.domain.set(d),
        error: (e) => this.error.set(apiMessage(e, this.translate.instant('domain.loadError'))),
      });
      this.api.applications().subscribe({ next: (r) => this.apps.set(r.applications), error: () => this.apps.set([]) });
    });
  }

  protected appName(uuid: string): string {
    return this.apps()?.find((a) => a.uuid === uuid)?.name ?? this.translate.instant('domain.yourApp');
  }

  protected showRegistrar(): void {
    this.api.registrar(this.id()).subscribe({ next: (r) => this.registrar.set(r.registrar), error: () => this.registrar.set(null) });
  }

  protected connect(): void {
    const d = this.domain();
    if (!d || !this.appUuid) return;
    this.connecting.set(true);
    this.connectError.set(null);
    this.api.connect({ host: d.name, appUuid: this.appUuid }).subscribe({
      next: (c) => void this.router.navigate(['/connections', c.id]),
      error: (e) => {
        this.connecting.set(false);
        this.connectError.set(apiMessage(e, this.translate.instant('domain.connectError')));
      },
    });
  }
}
