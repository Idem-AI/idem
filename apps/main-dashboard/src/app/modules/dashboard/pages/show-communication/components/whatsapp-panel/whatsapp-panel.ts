import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { PublishNetwork, SocialAccountView, WhatsappHistoryItem, WhatsappLinkStart, WhatsappService, WhatsappStatus } from '../../../../services/whatsapp.service';

const NETWORKS: PublishNetwork[] = ['linkedin', 'facebook', 'instagram', 'x'];

/**
 * PUBLIER DEPUIS WHATSAPP.
 *
 * Trois états, dans l'ordre où on les traverse :
 *  1. compte gratuit → l'écran explique et renvoie vers les offres (la fonction est réservée aux
 *     comptes payants ; le serveur le contrôle aussi) ;
 *  2. pas encore lié → l'utilisateur saisit son numéro, IDEM lui envoie un code sur WhatsApp, il le
 *     recopie ici : c'est cette saisie, pas l'envoi, qui prouve que le téléphone est le sien ;
 *  3. lié → propositions du jour, heure, projet, historique, retrait.
 *
 * Rien n'est publié sans un « oui » de l'utilisateur sur WhatsApp : l'écran le dit.
 */
@Component({
  selector: 'app-whatsapp-panel',
  imports: [TranslateModule, RouterLink, DatePipe, IdemLoaderComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <idem-loader block [label]="'common.loading' | translate" />
    } @else if (status(); as s) {
      <div class="mx-auto max-w-3xl space-y-6">
        <header>
          <h2 class="text-xl font-semibold text-text-primary">{{ 'dashboard.showCommunication.whatsapp.title' | translate }}</h2>
          <p class="mt-1 text-sm text-text-secondary">{{ 'dashboard.showCommunication.whatsapp.subtitle' | translate }}</p>
        </header>

        @if (!s.entitled) {
          <!-- Le tambour parleur : « communiquer ». -->
          <section class="glass-card flex flex-col items-center gap-4 p-8 text-center">
            <svg class="h-24 w-24 text-text-tertiary" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M26 28 C26 20 70 20 70 28 C70 34 64 56 60 70 C56 78 40 78 36 70 C32 56 26 34 26 28Z" />
              <ellipse cx="48" cy="28" rx="22" ry="6" />
              <path d="M31 36 L44 70 M65 36 L52 70 M38 40 L48 72 M58 40 L48 72" opacity=".6" />
              <path d="M14 18 L28 30" style="color: var(--color-primary-500)" stroke="var(--color-primary-500)" />
              <path d="M82 18 L68 30" stroke="var(--color-primary-500)" />
            </svg>
            <h3 class="text-base font-semibold text-text-primary">{{ 'dashboard.showCommunication.whatsapp.paidTitle' | translate }}</h3>
            <p class="max-w-md text-sm text-text-secondary">
              {{ (s.reason === 'welcome_only' ? 'dashboard.showCommunication.whatsapp.paidWelcome' : 'dashboard.showCommunication.whatsapp.paidBody') | translate }}
            </p>
            <a class="inner-button" routerLink="/account/plans">{{ 'dashboard.showCommunication.whatsapp.seePlans' | translate }}</a>
          </section>
        } @else if (!s.available) {
          <p class="glass-card p-5 text-sm text-text-secondary" role="status">{{ 'dashboard.showCommunication.whatsapp.unavailable' | translate }}</p>
        } @else {
          <!-- 1. Réseaux -->
          <section class="glass-card p-5">
            <h3 class="text-sm font-semibold text-text-primary">{{ 'dashboard.showCommunication.whatsapp.networksTitle' | translate }}</h3>
            <p class="mt-1 text-xs text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.networksHint' | translate }}</p>
            <ul class="mt-3 divide-y divide-[var(--glass-border-subtle)]">
              @for (network of networks; track network) {
                <li class="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span class="font-medium text-text-primary">{{ 'dashboard.showCommunication.networks.' + network | translate }}</span>
                    @if (accountOf(network); as account) {
                      <span class="ml-2 text-xs text-success">{{ account.accountName || ('dashboard.showCommunication.whatsapp.connected' | translate) }}</span>
                    }
                  </span>
                  @if (accountOf(network)) {
                    <button type="button" class="button-ghost button-sm" (click)="disconnect(network)">{{ 'dashboard.showCommunication.whatsapp.disconnect' | translate }}</button>
                  } @else if (configured(network)) {
                    <button type="button" class="outer-button button-sm" [disabled]="busy()" (click)="connect(network)">{{ 'dashboard.showCommunication.whatsapp.connect' | translate }}</button>
                  } @else {
                    <span class="text-xs text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.soon' | translate }}</span>
                  }
                </li>
              }
            </ul>
          </section>

          <!-- 2. Liaison -->
          @if (!s.linked) {
            <section class="glass-card p-5">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'dashboard.showCommunication.whatsapp.linkTitle' | translate }}</h3>
              <p class="mt-1 text-xs text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.linkHint' | translate }}</p>
              @if (linkStart(); as start) {
                <div class="mt-4 space-y-3">
                  <p class="text-sm text-text-secondary">{{ 'dashboard.showCommunication.whatsapp.enterCode' | translate }}</p>
                  <input
                    type="text"
                    class="w-full rounded-lg border border-[var(--glass-border)] px-4 py-3 text-center font-mono text-lg tracking-wider text-text-primary"
                    [ngModel]="codeInput()"
                    (ngModelChange)="codeInput.set($event)"
                    name="whatsappCode"
                    maxlength="6"
                    autocomplete="one-time-code"
                    [attr.aria-label]="'dashboard.showCommunication.whatsapp.enterCode' | translate"
                  />
                  <button type="button" class="inner-button w-full" [disabled]="busy() || !codeInput().trim()" (click)="confirmLink()">
                    @if (busy()) {
                      <idem-loader size="xs" />
                    }
                    {{ 'dashboard.showCommunication.whatsapp.confirmCta' | translate }}
                  </button>
                  <p class="text-xs text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.waiting' | translate: { time: (start.expiresAt | date: 'HH:mm') } }}</p>
                  <button type="button" class="button-ghost button-sm" [disabled]="busy()" (click)="linkStart.set(null)">
                    {{ 'dashboard.showCommunication.whatsapp.changeNumber' | translate }}
                  </button>
                </div>
              } @else {
                <div class="mt-4 space-y-3">
                  <label class="block text-xs text-text-tertiary">
                    {{ 'dashboard.showCommunication.whatsapp.phoneLabel' | translate }}
                    <input
                      type="tel"
                      class="mt-1 w-full rounded-lg border border-[var(--glass-border)] px-4 py-3 text-sm text-text-primary"
                      [ngModel]="phoneInput()"
                      (ngModelChange)="phoneInput.set($event)"
                      name="whatsappPhone"
                      placeholder="+225 07 00 00 00 00"
                      autocomplete="tel"
                    />
                  </label>
                  <button type="button" class="inner-button" [disabled]="busy() || !phoneInput().trim()" (click)="startLink()">
                    @if (busy()) {
                      <idem-loader size="xs" />
                    }
                    {{ 'dashboard.showCommunication.whatsapp.linkCta' | translate }}
                  </button>
                </div>
              }
              @if (error(); as message) {
                <p class="mt-3 text-sm text-danger" role="alert">{{ message }}</p>
              }
            </section>
          } @else {
            <!-- 3. Lié -->
            <section class="glass-card space-y-4 p-5">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm text-text-primary">
                  <i class="pi pi-whatsapp mr-2 text-success" aria-hidden="true"></i>
                  {{ 'dashboard.showCommunication.whatsapp.linked' | translate: { last4: s.phoneLast4 } }}
                </p>
                <button type="button" class="button-ghost button-sm" (click)="unlink()">{{ 'dashboard.showCommunication.whatsapp.unlink' | translate }}</button>
              </div>

              <label class="flex items-start gap-3 text-sm">
                <input type="checkbox" [checked]="s.dailyProposals" (change)="setDaily($any($event.target).checked)" />
                <span>
                  <span class="block font-medium text-text-primary">{{ 'dashboard.showCommunication.whatsapp.dailyTitle' | translate }}</span>
                  <span class="block text-xs text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.dailyHint' | translate }}</span>
                </span>
              </label>

              @if (s.dailyProposals) {
                <label class="block text-xs text-text-tertiary">
                  {{ 'dashboard.showCommunication.whatsapp.hour' | translate }}
                  <select class="!w-28" (change)="setHour(+$any($event.target).value)">
                    @for (hour of hours; track hour) {
                      <option [value]="hour" [selected]="hour === s.sendHour">{{ hour }} h</option>
                    }
                  </select>
                </label>
              }

              <p class="rounded-lg border border-[var(--glass-border)] px-4 py-3 text-xs text-text-secondary">{{ 'dashboard.showCommunication.whatsapp.safety' | translate }}</p>
              @if (error(); as message) {
                <p class="text-sm text-danger" role="alert">{{ message }}</p>
              }
            </section>

            <section class="glass-card p-5">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'dashboard.showCommunication.whatsapp.historyTitle' | translate }}</h3>
              @if (history().length === 0) {
                <p class="mt-2 text-sm text-text-tertiary">{{ 'dashboard.showCommunication.whatsapp.historyEmpty' | translate }}</p>
              } @else {
                <ul class="mt-3 divide-y divide-[var(--glass-border-subtle)]">
                  @for (item of history(); track item._id) {
                    <li class="flex items-center justify-between gap-3 py-2 text-sm">
                      <span class="min-w-0">
                        <span class="block truncate text-text-primary">{{ item.caption || ('dashboard.showCommunication.whatsapp.noCaption' | translate) }}</span>
                        <span class="block text-xs text-text-tertiary">{{ item.createdAt | date: 'd MMM, HH:mm' }} · {{ item.networks.join(', ') }}</span>
                      </span>
                      <span class="shrink-0 text-xs" [class]="item.status === 'published' ? 'text-success' : item.status === 'awaiting' ? 'text-warning' : 'text-text-tertiary'">
                        {{ 'dashboard.showCommunication.whatsapp.status.' + item.status | translate }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </section>
          }
        }
      </div>
    } @else {
      <p class="text-sm text-text-secondary" role="alert">{{ 'dashboard.showCommunication.whatsapp.loadFailed' | translate }}</p>
    }
  `,
})
export class WhatsappPanel implements OnInit {
  private readonly service = inject(WhatsappService);

  readonly projectId = input.required<string>();

  protected readonly networks = NETWORKS;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly status = signal<WhatsappStatus | null>(null);
  protected readonly accounts = signal<SocialAccountView[]>([]);
  protected readonly history = signal<WhatsappHistoryItem[]>([]);
  protected readonly linkStart = signal<WhatsappLinkStart | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly phoneInput = signal('');
  protected readonly codeInput = signal('');

  protected readonly accountOf = (network: PublishNetwork) => this.accounts().find((a) => a.network === network && a.status === 'active') ?? null;
  protected readonly configured = (network: PublishNetwork) => this.status()?.networks.find((n) => n.network === network)?.configured ?? false;
  protected readonly isLinked = computed(() => this.status()?.linked ?? false);

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(showLoader = true): void {
    if (showLoader) this.loading.set(true);
    this.service.status().subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
        if (status.linked) this.linkStart.set(null);
        if (status.entitled && status.available) {
          this.service.accounts(this.projectId()).subscribe({ next: (r) => this.accounts.set(r.accounts), error: () => undefined });
          if (status.linked) this.service.history().subscribe({ next: (r) => this.history.set(r.items), error: () => undefined });
        }
      },
      error: () => {
        this.status.set(null);
        this.loading.set(false);
      },
    });
  }

  private fail(error: { error?: { message?: string } }): void {
    this.busy.set(false);
    this.error.set(error?.error?.message ?? 'Une erreur est survenue.');
  }

  protected startLink(): void {
    this.busy.set(true);
    this.error.set(null);
    this.service.startLink(this.projectId(), this.phoneInput().trim()).subscribe({
      next: (start) => {
        this.busy.set(false);
        this.linkStart.set(start);
        this.codeInput.set('');
      },
      error: (error) => this.fail(error),
    });
  }

  protected confirmLink(): void {
    this.busy.set(true);
    this.error.set(null);
    this.service.confirmLink(this.codeInput().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.linkStart.set(null);
        this.phoneInput.set('');
        this.codeInput.set('');
        this.refresh();
      },
      error: (error) => this.fail(error),
    });
  }

  protected unlink(): void {
    this.service.unlink().subscribe({ next: () => this.refresh(), error: (error) => this.fail(error) });
  }

  protected setDaily(enabled: boolean): void {
    this.error.set(null);
    this.service.updateSettings({ dailyProposals: enabled, defaultProjectId: this.projectId(), utcOffsetMinutes: -new Date().getTimezoneOffset() }).subscribe({
      next: () => this.refresh(false),
      error: (error) => {
        this.fail(error);
        this.refresh(false);
      },
    });
  }

  protected setHour(hour: number): void {
    this.service.updateSettings({ sendHour: hour }).subscribe({ next: () => this.refresh(false), error: (error) => this.fail(error) });
  }

  protected connect(network: PublishNetwork): void {
    this.busy.set(true);
    this.service.connectUrl(network, this.projectId()).subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (error) => this.fail(error),
    });
  }

  protected disconnect(network: PublishNetwork): void {
    this.service.disconnect(network, this.projectId()).subscribe({ next: () => this.refresh(false), error: (error) => this.fail(error) });
  }
}
