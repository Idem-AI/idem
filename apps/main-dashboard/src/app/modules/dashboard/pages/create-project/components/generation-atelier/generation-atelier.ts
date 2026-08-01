import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Événement réel poussé par la page hôte (issu du flux SSE). La liste est
 * append-only : chaque note n'est consommée qu'une fois, dans l'ordre.
 */
export interface AtelierNote {
  /** Identifiant stable, unique dans le flux. */
  id: string;
  /** Texte déjà traduit. */
  text: string;
}

interface ConsoleLine {
  key: string;
  text: string;
  ambient: boolean;
}

const TICK_MS = 200;
/** Nombre de lignes gardées à l'écran. */
const MAX_LINES = 3;
/** Silence maximal du backend avant d'insérer une ligne d'ambiance. */
const AMBIENT_GAP_MS = 4200;
/** Marge de progression simulée autorisée au-dessus de la progression réelle. */
const SIMULATED_HEADROOM = 20;

/**
 * Suivi d'une génération longue (logos, déclinaisons).
 *
 * Le problème résolu : la génération dure 1 à 3 minutes et le backend reste
 * silencieux pendant de longues secondes. Un écran figé pousse l'utilisateur à
 * fermer l'onglet. Deux couches se superposent donc :
 *
 * - le **réel** : `milestone` (progression dérivée des événements du flux) sert
 *   de plancher à la barre, et `notes` alimente le fil d'activité ;
 * - le **simulé** : entre deux événements, la barre continue de progresser
 *   selon une courbe asymptotique bornée à +20 points au-dessus du réel, et le
 *   fil insère une ligne d'ambiance pour que quelque chose bouge toujours.
 *
 * La progression ne recule jamais et ne dépasse jamais 99 % tant que
 * `running` est vrai.
 */
@Component({
  selector: 'app-generation-atelier',
  imports: [TranslateModule],
  templateUrl: './generation-atelier.html',
  styleUrl: './generation-atelier.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationAtelierComponent implements OnDestroy {
  readonly heading = input.required<string>();
  readonly subheading = input<string>('');
  /** Progression réelle 0-100 dérivée du flux ; sert de plancher à la barre. */
  readonly milestone = input<number>(0);
  readonly running = input<boolean>(true);
  /** Le flux s'est arrêté sans aller au bout : la barre gèle au lieu de finir. */
  readonly failed = input<boolean>(false);
  /** Durée typique de l'opération, utilisée pour doser la progression simulée. */
  readonly estimatedMs = input<number>(120_000);
  /** Réservoir de lignes d'ambiance (déjà traduites), jouées en boucle. */
  readonly ambientMessages = input<string[]>([]);
  readonly notes = input<AtelierNote[]>([]);
  /**
   * Numéro de tentative. Le panneau survit à un « Réessayer » (le tableau live
   * reste monté) : changer cette valeur remet à zéro le chronomètre, la barre
   * et le fil au lieu de repartir de l'état de l'essai précédent.
   */
  readonly runId = input<number>(0);

  protected readonly progress = signal(2);
  protected readonly elapsedMs = signal(0);
  protected readonly lines = signal<ConsoleLine[]>([]);

  protected readonly percent = computed(() => Math.round(this.progress()));

  /** Durée restante formatée, ou null quand l'estimation est dépassée. */
  protected readonly remainingLabel = computed(() => {
    const remaining = this.estimatedMs() - this.elapsedMs();
    if (remaining < 15_000) {
      return null;
    }
    const total = Math.round(remaining / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, '0')}` : `${seconds} s`;
  });

  private startedAt = Date.now();
  private lastMilestone = 0;
  private lastMilestoneAt = this.startedAt;
  private lastLineAt = this.startedAt - AMBIENT_GAP_MS;
  private consumedNotes = 0;
  private ambientCursor = 0;
  private lineSeq = 0;
  private currentRun: number | null = null;
  private readonly timer = setInterval(() => this.tick(), TICK_MS);

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private tick(): void {
    const now = Date.now();
    const running = this.running();

    const run = this.runId();
    if (this.currentRun === null) {
      this.currentRun = run;
    } else if (run !== this.currentRun) {
      this.currentRun = run;
      this.resetRun(now);
    }

    if (running) {
      this.elapsedMs.set(now - this.startedAt);
    }

    const milestone = Math.min(Math.max(this.milestone(), 0), 100);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.lastMilestoneAt = now;
    }

    // Une génération interrompue gèle la barre : la pousser à 100 % annoncerait
    // une réussite alors que la page affiche une erreur juste en dessous.
    const target = running ? this.simulatedTarget(now) : this.failed() ? this.progress() : 100;
    this.progress.update((current) => {
      if (target <= current) {
        return current;
      }
      const next = current + (target - current) * (running ? 0.18 : 0.35);
      return target - next < 0.4 ? target : next;
    });

    this.pumpFeed(now, running);
  }

  /** Nouvelle tentative : tout repart de zéro, y compris le curseur de notes. */
  private resetRun(now: number): void {
    this.startedAt = now;
    this.lastMilestone = 0;
    this.lastMilestoneAt = now;
    this.lastLineAt = now - AMBIENT_GAP_MS;
    this.consumedNotes = 0;
    this.ambientCursor = 0;
    this.progress.set(2);
    this.elapsedMs.set(0);
    this.lines.set([]);
  }

  /** Courbe asymptotique repartant à chaque événement réel, bornée à 99 %. */
  private simulatedTarget(now: number): number {
    const floor = this.lastMilestone;
    const headroom = Math.min(100 - floor, SIMULATED_HEADROOM);
    const tau = Math.max(this.estimatedMs() / 6, 4000);
    const drift = headroom * (1 - Math.exp(-(now - this.lastMilestoneAt) / tau));
    return Math.min(floor + drift, 99);
  }

  /** Les vrais événements passent d'abord ; l'ambiance ne comble que le silence. */
  private pumpFeed(now: number, running: boolean): void {
    const notes = this.notes();
    if (notes.length > this.consumedNotes) {
      for (const note of notes.slice(this.consumedNotes)) {
        this.pushLine(note.text, false);
      }
      this.consumedNotes = notes.length;
      this.lastLineAt = now;
      return;
    }

    if (!running) {
      return;
    }

    const pool = this.ambientMessages();
    if (pool.length === 0) {
      return;
    }
    if (now - this.lastLineAt < AMBIENT_GAP_MS + (this.ambientCursor % 3) * 900) {
      return;
    }

    this.pushLine(pool[this.ambientCursor % pool.length], true);
    this.ambientCursor += 1;
    this.lastLineAt = now;
  }

  private pushLine(text: string, ambient: boolean): void {
    this.lineSeq += 1;
    const line: ConsoleLine = { key: `line-${this.lineSeq}`, text, ambient };
    this.lines.update((lines) => [line, ...lines].slice(0, MAX_LINES));
  }
}
