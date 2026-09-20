import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FlyerFormat } from '../../../../models/communication.model';
import { formatAspect } from '../../communication-ui';

/**
 * Les étapes réellement traversées par l'API, dans l'ordre.
 *
 * Ce ne sont pas des libellés décoratifs : `composeFlyer` tire bien une grille,
 * cherche une image, écrit le texte, compose, puis contrôle le rendu. Montrer une
 * progression qui ne correspond à rien serait mentir à l'utilisateur sur ce qu'il
 * paie.
 */
const STAGES = ['grid', 'image', 'words', 'compose', 'check'] as const;

/** Durées indicatives de chaque étape (ms), proportionnelles au coût réel. */
const STAGE_MS = [3500, 12000, 9000, 20000, 6000];

/**
 * Écran de composition d'un visuel.
 *
 * Composer prend de vingt secondes à deux minutes : une image est cherchée ou
 * générée, un texte est écrit, une page est composée puis photographiée. Un simple
 * disque qui tourne, pendant tout ce temps, donne l'impression que rien ne se
 * passe — c'est le moment où l'on quitte la page.
 *
 * Ici, on montre la maquette EN TRAIN de se construire : la grille apparaît, la
 * zone d'image se remplit, les lignes de texte se posent, le logo arrive. La
 * progression suit les vraies étapes du serveur, avec des durées calées sur leur
 * coût réel — et elle ralentit sans jamais atteindre 100 % tant que le serveur n'a
 * pas répondu, plutôt que de rester bloquée à « 100 % » comme une barre qui a
 * menti.
 */
@Component({
  selector: 'app-visual-composing',
  imports: [TranslateModule],
  templateUrl: './visual-composing.html',
  styleUrl: './visual-composing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VisualComposing {
  private readonly destroyRef = inject(DestroyRef);

  /** Format visé : la maquette prend sa forme dès la première seconde. */
  readonly format = input<FlyerFormat>('square');
  /** Plusieurs propositions en parallèle : le texte le dit. */
  readonly variants = input<number>(1);

  protected readonly formatAspect = formatAspect;
  protected readonly stages = STAGES;

  /** Index de l'étape en cours. */
  protected readonly stage = signal(0);
  private readonly elapsed = signal(0);

  private readonly totalMs = STAGE_MS.reduce((sum, value) => sum + value, 0);

  /**
   * Avancement affiché, borné à 92 %.
   *
   * Une barre qui atteint 100 % avant la réponse du serveur est une barre qui a
   * menti : l'utilisateur attend alors devant un « terminé » qui ne l'est pas. On
   * s'approche sans jamais y arriver, et c'est la réponse réelle qui conclut.
   */
  protected readonly progress = computed(() =>
    Math.min(92, Math.round((this.elapsed() / this.totalMs) * 100)),
  );

  constructor() {
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      this.elapsed.set(elapsed);

      // L'étape courante se déduit du temps passé : aucun état à synchroniser.
      let cumulative = 0;
      let index = 0;
      for (let i = 0; i < STAGE_MS.length; i++) {
        cumulative += STAGE_MS[i];
        if (elapsed < cumulative) {
          index = i;
          break;
        }
        // Au-delà du budget prévu, on reste sur la dernière étape plutôt que de
        // faire croire que c'est fini.
        index = STAGE_MS.length - 1;
      }
      this.stage.set(index);
    }, 400);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected isDone(index: number): boolean {
    return index < this.stage();
  }

  protected isCurrent(index: number): boolean {
    return index === this.stage();
  }
}
