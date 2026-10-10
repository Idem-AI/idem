import { HttpClient } from '@angular/common/http';
import { EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';
import { environment } from '../../environments/environment';
import { Illustration, type IllustrationKind } from '../shared/components/illustration';

/**
 * Les visites d'iVision, une par lieu (on ne présente un écran que quand on s'y trouve) :
 *
 *   studio   première ouverture de l'atelier : ce qu'on peut créer, où écrire, la marque
 *            facultative, la créativité, l'historique, les crédits ;
 *   result   première création prête : la regarder, la changer (en écrivant ou en cliquant),
 *            la télécharger ;
 *   editor   première ouverture de l'éditeur d'un montage : la frise, les onglets, l'enregistrement.
 */
export type TourName = 'studio' | 'result' | 'editor';

/** L'augmenter rejoue les visites une fois pour tout le monde (interface trop changée). */
const VERSION = 'v1';
const STORAGE_KEY = 'idem_tours_seen_v1';
const START_DELAY_MS = 700;
const ILLUSTRATION_SIZE = 96;

interface StepDef {
  key: string;
  target?: string;
  placement?: TourStep['placement'];
  illustration?: IllustrationKind;
  celebrate?: boolean;
}

/** Les étapes : la cible est un `data-tour` posé dans les vues. Des mots simples, une idée par bulle. */
const TOURS: Record<TourName, StepDef[]> = {
  studio: [
    { key: 'welcome', illustration: 'kente' },
    { key: 'tabs', target: '[data-tour="iv-tabs"]', placement: 'right' },
    { key: 'choices', target: '[data-tour="iv-video-choices"]', placement: 'bottom', illustration: 'kora' },
    { key: 'composer', target: '[data-tour="iv-composer"]', placement: 'top', illustration: 'calame' },
    { key: 'brand', target: '[data-tour="iv-brand-hint"]', placement: 'top', illustration: 'stamp' },
    { key: 'creativity', target: '[data-tour="iv-creativity"]', placement: 'top' },
    { key: 'history', target: '[data-tour="iv-history"]', placement: 'right' },
    { key: 'credits', target: '[data-tour="iv-credits"]', placement: 'right', illustration: 'cauris' },
    { key: 'done', celebrate: true },
  ],
  result: [
    { key: 'ready', target: '[data-tour="iv-result"]', placement: 'right' },
    { key: 'say', target: '[data-tour="iv-composer"]', placement: 'top', illustration: 'calame' },
    { key: 'edit', target: '[data-tour="iv-result-edit"]', placement: 'top' },
    { key: 'download', target: '[data-tour="iv-result-download"]', placement: 'top' },
  ],
  editor: [
    { key: 'preview', target: '[data-tour="iv-editor-preview"]', placement: 'right', illustration: 'kuba' },
    { key: 'timeline', target: '[data-tour="iv-editor-timeline"]', placement: 'top' },
    { key: 'tabs', target: '[data-tour="iv-editor-tabs"]', placement: 'left' },
    { key: 'save', target: '[data-tour="iv-editor-download"]', placement: 'bottom', celebrate: true },
  ],
};

/**
 * Les visites guidées d'iVision, sur le moteur partagé `@idem/shared-tour` (le même que le
 * tableau de bord IDEM et iDeploy). Leur passage est mémorisé sur le COMPTE IDEM (`/auth/tours`) :
 * un autre navigateur ne rejoue pas un didacticiel déjà suivi. Le stockage local sert de cache.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly injector = inject(EnvironmentInjector);
  private readonly apiUrl = `${environment.services.api.url}/auth/tours`;

  private active: TourHandle | null = null;
  private pending = false;
  private remoteSeen: string[] | null = null;
  private readonly svgCache = new Map<IllustrationKind, string>();

  /** Lance la visite si le compte ne l'a jamais vue. */
  async maybeStart(name: TourName): Promise<void> {
    const id = this.tourId(name);
    if (this.active || this.pending || this.readLocal().includes(id)) return;
    const seen = await this.fetchSeen();
    if (seen.includes(id)) {
      this.writeLocal([...this.readLocal(), id]);
      return;
    }
    this.start(name);
  }

  /** Lance la visite sans condition (« Revoir le guide »). */
  start(name: TourName): void {
    if (this.active || this.pending) return;
    this.pending = true;
    setTimeout(() => {
      const steps = this.steps(name);
      if (!steps.length) {
        this.pending = false;
        return;
      }
      this.active = startTour({
        id: this.tourId(name),
        steps,
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
          // Suivie ou passée : on ne la repropose pas.
          void this.markSeen(name);
        },
      });
    }, START_DELAY_MS);
  }

  private tourId(name: TourName): string {
    return `ivision-web:${name}:${VERSION}`;
  }

  /**
   * Les étapes à montrer maintenant : celle dont l'élément n'est pas VISIBLE (barre latérale
   * repliée sur téléphone, bloc absent) est sautée — une bulle qui parle d'un élément caché égare.
   */
  private steps(name: TourName): TourStep[] {
    const visible = (selector: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
    };
    return TOURS[name]
      .filter(({ target }) => !target || visible(target))
      .map(({ key, illustration, ...rest }) => ({
        ...rest,
        title: this.translate.instant(`tour.${name}.${key}.title`),
        body: this.translate.instant(`tour.${name}.${key}.body`),
        illustration: illustration ? this.illustration(illustration) : undefined,
      }));
  }

  /** L'illustration de l'interface, sérialisée pour le moteur (qui ne connaît pas Angular). */
  private illustration(kind: IllustrationKind): string {
    const cached = this.svgCache.get(kind);
    if (cached) return cached;
    const ref = createComponent(Illustration, { environmentInjector: this.injector });
    ref.setInput('kind', kind);
    ref.changeDetectorRef.detectChanges();
    const svg = (ref.location.nativeElement as HTMLElement).innerHTML.replace('width="100%" height="100%"', `width="${ILLUSTRATION_SIZE}" height="${ILLUSTRATION_SIZE}"`);
    ref.destroy();
    this.svgCache.set(kind, svg);
    return svg;
  }

  private async fetchSeen(): Promise<string[]> {
    if (this.remoteSeen) return this.remoteSeen;
    try {
      const response = await firstValueFrom(this.http.get<{ toursSeen: string[] }>(this.apiUrl, { withCredentials: true }));
      this.remoteSeen = response?.toursSeen ?? [];
      return this.remoteSeen;
    } catch {
      // Une panne : mieux vaut reproposer la visite que la supprimer pour toujours.
      return [];
    }
  }

  private async markSeen(name: TourName): Promise<void> {
    const id = this.tourId(name);
    const local = this.readLocal();
    if (!local.includes(id)) this.writeLocal([...local, id]);
    if (this.remoteSeen && !this.remoteSeen.includes(id)) this.remoteSeen.push(id);
    try {
      await firstValueFrom(this.http.post(this.apiUrl, { tourId: id }, { withCredentials: true }));
    } catch {
      /* le cache local suffit pour cette machine */
    }
  }

  private readLocal(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* stockage indisponible : le compte reste la mémoire */
    }
  }
}
