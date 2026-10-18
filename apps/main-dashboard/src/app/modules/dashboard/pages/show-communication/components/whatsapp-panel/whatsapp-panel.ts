import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { interval, take } from 'rxjs';
import { PublishNetwork, SocialAccountView, WhatsappHistoryItem, WhatsappLinkStart, WhatsappService, WhatsappStatus } from '../../../../services/whatsapp.service';
import { channelIcon } from '../../communication-ui';
import { digitsOf, groupDigits, parseInternational } from './whatsapp-countries';
import { WhatsappCodeField } from './whatsapp-code-field';
import { WhatsappPhoneField } from './whatsapp-phone-field';

const NETWORKS: PublishNetwork[] = ['linkedin', 'facebook', 'instagram', 'x'];

/** Heures proposées d'un geste ; toute autre heure reste possible dans la liste. */
const QUICK_HOURS = [7, 9, 12, 18];

/** Pause avant de pouvoir redemander un code (le serveur limite aussi : 5 par heure). */
const RESEND_AFTER_SECONDS = 30;

type StepId = 'phone' | 'networks' | 'daily';
type StepState = 'done' | 'next' | 'todo';

/** Où afficher l'erreur : sous le champ qui a échoué, pas en bas de page. */
type ErrorSpot = 'phone' | 'code' | 'general';

/**
 * PUBLIER DEPUIS WHATSAPP — un parcours en trois étapes, dans l'ordre où on les traverse.
 *
 *  0. compte gratuit → l'écran explique et renvoie vers les offres (la fonction est réservée aux
 *     comptes payants ; le serveur le contrôle aussi) ;
 *  1. lier son WhatsApp : l'utilisateur saisit son numéro, IDEM lui envoie un code sur WhatsApp, il le
 *     recopie ici — c'est cette saisie, pas l'envoi, qui prouve que le téléphone est le sien ;
 *  2. connecter ses réseaux ;
 *  3. choisir quand recevoir les propositions du jour.
 *
 * Comme sur l'accueil, aucune étape n'est verrouillée : on signale seulement la suivante conseillée.
 * Rien n'est publié sans un « oui » de l'utilisateur sur WhatsApp : l'écran le dit, à côté, avec
 * un exemple du message qu'il recevra.
 */
@Component({
  selector: 'app-whatsapp-panel',
  imports: [TranslateModule, RouterLink, DatePipe, IdemLoaderComponent, WhatsappPhoneField, WhatsappCodeField],
  templateUrl: './whatsapp-panel.html',
  styleUrl: './whatsapp-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappPanel implements OnInit {
  private readonly service = inject(WhatsappService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();

  private readonly codeField = viewChild(WhatsappCodeField);

  protected readonly networks = NETWORKS;
  protected readonly quickHours = QUICK_HOURS;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly channelIcon = channelIcon;

  protected readonly status = signal<WhatsappStatus | null>(null);
  protected readonly accounts = signal<SocialAccountView[]>([]);
  protected readonly history = signal<WhatsappHistoryItem[]>([]);
  protected readonly linkStart = signal<WhatsappLinkStart | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly saving = signal(false);
  protected readonly connecting = signal<PublishNetwork | null>(null);
  protected readonly error = signal<{ spot: ErrorSpot; message: string } | null>(null);
  protected readonly confirmingUnlink = signal(false);

  /** Le numéro saisi, « +2250700000000 » (vide tant que ce n'est pas exploitable). */
  protected readonly phone = signal('');
  protected readonly code = signal('');
  /** Le numéro auquel le code est parti, pour le relire sous le champ. */
  protected readonly sentTo = signal('');
  protected readonly resendIn = signal(0);

  protected readonly phoneReady = computed(() => {
    const length = digitsOf(this.phone()).length;
    return length >= 8 && length <= 15;
  });
  protected readonly codeReady = computed(() => /^[A-Z0-9]{6}$/.test(this.code()));
  /** « +225 07 00 00 00 00 », lisible. */
  protected readonly sentToLabel = computed(() => {
    const parsed = parseInternational(this.sentTo());
    return parsed ? `+${parsed.country.dial} ${groupDigits(parsed.national)}` : this.sentTo();
  });

  protected readonly connectedCount = computed(() => NETWORKS.filter((network) => this.accountOf(network)).length);

  /** Les trois étapes, avec leur état lu sur les données (jamais une case cochée à la main). */
  protected readonly steps = computed<{ id: StepId; state: StepState }[]>(() => {
    const s = this.status();
    const done: Record<StepId, boolean> = {
      phone: !!s?.linked,
      networks: this.connectedCount() > 0,
      daily: !!s?.linked && !!s.dailyProposals,
    };
    const order: StepId[] = ['phone', 'networks', 'daily'];
    const nextId = order.find((id) => !done[id]);
    return order.map((id) => ({ id, state: done[id] ? 'done' : id === nextId ? 'next' : 'todo' }));
  });

  protected readonly stateOf = (id: StepId): StepState => this.steps().find((step) => step.id === id)?.state ?? 'todo';
  protected readonly accountOf = (network: PublishNetwork) => this.accounts().find((a) => a.network === network && a.status === 'active') ?? null;
  protected readonly configured = (network: PublishNetwork) => this.status()?.networks.find((n) => n.network === network)?.configured ?? false;
  protected readonly errorAt = (spot: ErrorSpot): string | null => (this.error()?.spot === spot ? this.error()!.message : null);

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

  private fail(error: { error?: { message?: string } }, spot: ErrorSpot = 'general'): void {
    this.busy.set(false);
    this.saving.set(false);
    this.connecting.set(null);
    this.error.set({ spot, message: error?.error?.message ?? this.translate.instant('dashboard.showCommunication.whatsapp.genericError') });
  }

  // ── Étape 1 : lier son WhatsApp ────────────────────────────────────────────

  protected onPhoneChange(value: string): void {
    this.phone.set(value);
    if (this.error()?.spot === 'phone') this.error.set(null);
  }

  protected startLink(): void {
    if (this.busy() || !this.phoneReady()) return;
    this.busy.set(true);
    this.error.set(null);
    const phone = this.phone();
    this.service.startLink(this.projectId(), phone).subscribe({
      next: (start) => {
        this.busy.set(false);
        this.sentTo.set(phone);
        this.linkStart.set(start);
        this.code.set('');
        this.startCooldown();
        // Le temps que la zone du code apparaisse, puis le curseur y est.
        setTimeout(() => this.codeField()?.focusFirst());
      },
      error: (error) => this.fail(error, 'phone'),
    });
  }

  protected resend(): void {
    if (this.resendIn() > 0) return;
    this.phone.set(this.sentTo());
    this.startLink();
  }

  protected onCodeChange(value: string): void {
    this.code.set(value.trim());
    if (this.error()?.spot === 'code') this.error.set(null);
  }

  protected confirmLink(): void {
    if (this.busy() || !this.codeReady()) return;
    this.busy.set(true);
    this.error.set(null);
    this.service.confirmLink(this.code()).subscribe({
      next: () => {
        this.busy.set(false);
        this.linkStart.set(null);
        this.phone.set('');
        this.code.set('');
        this.refresh(false);
      },
      error: (error) => {
        this.fail(error, 'code');
        this.code.set('');
        this.codeField()?.focusFirst();
      },
    });
  }

  protected changeNumber(): void {
    this.linkStart.set(null);
    this.phone.set('');
    this.code.set('');
    this.error.set(null);
  }

  private startCooldown(): void {
    this.resendIn.set(RESEND_AFTER_SECONDS);
    interval(1000)
      .pipe(take(RESEND_AFTER_SECONDS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resendIn.update((seconds) => Math.max(0, seconds - 1)));
  }

  protected unlink(): void {
    if (!this.confirmingUnlink()) {
      this.confirmingUnlink.set(true);
      return;
    }
    this.confirmingUnlink.set(false);
    this.service.unlink().subscribe({ next: () => this.refresh(false), error: (error) => this.fail(error) });
  }

  // ── Étape 2 : les réseaux ──────────────────────────────────────────────────

  protected connect(network: PublishNetwork): void {
    this.connecting.set(network);
    this.error.set(null);
    this.service.connectUrl(network, this.projectId()).subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (error) => this.fail(error),
    });
  }

  protected disconnect(network: PublishNetwork): void {
    this.connecting.set(network);
    this.service.disconnect(network, this.projectId()).subscribe({
      next: () => {
        this.connecting.set(null);
        this.refresh(false);
      },
      error: (error) => this.fail(error),
    });
  }

  // ── Étape 3 : les propositions du jour ─────────────────────────────────────

  protected toggleDaily(): void {
    const enabled = !this.status()?.dailyProposals;
    this.saving.set(true);
    this.error.set(null);
    this.service.updateSettings({ dailyProposals: enabled, defaultProjectId: this.projectId(), utcOffsetMinutes: -new Date().getTimezoneOffset() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.refresh(false);
      },
      error: (error) => {
        this.fail(error);
        this.refresh(false);
      },
    });
  }

  protected setHour(hour: number): void {
    if (hour === this.status()?.sendHour) return;
    this.saving.set(true);
    this.service.updateSettings({ sendHour: hour }).subscribe({
      next: () => {
        this.saving.set(false);
        this.refresh(false);
      },
      error: (error) => this.fail(error),
    });
  }
}
