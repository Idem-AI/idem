import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { BillingService } from '../../../billing/services/billing.service';
import {
  BuyOfferRequest,
  OffersCatalog,
  PackCode,
  PassCode,
  WalletView,
} from '../../../billing/models/billing.model';
import { CheckoutComponent } from '../../../billing/components/checkout/checkout';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { WalletIllustrationComponent } from '../../../../shared/components/wallet-illustration/wallet-illustration';

/**
 * Le portefeuille et les offres — modèle « Créer, Garder, Faire tourner, Grandir ».
 *
 * Une seule chose se paie en mobile money : la RECHARGE du portefeuille, du montant choisi.
 * Tout le reste s'achète avec le solde, en francs, en un geste : forfaits du mois, packs, et
 * (depuis les pages de livrables) les versions finales. Trois blocs, dans l'ordre des questions
 * qu'on se pose :
 *
 *  1. « Combien j'ai ? » — le solde, et la recharge (montants suggérés, bonus annoncé) ;
 *  2. « Qu'est-ce que je peux prendre ? » — les forfaits (un mois ou un an), puis les packs ;
 *  3. « Où est passé mon argent ? » — le relevé.
 *
 * Les prix viennent de l'API (`GET /billing/offers`) ; rien n'est chiffré ici.
 *
 * Arrivée depuis une page de prix (`?buy=pass-croissance`, `?buy=pack-lancement`,
 * `?buy=icode-pack-100`…) : l'offre choisie s'ouvre dans une fenêtre de confirmation, avec son
 * prix et le solde. On n'achète rien sans ce dernier geste.
 */
@Component({
  selector: 'app-account-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, IdemLoaderComponent, CheckoutComponent, WalletIllustrationComponent],
  template: `
    @if (offers() && wallet(); as w) {
      <!-- 1. Le solde et la recharge -->
      <section class="glass-card mb-8 grid gap-6 p-5 sm:grid-cols-[1fr_10rem] sm:items-center">
        <div>
          <p class="text-sm text-text-tertiary">{{ 'billing.wallet.balance' | translate }}</p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-text-primary">{{ w.balanceXaf | number: '1.0-0' }} F</p>

          <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            @if (w.beta.active) {
              <li>{{ 'billing.wallet.betaActive' | translate }}</li>
            }
            @for (pass of activePasses(); track pass.code) {
              <li>{{ 'billing.wallet.passUntil' | translate: { pass: pass.label, date: (pass.until | date: 'd MMMM') } }}</li>
            }
            @if (w.modifications > 0) {
              <li>{{ 'billing.wallet.modifications' | translate: { count: w.modifications } }}</li>
            }
            @if (w.vitrineDays > 0) {
              <li>{{ 'billing.wallet.vitrineDays' | translate: { count: w.vitrineDays } }}</li>
            }
            @if (w.projectPassVouchers > 0) {
              <li>{{ 'billing.wallet.projectPasses' | translate: { count: w.projectPassVouchers } }}</li>
            }
          </ul>

          <p class="mt-5 text-sm font-medium text-text-primary">{{ 'billing.wallet.topUpTitle' | translate }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (amount of suggested(); track amount.amountXaf) {
              <button
                type="button"
                class="outer-button button-sm"
                [class.!border-primary]="topupAmount() === amount.amountXaf"
                (click)="topupAmount.set(amount.amountXaf)"
              >
                {{ amount.amountXaf | number: '1.0-0' }} F
                @if (amount.bonusXaf) {
                  <span class="text-success">+{{ amount.bonusXaf | number: '1.0-0' }}</span>
                }
              </button>
            }
          </div>
          <div class="mt-3 flex flex-wrap items-end gap-2">
            <label class="text-xs text-text-tertiary">
              {{ 'billing.wallet.otherAmount' | translate }}
              <input
                type="number"
                class="!w-36"
                [min]="offers()!.topup.minXaf"
                [max]="offers()!.topup.maxXaf"
                [step]="offers()!.topup.stepXaf"
                [ngModel]="topupAmount()"
                (ngModelChange)="topupAmount.set(+$event || 0)"
              />
            </label>
            <button type="button" class="inner-button" [disabled]="!validAmount()" (click)="startTopUp()">
              {{ 'billing.wallet.topUp' | translate: { amount: (topupAmount() | number: '1.0-0') } }}
            </button>
          </div>
          <p class="mt-2 text-xs text-text-tertiary">{{ 'billing.wallet.bonusRule' | translate }}</p>
        </div>
        <app-wallet-illustration class="mx-auto w-40" />
      </section>

      @if (checkout(); as order) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" (click)="closeCheckout()">
          <div class="modal-panel w-full max-w-md p-5" (click)="$event.stopPropagation()">
            <app-checkout
              productCode="wallet-topup"
              [amountXaf]="order.amountXaf"
              [then]="order.then"
              (completed)="onPaid()"
              (dismissed)="closeCheckout()"
            />
          </div>
        </div>
      }

      @if (intent(); as want) {
        <div class="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" (click)="closeIntent()">
          <div class="modal-panel w-full max-w-md p-5" role="dialog" aria-modal="true" aria-labelledby="intent-title" (click)="$event.stopPropagation()">
            <p class="text-xs text-text-tertiary">{{ 'billing.wallet.intent.title' | translate }}</p>
            <h2 id="intent-title" class="mt-1 text-lg font-semibold text-text-primary">{{ want.label }}</h2>
            <p class="mt-2">
              <span class="text-3xl font-bold tabular-nums text-text-primary">{{ want.priceXaf | number: '1.0-0' }} F</span>
              @if (want.cadence) {
                <span class="text-sm text-text-tertiary"> {{ want.cadence | translate }}</span>
              }
            </p>
            @if (want.description) {
              <p class="mt-2 text-sm text-text-secondary">{{ want.description }}</p>
            }
            @if (want.lines.length) {
              <ul class="mt-3 space-y-1">
                @for (line of want.lines; track line) {
                  <li class="flex gap-2 text-sm text-text-secondary">
                    <i class="pi pi-check mt-1 text-[10px] text-success" aria-hidden="true"></i>
                    <span>{{ line }}</span>
                  </li>
                }
              </ul>
            }

            @if (want.needsProject && !projectName()) {
              <div class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-text-primary">
                <p>{{ 'billing.wallet.intent.noProject' | translate }}</p>
                <a class="outer-button button-sm mt-2 inline-flex" routerLink="/create-project">{{ 'billing.wallet.intent.createProject' | translate }}</a>
              </div>
            } @else if (want.needsProject) {
              <p class="mt-4 text-sm text-text-secondary">{{ 'billing.wallet.intent.forProject' | translate: { project: projectName() } }}</p>
            }
            @if (want.request.kind === 'pack' && want.request.code === 'lancement_domaine') {
              <label class="mt-3 block text-xs text-text-tertiary">
                {{ 'billing.wallet.domain' | translate }}
                <input type="text" placeholder="mon-entreprise.africa" [ngModel]="domain()" (ngModelChange)="domain.set($event)" />
              </label>
            }

            <p class="mt-4 text-sm text-text-secondary">
              {{ 'billing.wallet.intent.balance' | translate: { amount: (w.balanceXaf | number: '1.0-0') } }}
              @if (w.balanceXaf < want.priceXaf) {
                · {{ 'billing.wallet.intent.topUpFirst' | translate }}
              }
            </p>
            @if (intentError(); as message) {
              <p class="mt-2 text-sm text-danger" role="alert">{{ message }}</p>
            }
            <div class="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" class="button-ghost" (click)="closeIntent()">{{ 'common.cancel' | translate }}</button>
              <button type="button" class="inner-button" [disabled]="busy() === 'intent' || !intentReady()" (click)="confirmIntent()">
                @if (busy() === 'intent') {
                  <idem-loader size="xs" />
                }
                {{ 'billing.wallet.intent.confirm' | translate: { amount: (want.priceXaf | number: '1.0-0') } }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (notice(); as message) {
        <p class="mb-6 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-text-primary" role="status">{{ message }}</p>
      }

      <!-- 2. Les forfaits -->
      <section class="mb-8">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-text-primary">{{ 'billing.wallet.passesTitle' | translate }}</h2>
            <p class="text-xs text-text-tertiary">{{ 'billing.wallet.passesHint' | translate }}</p>
          </div>
          <div class="flex gap-1 rounded-lg border border-[var(--glass-border)] p-1">
            <button type="button" class="button-ghost button-sm" [class.!text-primary]="interval() === 'month'" (click)="interval.set('month')">
              {{ 'billing.plans.monthly' | translate }}
            </button>
            <button type="button" class="button-ghost button-sm" [class.!text-primary]="interval() === 'year'" (click)="interval.set('year')">
              {{ 'billing.plans.yearly' | translate }} · {{ 'billing.plans.yearlyHint' | translate }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          @for (pass of offers()!.passes; track pass.code) {
            <div class="glass-card relative flex flex-col p-4" [class.!border-primary]="pass.code === 'croissance'">
              @if (pass.code === 'croissance') {
                <span class="tag absolute -top-3 left-4 !bg-primary !text-white">{{ 'billing.wallet.recommended' | translate }}</span>
              }
              <p class="text-sm font-semibold text-text-primary">{{ pass.label }}</p>
              <p class="mt-2">
                <span class="text-2xl font-bold tabular-nums text-text-primary">
                  {{ (interval() === 'year' ? pass.annualXaf : pass.monthlyXaf) | number: '1.0-0' }}
                </span>
                <span class="text-sm text-text-tertiary">F{{ (interval() === 'year' ? 'billing.plans.perYear' : 'billing.plans.perMonth') | translate }}</span>
              </p>
              <p class="text-xs font-medium text-primary">
                {{ 'billing.wallet.perDay' | translate: { amount: (pass.monthlyXaf / 30 | number: '1.0-0') } }}
                @if (interval() === 'year') {
                  · {{ 'billing.wallet.saveYear' | translate: { amount: ((pass.monthlyXaf * 12 - pass.annualXaf) | number: '1.0-0') } }}
                }
              </p>
              @if (capOf(pass.code); as cap) {
                <p class="mt-1 text-xs text-text-secondary">{{ 'billing.wallet.capRule' | translate: { cap: (cap | number: '1.0-0') } }}</p>
              }
              <ul class="mt-3 space-y-1">
                @for (line of pass.covers; track line) {
                  <li class="flex gap-2 text-xs text-text-secondary">
                    <i class="pi pi-check mt-0.5 text-[10px] text-success" aria-hidden="true"></i>
                    <span>{{ line }}</span>
                  </li>
                }
              </ul>
              <div class="mt-auto pt-4">
                @if (passUntil(pass.code); as until) {
                  <p class="mb-2 text-center text-xs text-success">{{ 'billing.wallet.activeUntil' | translate: { date: (until | date: 'd MMMM y') } }}</p>
                }
                <button type="button" class="w-full" [class]="pass.code === 'croissance' ? 'inner-button' : 'outer-button'" [disabled]="busy() === pass.code" (click)="buy({ kind: 'pass', code: pass.code, interval: interval() }, pass.code)">
                  @if (busy() === pass.code) {
                    <idem-loader size="xs" />
                  }
                  {{ (passUntil(pass.code) ? 'billing.wallet.extend' : 'billing.wallet.activate') | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Les packs -->
      <section class="mb-8">
        <h2 class="text-base font-semibold text-text-primary">{{ 'billing.wallet.packsTitle' | translate }}</h2>
        <p class="mb-3 text-xs text-text-tertiary">{{ 'billing.wallet.packsHint' | translate: { project: projectName() || '—' } }}</p>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          @for (pack of offers()!.packs; track pack.code) {
            <div class="glass-card flex flex-col p-4">
              <p class="text-sm font-semibold text-text-primary">{{ pack.label }}</p>
              @if (packValue(pack.code); as value) {
                <p class="mt-2 text-xs tabular-nums text-text-tertiary line-through">{{ value | number: '1.0-0' }} F</p>
              }
              <p class="text-xl font-bold tabular-nums text-text-primary">{{ pack.priceXaf | number: '1.0-0' }} F</p>
              @if (packValue(pack.code); as value) {
                <p class="text-xs font-medium text-success">{{ 'billing.wallet.saveYear' | translate: { amount: ((value - pack.priceXaf) | number: '1.0-0') } }}</p>
              }
              <p class="mt-2 text-xs text-text-secondary">{{ pack.description }}</p>
              @if (pack.code === 'lancement_domaine') {
                <label class="mt-3 text-xs text-text-tertiary">
                  {{ 'billing.wallet.domain' | translate }}
                  <input type="text" placeholder="mon-entreprise.africa" [ngModel]="domain()" (ngModelChange)="domain.set($event)" />
                </label>
              }
              <div class="mt-auto pt-4">
                <button type="button" class="outer-button w-full" [disabled]="busy() === pack.code || !canBuyPack(pack.code)" (click)="buyPack(pack.code)">
                  @if (busy() === pack.code) {
                    <idem-loader size="xs" />
                  }
                  {{ 'billing.plans.buy' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Code IDEM (agent, cadeau, pack « À plusieurs ») -->
      <section class="glass-card mb-8 p-4">
        <h2 class="text-sm font-semibold text-text-primary">{{ 'billing.wallet.codeTitle' | translate }}</h2>
        <p class="text-xs text-text-tertiary">{{ 'billing.wallet.codeHint' | translate }}</p>
        <div class="mt-3 flex flex-wrap items-end gap-2">
          <input type="text" class="!w-56 uppercase" placeholder="IDEM-XXXXX-XXXXX" [ngModel]="code()" (ngModelChange)="code.set($event)" />
          <button type="button" class="outer-button" [disabled]="!code().trim() || busy() === 'code'" (click)="redeem()">
            @if (busy() === 'code') {
              <idem-loader size="xs" />
            }
            {{ 'billing.wallet.redeem' | translate }}
          </button>
        </div>
      </section>

      @if (error(); as message) {
        <p class="mb-6 text-sm text-danger" role="alert">{{ message }}</p>
      }

      <!-- 3. Le relevé -->
      <section>
        <h2 class="mb-3 text-base font-semibold text-text-primary">{{ 'billing.wallet.statementTitle' | translate }}</h2>
        @if (w.statement.length === 0) {
          <p class="text-sm text-text-tertiary">{{ 'billing.wallet.noStatement' | translate }}</p>
        } @else {
          <ul class="divide-y divide-[var(--glass-border-subtle)]">
            @for (entry of w.statement; track $index) {
              <li class="flex items-center justify-between gap-4 py-2 text-sm">
                <span class="min-w-0">
                  <span class="block truncate text-text-primary">{{ entry.note || ('billing.wallet.reasons.' + entry.reason | translate) }}</span>
                  <span class="block text-xs text-text-tertiary">{{ entry.createdAt | date: 'd MMM y, HH:mm' }}</span>
                </span>
                <span class="shrink-0 tabular-nums" [class]="entry.delta >= 0 ? 'text-success' : 'text-text-secondary'">
                  {{ entry.delta >= 0 ? '+' : '' }}{{ entry.delta | number: '1.0-0' }} F
                </span>
              </li>
            }
          </ul>
        }
      </section>
    } @else if (loadFailed()) {
      <p class="text-sm text-text-secondary" role="alert">{{ 'billing.wallet.unavailable' | translate }}</p>
    } @else {
      <idem-loader block [label]="'common.loading' | translate" />
    }
  `,
})
export class AccountPlansPage {
  private readonly billing = inject(BillingService);
  private readonly currentProject = inject(CurrentProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly offers = signal<OffersCatalog | null>(null);
  protected readonly wallet = signal<WalletView | null>(null);
  protected readonly loadFailed = signal(false);

  protected readonly interval = signal<'month' | 'year'>('month');
  protected readonly topupAmount = signal(1000);
  protected readonly checkout = signal<{ amountXaf: number; then?: BuyOfferRequest } | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly domain = signal('');
  /** L'offre demandée par une page de prix (`?buy=`), en attente de confirmation. */
  private readonly wanted = signal<string | null>(null);
  protected readonly intentError = signal<string | null>(null);

  protected readonly projectName = computed(() => this.currentProject.selected()?.name ?? null);

  protected readonly suggested = computed(() => this.offers()?.topup.bonusExamples ?? []);

  protected readonly validAmount = computed(() => {
    const topup = this.offers()?.topup;
    const amount = this.topupAmount();
    return Boolean(topup) && Number.isInteger(amount) && amount >= topup!.minXaf && amount <= topup!.maxXaf && amount % topup!.stepXaf === 0;
  });

  protected readonly activePasses = computed(() => {
    const passes = this.wallet()?.passes ?? {};
    const labels = new Map((this.offers()?.passes ?? []).map((pass) => [pass.code, pass.label]));
    return (Object.entries(passes) as [PassCode, string][])
      .filter(([, until]) => Boolean(until))
      .map(([code, until]) => ({ code, label: labels.get(code) ?? code, until }));
  });

  /** L'offre de `?buy=` résolue contre le catalogue : nom, prix, ce qu'elle contient. */
  protected readonly intent = computed(() => {
    const wanted = this.wanted();
    const offers = this.offers();
    if (!wanted || !offers) return null;
    const [family, ...rest] = wanted.split('-');
    const code = rest.join('-');
    if (family === 'pass') {
      const pass = offers.passes.find((p) => p.code === code);
      if (!pass) return null;
      const yearly = this.interval() === 'year';
      return {
        label: pass.label,
        priceXaf: yearly ? pass.annualXaf : pass.monthlyXaf,
        cadence: yearly ? 'billing.wallet.intent.perYear' : 'billing.wallet.intent.perMonth',
        description: null,
        lines: pass.covers,
        needsProject: false,
        request: { kind: 'pass', code: pass.code, interval: this.interval() } as BuyOfferRequest,
      };
    }
    if (family === 'pack') {
      const pack = offers.packs.find((p) => p.code === code);
      if (!pack) return null;
      return {
        label: pack.label,
        priceXaf: pack.priceXaf,
        cadence: null,
        description: pack.description,
        lines: [] as string[],
        needsProject: pack.code !== 'a_plusieurs',
        request: { kind: 'pack', code: pack.code } as BuyOfferRequest,
      };
    }
    if (wanted === 'icode-pack-100') {
      return {
        label: this.translate.instant('billing.wallet.intent.icodePack100') as string,
        priceXaf: offers.icode['pack100Xaf'] ?? 0,
        cadence: null,
        description: null,
        lines: [] as string[],
        needsProject: false,
        request: { kind: 'icode_pack_100' } as BuyOfferRequest,
      };
    }
    return null;
  });

  protected readonly intentReady = computed(() => {
    const want = this.intent();
    if (!want) return false;
    if (want.needsProject && !this.currentProject.selectedId()) return false;
    if (want.request.kind === 'pack' && want.request.code === 'lancement_domaine') return /\.(africa|com)$/i.test(this.domain().trim());
    return true;
  });

  constructor() {
    this.load();
    const query = this.route.snapshot.queryParamMap;
    this.wanted.set(query.get('buy'));
    if (query.get('interval') === 'year') this.interval.set('year');
    // Arrivée depuis iDeploy ou iVision avec un montant (`?topup=1000`) : il est présélectionné.
    const requested = Number(this.route.snapshot.queryParamMap.get('topup'));
    if (Number.isInteger(requested) && requested > 0) this.topupAmount.set(requested);
  }

  private load(): void {
    this.billing.getOffers().subscribe({
      next: (offers) => this.offers.set(offers),
      error: () => this.loadFailed.set(true),
    });
    this.refreshWallet();
  }

  private refreshWallet(): void {
    this.billing.getWallet().subscribe({
      next: (wallet) => this.wallet.set(wallet),
      error: () => this.loadFailed.set(true),
    });
  }

  protected passUntil(code: PassCode): string | null {
    return this.wallet()?.passes?.[code] ?? null;
  }

  /** Valeur des parties achetées une à une (Kit 7 500 + Pass 1 000 + 90 jours de Vitrine…). */
  protected packValue(code: PackCode): number {
    return { lancement: 9400, lancement_domaine: 15900, a_plusieurs: 25000 }[code];
  }

  protected capOf(code: PassCode): number | null {
    return this.offers()?.monthlyCaps?.[code] ?? null;
  }

  protected startTopUp(then?: BuyOfferRequest): void {
    if (!this.validAmount()) return;
    this.checkout.set({ amountXaf: this.topupAmount(), then });
  }

  protected closeCheckout(): void {
    this.checkout.set(null);
    this.refreshWallet();
  }

  protected onPaid(): void {
    this.billing.loadMe().subscribe();
    this.refreshWallet();
  }

  protected canBuyPack(code: PackCode): boolean {
    if (code === 'a_plusieurs') return true;
    if (!this.currentProject.selectedId()) return false;
    return code !== 'lancement_domaine' || /\.(africa|com)$/i.test(this.domain().trim());
  }

  protected buyPack(code: PackCode): void {
    const projectId = this.currentProject.selectedId() ?? undefined;
    this.buy({ kind: 'pack', code, projectId, ...(code === 'lancement_domaine' ? { domain: this.domain().trim() } : {}) }, code);
  }

  /**
   * Achat depuis le portefeuille. Un solde insuffisant répond 402 : l'intercepteur ouvre le
   * paywall, qui propose la recharge exacte puis refait cet achat.
   */
  protected buy(request: BuyOfferRequest, key: string): void {
    this.busy.set(key);
    this.error.set(null);
    this.notice.set(null);
    this.billing.buyOffer(request).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.notice.set(result.message);
        this.refreshWallet();
      },
      error: (error) => {
        this.busy.set(null);
        if (error?.status !== 402) this.error.set(error?.error?.message ?? null);
      },
    });
  }

  protected closeIntent(): void {
    this.wanted.set(null);
    this.intentError.set(null);
    // L'adresse oublie l'offre : recharger la page ne rouvre pas la fenêtre.
    this.router.navigate([], { relativeTo: this.route, queryParams: { buy: null, interval: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Le dernier geste : l'achat part du portefeuille ; un solde court ouvre le paywall (402). */
  protected confirmIntent(): void {
    const want = this.intent();
    if (!want || !this.intentReady()) return;
    let request = want.request;
    if (request.kind === 'pack') {
      request = {
        ...request,
        projectId: this.currentProject.selectedId() ?? undefined,
        ...(request.code === 'lancement_domaine' ? { domain: this.domain().trim() } : {}),
      };
    }
    this.busy.set('intent');
    this.intentError.set(null);
    this.billing.buyOffer(request).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.notice.set(result.message);
        this.closeIntent();
        this.refreshWallet();
      },
      error: (error) => {
        this.busy.set(null);
        if (error?.status === 402) this.closeIntent();
        else this.intentError.set(error?.error?.message ?? null);
      },
    });
  }

  protected redeem(): void {
    this.busy.set('code');
    this.error.set(null);
    this.notice.set(null);
    this.billing.redeemCode(this.code().trim(), this.currentProject.selectedId() ?? undefined).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.code.set('');
        this.notice.set(result.message);
        this.refreshWallet();
      },
      error: (error) => {
        this.busy.set(null);
        this.error.set(error?.error?.message ?? null);
      },
    });
  }
}
