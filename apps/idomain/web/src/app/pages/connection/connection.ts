import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { Connection, DomainSession } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';

/**
 * Le branchement d'un domaine sur une application, suivi en direct. Domaine chez iDomain : tout
 * se fait seul. Domaine ailleurs : les deux réglages à copier chez son fournisseur, puis la page
 * dit d'elle-même quand c'est bon. « En ligne » n'apparaît qu'avec le HTTPS valide.
 */
@Component({
  selector: 'idm-connection',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10">
      @if (error()) {
        <section class="glass-card flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="110" />
          <p class="mt-4 text-sm">{{ error() }}</p>
          <a routerLink="/domains" class="outer-button mt-5">{{ 'domain.back' | translate }}</a>
        </section>
      } @else if (!connection()) {
        <div class="space-y-3"><div class="skeleton h-40 rounded-xl"></div><div class="skeleton h-24 rounded-xl"></div></div>
      } @else {
        @let c = connection()!;
        <section class="glass-card flex flex-col items-center p-8 text-center">
          <idm-illustration [kind]="c.status === 'failed' ? 'cracked' : c.status === 'active' ? 'facade' : 'pirogue'" [width]="150" />
          <h1 class="mt-4 break-all text-2xl font-semibold">{{ c.host }}</h1>
          <p class="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">{{ ('connection.headline.' + c.status) | translate }}</p>
          @if (running()) { <idem-loader size="sm" class="mt-4" [label]="'connection.checking' | translate" /> }
          @if (c.status === 'failed' && c.error) { <p class="mt-2 text-sm">{{ ('connection.errors.' + c.error) | translate }}</p> }
        </section>

        @if (c.instructions.length && c.status !== 'active') {
          <section class="glass-card mt-4 p-5">
            <h2 class="font-semibold">{{ 'connection.toDo' | translate: { zone: c.instructions[0].zone } }}</h2>
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'connection.toDoHint' | translate }}</p>
            <ul class="mt-4 space-y-3">
              @for (i of c.instructions; track i.type + i.name) {
                <li class="rounded-lg border border-[var(--glass-border-subtle)] p-3 text-sm">
                  <p class="text-xs text-[var(--color-text-tertiary)]">{{ ('connection.purpose.' + i.purpose) | translate }}</p>
                  <dl class="mt-2 grid grid-cols-[80px_1fr_auto] items-center gap-x-3 gap-y-1">
                    <dt class="text-[var(--color-text-secondary)]">{{ 'dns.type' | translate }}</dt><dd class="font-mono">{{ i.type }}</dd><dd></dd>
                    <dt class="text-[var(--color-text-secondary)]">{{ 'dns.name' | translate }}</dt><dd class="break-all font-mono">{{ i.name }}</dd>
                    <dd><button type="button" class="button-ghost button-sm" (click)="copy(i.name)" [attr.aria-label]="'connection.copy' | translate: { value: i.name }"><i class="pi text-xs" [class.pi-copy]="copied() !== i.name" [class.pi-check]="copied() === i.name" aria-hidden="true"></i></button></dd>
                    <dt class="text-[var(--color-text-secondary)]">{{ 'connection.value' | translate }}</dt><dd class="break-all font-mono">{{ i.value }}</dd>
                    <dd><button type="button" class="button-ghost button-sm" (click)="copy(i.value)" [attr.aria-label]="'connection.copy' | translate: { value: i.value }"><i class="pi text-xs" [class.pi-copy]="copied() !== i.value" [class.pi-check]="copied() === i.value" aria-hidden="true"></i></button></dd>
                  </dl>
                </li>
              }
            </ul>
          </section>
        }

        @if (c.check?.domains?.length) {
          <section class="glass-card mt-4 divide-y divide-[var(--glass-border-subtle)]">
            @for (d of c.check!.domains!; track d.host) {
              <div class="flex items-center gap-3 px-5 py-3 text-sm">
                <span class="h-2 w-2 rounded-full" [style.background]="d.https === 'valid' ? 'var(--color-success)' : d.dns === 'ok' ? 'var(--color-text-tertiary)' : 'var(--color-warning)'" aria-hidden="true"></span>
                <span class="flex-1 break-all font-mono">{{ d.host }}</span>
                <span class="text-xs text-[var(--color-text-secondary)]">{{ (d.https === 'valid' ? 'connection.hostLive' : 'connection.dns.' + d.dns) | translate }}</span>
              </div>
            }
          </section>
        }

        <div class="mt-6 flex flex-wrap gap-2">
          @if (c.status === 'active') { <a [href]="'https://' + c.host" target="_blank" rel="noopener" class="inner-button">{{ 'order.visit' | translate }}</a> }
          @if (c.status === 'failed') {
            <button type="button" class="inner-button inline-flex items-center gap-2" [disabled]="acting()" (click)="retry()">@if (acting()) { <idem-loader size="xs" /> }{{ 'connection.retry' | translate }}</button>
          }
          @if (returnUrl()) { <a [href]="returnUrl()" class="outer-button">{{ 'connection.backToApp' | translate }}</a> }
          @if (c.status !== 'detached') {
            <button type="button" class="button-ghost ml-auto text-[var(--color-danger)]" [disabled]="acting()" (click)="detach()">{{ 'connection.detach' | translate }}</button>
          }
        </div>
      }
    </div>
  `,
})
export class ConnectionPage {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  private readonly sessionId = inject(ActivatedRoute).snapshot.queryParamMap.get('session');
  readonly id = input.required<string>();

  protected readonly connection = signal<Connection | null>(null);
  protected readonly session = signal<DomainSession | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly acting = signal(false);
  protected readonly copied = signal<string | null>(null);
  protected readonly running = computed(() => !['active', 'failed', 'detached'].includes(this.connection()?.status ?? 'active'));
  protected readonly returnUrl = computed(() => this.session()?.returnUrl ?? null);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    queueMicrotask(() => this.load());
    if (this.sessionId) this.api.domainSession(this.sessionId).subscribe({ next: (s) => this.session.set(s), error: () => undefined });
  }

  private load(): void {
    this.api.connection(this.id()).subscribe({
      next: (c) => {
        this.connection.set(c);
        clearTimeout(this.timer);
        if (this.running()) this.timer = setTimeout(() => this.load(), c.method === 'manual' ? 20_000 : 8_000);
      },
      error: (e) => this.error.set(apiMessage(e, this.translate.instant('connection.loadError'))),
    });
  }

  protected copy(value: string): void {
    void navigator.clipboard?.writeText(value).then(() => {
      this.copied.set(value);
      setTimeout(() => this.copied() === value && this.copied.set(null), 1500);
    });
  }

  protected retry(): void {
    this.act(this.api.retryConnection(this.id()));
  }

  protected detach(): void {
    if (!confirm(this.translate.instant('connection.confirmDetach'))) return;
    this.act(this.api.detach(this.id()));
  }

  private act(call: ReturnType<ApiService['detach']>): void {
    this.acting.set(true);
    call.subscribe({
      next: (c) => {
        this.acting.set(false);
        this.connection.set(c);
        this.load();
      },
      error: (e) => {
        this.acting.set(false);
        this.error.set(apiMessage(e, this.translate.instant('connection.actionError')));
      },
    });
  }
}
