import { HttpClient } from '@angular/common/http';
import { EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';
import { environment } from '../../../environments/environment';
import { IllustrationComponent, type IllustrationName } from '../components/illustration/illustration';

/**
 * Les visites d'iDeploy, une par lieu : on ne présente un écran que quand on
 * s'y trouve, sinon la bulle pointe dans le vide.
 *
 * - `main` : le tableau de bord, porte d'entrée de l'application ;
 * - `new-project` : le choix de ce qu'on met en ligne ;
 * - `application` : la page d'une application et sa navigation propre.
 */
export type TourName = 'main' | 'new-project' | 'application';

/**
 * Version des visites. L'augmenter rejoue les visites une fois pour tout le
 * monde : à faire quand l'interface a assez changé pour que l'ancienne visite
 * mente. La v1 pointait des éléments disparus, sans aucun texte traduit.
 */
const VERSION = 'v2';

/** Cache local : évite d'attendre le réseau quand la réponse est déjà connue. */
const STORAGE_KEY = 'idem_tours_seen_v1';

/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 600;

/** Largeur des illustrations dans la bulle. */
const ILLUSTRATION_WIDTH = 96;

interface StepDef {
  key: string;
  target?: string;
  placement?: TourStep['placement'];
  illustration?: IllustrationName;
  celebrate?: boolean;
}

/** Étapes de chaque visite : la cible est un `data-tour` posé dans les vues. */
const TOURS: Record<TourName, StepDef[]> = {
  main: [
    { key: 'welcome', illustration: 'activity' },
    { key: 'addNew', target: '[data-tour="ideploy-add-new"]', placement: 'bottom' },
    { key: 'projects', target: '[data-tour="ideploy-projects"]', placement: 'left' },
    { key: 'deploy', target: '[data-tour="ideploy-nav-deploy"]', placement: 'right', illustration: 'market' },
    { key: 'resources', target: '[data-tour="ideploy-nav-resources"]', placement: 'right', illustration: 'server' },
    { key: 'usage', target: '[data-tour="ideploy-usage"]', placement: 'right' },
    { key: 'configuration', target: '[data-tour="ideploy-nav-configuration"]', placement: 'right' },
    { key: 'menu', target: '[data-tour="ideploy-user-menu"]', placement: 'bottom' },
    { key: 'done', celebrate: true },
  ],
  'new-project': [
    { key: 'sources', target: '[data-tour="ideploy-sources"]', placement: 'bottom' },
    { key: 'panel', target: '[data-tour="ideploy-source-panel"]', placement: 'top' },
    { key: 'done', celebrate: true },
  ],
  application: [
    { key: 'header', target: '[data-tour="ideploy-app-header"]', placement: 'bottom', illustration: 'activity' },
    { key: 'tabs', target: '[data-tour="ideploy-app-tabs"]', placement: 'bottom' },
    { key: 'checklist', target: '[data-tour="ideploy-app-checklist"]', placement: 'left' },
    { key: 'back', target: '[data-tour="ideploy-app-back"]', placement: 'right' },
    { key: 'done', celebrate: true },
  ],
};

/**
 * Visites guidées d'iDeploy.
 *
 * Elles s'appuient sur le moteur partagé `@idem/shared-tour`, commun à toutes
 * les applications Idem, et mémorisent leur passage sur le **compte** via
 * l'API IDEM globale — celle qui porte déjà l'authentification de cette
 * application. Changer de navigateur ou de machine ne rejoue donc pas un
 * didacticiel déjà suivi. Le stockage local ne sert que de cache.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly injector = inject(EnvironmentInjector);
  private readonly apiUrl = `${environment.services.api.url}/auth/tours`;

  private active: TourHandle | null = null;
  /**
   * Vrai dès l'appel, avant même le délai d'affichage : `active` n'est
   * renseigné qu'à l'expiration du minuteur, et deux appels rapprochés
   * lanceraient sinon deux visites concurrentes.
   */
  private pending = false;

  /** Liste serveur mémorisée pour la session, pour n'interroger qu'une fois. */
  private remoteSeen: string[] | null = null;

  /** Illustrations déjà sérialisées : le dessin ne change pas d'une visite à l'autre. */
  private readonly svgCache = new Map<IllustrationName, string>();

  /**
   * Lance la visite si le compte ne l'a jamais vue.
   *
   * Le cache local tranche immédiatement quand il sait ; sinon on interroge le
   * compte avant de décider, faute de quoi un nouveau navigateur rejouerait
   * une visite déjà suivie ailleurs.
   */
  async maybeStart(name: TourName): Promise<void> {
    const id = this.tourId(name);
    if (this.readLocal().includes(id)) return;

    const seen = await this.fetchSeen();
    if (seen.includes(id)) {
      this.writeLocal([...this.readLocal(), id]);
      return;
    }

    this.start(name);
  }

  /** Lance la visite sans condition (relance depuis le menu du compte). */
  start(name: TourName): void {
    if (this.active || this.pending) return;
    this.pending = true;

    // Laisse la page se peindre : les positions se mesurent sur du réel, et
    // les textes sont lus au dernier moment, une fois la langue chargée.
    setTimeout(() => {
      this.active = startTour({
        id: this.tourId(name),
        steps: this.steps(name),
        labels: {
          next: this.translate.instant('tour.common.next'),
          back: this.translate.instant('tour.common.back'),
          skip: this.translate.instant('tour.common.skip'),
          finish: this.translate.instant('tour.common.finish'),
          stepOf: this.translate.instant('tour.common.stepOf'),
          dialogLabel: this.translate.instant('tour.common.dialogLabel'),
        },
        onFinish: () => {
          this.active = null;
          this.pending = false;
          // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
          void this.markSeen(name);
        },
      });
    }, START_DELAY_MS);
  }

  private tourId(name: TourName): string {
    return `ideploy-web:${name}:${VERSION}`;
  }

  /**
   * Les étapes à montrer maintenant. Celle dont l'élément n'est pas à l'écran
   * — la liste « Pour bien démarrer » une fois tout réglé, un onglet autre que
   * la vue d'ensemble — est sautée : une bulle centrée qui parle d'un bloc
   * absent égare plus qu'elle n'aide.
   */
  private steps(name: TourName): TourStep[] {
    const present = TOURS[name].filter(({ target }) => !target || document.querySelector(target));
    return present.map(({ key, illustration, ...rest }) => ({
      ...rest,
      title: this.translate.instant(`tour.${name}.${key}.title`),
      body: this.translate.instant(`tour.${name}.${key}.body`),
      illustration: illustration ? this.illustration(illustration) : undefined,
    }));
  }

  /**
   * Le dessin de l'interface, sérialisé pour le moteur de visite qui ne
   * connaît pas Angular : on réutilise les scènes d'`app-illustration` plutôt
   * que d'en maintenir une seconde copie.
   */
  private illustration(name: IllustrationName): string {
    const cached = this.svgCache.get(name);
    if (cached) return cached;

    const ref = createComponent(IllustrationComponent, { environmentInjector: this.injector });
    ref.setInput('name', name);
    ref.setInput('width', ILLUSTRATION_WIDTH);
    ref.changeDetectorRef.detectChanges();
    const svg = (ref.location.nativeElement as HTMLElement).innerHTML;
    ref.destroy();

    this.svgCache.set(name, svg);
    return svg;
  }

  // ─────────────────────────────────────────────────────────── mémoire

  /**
   * Visites vues d'après le compte IDEM, partagé par toutes les applications.
   * Une panne réseau renvoie une liste vide : mieux vaut reproposer la visite
   * que de la supprimer définitivement sur une erreur passagère.
   */
  private async fetchSeen(): Promise<string[]> {
    if (this.remoteSeen) return this.remoteSeen;
    try {
      const response = await firstValueFrom(
        this.http.get<{ toursSeen: string[] }>(this.apiUrl, { withCredentials: true }),
      );
      this.remoteSeen = response?.toursSeen ?? [];
      return this.remoteSeen;
    } catch (error) {
      console.error('Tour: could not read the seen tours', error);
      return [];
    }
  }

  private async markSeen(name: TourName): Promise<void> {
    const id = this.tourId(name);
    const local = this.readLocal();
    if (!local.includes(id)) this.writeLocal([...local, id]);
    if (this.remoteSeen && !this.remoteSeen.includes(id)) this.remoteSeen.push(id);

    try {
      await firstValueFrom(
        this.http.post<{ toursSeen: string[] }>(
          this.apiUrl,
          { tourId: id },
          { withCredentials: true },
        ),
      );
    } catch (error) {
      console.error('Tour: could not record the tour', error);
    }
  }

  private readLocal(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Stockage indisponible : le compte reste la mémoire de référence
    }
  }
}
