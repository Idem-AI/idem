import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Flyer } from '../../../../models/communication.model';
import { formatAspect } from '../../communication-ui';

/** Attentes avant chaque nouvelle tentative, en millisecondes. */
const BACKOFF_MS = [1200, 3000, 6000];

/**
 * Vignette d'un visuel, qui RÉESSAIE au lieu de rester cassée.
 *
 * ── Le défaut qu'elle corrige ─────────────────────────────────────────────────
 * Le PNG d'un visuel est produit à la demande par l'API (une page rendue puis
 * photographiée). Une balise `<img>` demande cette image UNE seule fois, au
 * moment précis où le visuel apparaît — soit l'instant où le serveur est le plus
 * susceptible d'être encore occupé. Et un `<img>` en échec ne réessaie jamais.
 *
 * D'où le symptôme observé : l'image ne s'affichait pas, alors que le bouton
 * « Télécharger » — cliqué quelques secondes plus tard, sur la MÊME URL — ramenait
 * le fichier sans problème. Ce n'était pas l'URL qui était fausse, c'était la
 * première tentative qui tombait trop tôt et sans recours.
 *
 * ── Ce qu'elle fait ───────────────────────────────────────────────────────────
 *  - un état d'attente visible, à la bonne forme (le format du visuel) ;
 *  - trois nouvelles tentatives espacées, avec un paramètre qui change pour ne
 *    pas se faire resservir l'échec par le cache du navigateur ;
 *  - puis un message, et un bouton « Réessayer » quand la vignette n'est pas
 *    imbriquée dans une carte cliquable (cf. `showRetry`). Jamais une image
 *    cassée muette.
 */
@Component({
  selector: 'app-visual-thumb',
  imports: [TranslateModule],
  templateUrl: './visual-thumb.html',
  styleUrl: './visual-thumb.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VisualThumb {
  private readonly destroyRef = inject(DestroyRef);

  readonly visual = input.required<Flyer>();
  /** Titre lisible, pour le texte alternatif. */
  readonly label = input<string>('');
  /**
   * Affiche un bouton « Réessayer » après les tentatives automatiques.
   *
   * À laisser à `false` quand la vignette est posée DANS un bouton (une carte
   * cliquable) : un bouton dans un bouton n'est pas du HTML valide, le clavier s'y
   * perd et les lecteurs d'écran n'annoncent que l'extérieur. Dans ce cas le
   * message reste, et c'est la carte qui mène à l'aperçu en grand — lequel affiche
   * le visuel par un autre chemin.
   */
  readonly showRetry = input<boolean>(false);

  protected readonly formatAspect = formatAspect;

  protected readonly isLoaded = signal(false);
  protected readonly attempt = signal(0);
  protected readonly givenUp = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * URL demandée, avec un numéro de tentative.
   *
   * Le paramètre `r` ne sert qu'à contourner le cache du navigateur : sans lui,
   * une seconde tentative se ferait resservir l'échec mis en cache, et les trois
   * essais n'en feraient qu'un.
   */
  protected readonly src = computed(() => {
    const url = this.visual().imageUrl;
    if (!url) return '';
    const attempt = this.attempt();
    if (attempt === 0) return url;
    return `${url}${url.includes('?') ? '&' : '?'}r=${attempt}`;
  });

  constructor() {
    // Un visuel remplacé (variante suivante, retouche) repart d'un état neuf :
    // sinon il hériterait du « on abandonne » du précédent.
    effect(() => {
      this.visual();
      this.reset();
    });

    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  protected onLoad(): void {
    this.clearTimer();
    this.isLoaded.set(true);
    this.givenUp.set(false);
  }

  protected onError(): void {
    const next = this.attempt();
    const wait = BACKOFF_MS[next];
    if (wait === undefined) {
      this.givenUp.set(true);
      return;
    }
    this.clearTimer();
    this.timer = setTimeout(() => this.attempt.set(next + 1), wait);
  }

  /** Nouvelle tentative demandée à la main. */
  protected retry(): void {
    this.givenUp.set(false);
    this.isLoaded.set(false);
    this.attempt.update((value) => value + 1);
  }

  private reset(): void {
    this.clearTimer();
    this.isLoaded.set(false);
    this.givenUp.set(false);
    this.attempt.set(0);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
