import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { DomainSession, Quote } from '../../core/models';
import { DomainSearch } from '../../shared/components/domain-search';
import { Illustration } from '../../shared/components/illustration';

/**
 * Le parcours ouvert depuis iDeploy (ou iCode) après une mise en ligne : « votre application est
 * en ligne, voulez-vous votre propre nom ? ». Deux chemins côte à côte — acheter un nom, ou
 * brancher celui qu'on a déjà — et l'on revient ensuite là où l'on était.
 */
@Component({
  selector: 'idm-connect',
  imports: [FormsModule, RouterLink, TranslateModule, IdemLoaderComponent, DomainSearch, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-10">
      @if (error()) {
        <section class="glass-card flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="110" />
          <p class="mt-4 font-semibold">{{ error() }}</p>
          <a routerLink="/" class="outer-button mt-5">{{ 'connect.searchInstead' | translate }}</a>
        </section>
      } @else if (!session()) {
        <idem-loader block [label]="'common.loading' | translate" />
      } @else {
        @let s = session()!;
        <section class="flex flex-col items-center text-center">
          <idm-illustration kind="pirogue" [width]="160" />
          <h1 class="mt-4 text-2xl font-semibold">{{ 'connect.title' | translate: { app: s.appName || s.appUuid } }}</h1>
          <p class="mt-2 max-w-lg text-sm text-[var(--color-text-secondary)]">{{ 'connect.lead' | translate }}</p>
        </section>

        <div class="mt-8 grid gap-2 sm:grid-cols-2" role="tablist" [attr.aria-label]="'connect.choose' | translate">
          <button type="button" role="tab" class="glass-card p-4 text-left" [attr.aria-selected]="mode() === 'buy'" [style.outline]="mode() === 'buy' ? '2px solid var(--color-primary-500)' : null" (click)="mode.set('buy')">
            <span class="block font-semibold">{{ 'connect.buyTitle' | translate }}</span>
            <span class="mt-1 block text-sm text-[var(--color-text-secondary)]">{{ 'connect.buyBody' | translate }}</span>
          </button>
          <button type="button" role="tab" class="glass-card p-4 text-left" [attr.aria-selected]="mode() === 'own'" [style.outline]="mode() === 'own' ? '2px solid var(--color-primary-500)' : null" (click)="mode.set('own')">
            <span class="block font-semibold">{{ 'connect.ownTitle' | translate }}</span>
            <span class="mt-1 block text-sm text-[var(--color-text-secondary)]">{{ 'connect.ownBody' | translate }}</span>
          </button>
        </div>

        <section class="mt-6" role="tabpanel">
          @if (mode() === 'buy') {
            <idm-domain-search [allowConnect]="true" (chosen)="buy($event)" (connectOwned)="useOwn($event)" />
          } @else {
            <form class="glass-card p-5" (ngSubmit)="connectOwn()">
              <label for="own-domain">{{ 'connect.ownLabel' | translate }}</label>
              <div class="mt-1 flex flex-col gap-2 sm:flex-row">
                <input id="own-domain" type="text" name="own" class="flex-1" placeholder="ma-boutique.com" autocapitalize="none" spellcheck="false" [(ngModel)]="own" />
                <button type="submit" class="inner-button inline-flex items-center justify-center gap-2" [disabled]="!own.trim() || connecting()">
                  @if (connecting()) { <idem-loader size="xs" /> }
                  {{ 'connect.ownSubmit' | translate }}
                </button>
              </div>
              <p class="mt-2 text-xs text-[var(--color-text-tertiary)]">{{ 'connect.ownHint' | translate }}</p>
              @if (connectError()) { <p class="mt-2 text-sm text-[var(--color-danger)]" role="alert">{{ connectError() }}</p> }
            </form>
          }
        </section>

        @if (s.returnUrl) {
          <p class="mt-8 text-center"><a [href]="s.returnUrl" class="button-ghost button-sm">{{ 'connect.later' | translate }}</a></p>
        }
      }
    </div>
  `,
})
export class ConnectPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly sessionId = inject(ActivatedRoute).snapshot.queryParamMap.get('session');

  protected readonly session = signal<DomainSession | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly mode = signal<'buy' | 'own'>('buy');
  protected readonly connecting = signal(false);
  protected readonly connectError = signal<string | null>(null);
  protected own = '';

  constructor() {
    if (!this.sessionId) {
      this.error.set(this.translate.instant('connect.noSession'));
      return;
    }
    this.api.domainSession(this.sessionId).subscribe({
      next: (s) => this.session.set(s),
      error: (e) => this.error.set(apiMessage(e, this.translate.instant('connect.noSession'))),
    });
  }

  protected buy(q: Quote): void {
    void this.router.navigate(['/checkout'], { queryParams: { domain: q.domain, session: this.sessionId } });
  }

  protected useOwn(domain: string): void {
    this.own = domain;
    this.mode.set('own');
  }

  protected connectOwn(): void {
    const s = this.session();
    if (!s) return;
    this.connecting.set(true);
    this.connectError.set(null);
    this.api.connect({ host: this.own.trim(), appUuid: s.appUuid, domainSessionId: s.id }).subscribe({
      next: (c) => void this.router.navigate(['/connections', c.id], { queryParams: { session: s.id } }),
      error: (e) => {
        this.connecting.set(false);
        this.connectError.set(apiMessage(e, this.translate.instant('domain.connectError')));
      },
    });
  }
}
