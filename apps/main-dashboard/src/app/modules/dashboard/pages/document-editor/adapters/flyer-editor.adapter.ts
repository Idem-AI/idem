import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, Observable, throwError } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ProjectService } from '../../../services/project.service';
import { Flyer, FlyerFormat } from '../../../models/communication.model';
import {
  DocumentTypeAdapter,
  EditableSection,
  LoadedDocument,
  PageFormat,
} from '../models/editor.types';
import { sanitizeSectionHtml } from '../utils/sanitize-section';

/**
 * Dimensions de canevas par format, en pixels — la table de
 * `flyerRender.service.ts` côté API. C'est le contrat que le prompt de
 * composition impose au conteneur racine du visuel : l'éditeur doit afficher
 * exactement la même page, sinon on éditerait à une échelle qui n'est pas celle
 * du PNG produit.
 */
const FLYER_DIMENSIONS: Record<FlyerFormat, PageFormat> = {
  square: { width: '1080px', height: '1080px' },
  story: { width: '1080px', height: '1920px' },
  banner: { width: '1200px', height: '630px' },
  post: { width: '1200px', height: '1500px' },
  a4: { width: '1240px', height: '1754px' },
};

/**
 * Adaptateur d'un VISUEL de communication (flyer, story, bannière…).
 *
 * Trois écarts avec les documents (business plan, pitch deck, charte, carte de
 * visite), tous dictés par la nature de l'objet :
 *  - la source n'est pas `analysisResultModel.<doc>.sections[]` mais
 *    `communication.flyers[]` : un visuel = UNE section éditable, son `html` ;
 *  - le visuel à ouvrir est désigné par `?flyerId=` dans l'URL, puisque le
 *    projet en contient autant que de contenus programmés ;
 *  - le format (donc la taille de la page) n'est connu qu'au chargement.
 *
 * L'image affichée dans le module Communication est rendue à la demande depuis
 * ce HTML : l'API oublie le PNG en cache à chaque écriture, l'URL du visuel ne
 * change jamais.
 */
@Injectable({ providedIn: 'root' })
export class FlyerEditorAdapter implements DocumentTypeAdapter {
  readonly type = 'flyer' as const;
  /** Remplacé au chargement par le format réel du visuel ouvert. */
  readonly pageFormat: PageFormat = FLYER_DIMENSIONS.square;
  readonly multiPage = false;
  readonly fitRoot = true;
  readonly i18nTitleKey = 'dashboard.documentEditor.flyer.title';
  readonly backRoute = '/project/communication';

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly apiBase = `${environment.services.api.url}/project/communication`;

  /** Id du visuel ouvert, lu dans l'URL au chargement. */
  private flyerId: string | null = null;

  load(projectId: string): Observable<LoadedDocument> {
    // Les query params vivent sur l'URL, pas sur la route de l'éditeur : on les
    // lit à la racine du snapshot pour que l'ouverture directe d'un lien (ou un
    // rechargement de page) fonctionne comme la navigation interne.
    this.flyerId = this.router.routerState.snapshot.root.queryParamMap.get('flyerId');
    if (!this.flyerId) {
      return throwError(() => new Error('No flyerId in the URL'));
    }

    return this.projectService.getProjectById(projectId).pipe(
      map((project) => {
        const analysis = project?.analysisResultModel as
          | {
              communication?: { flyers?: Flyer[] };
              branding?: {
                typography?: { primaryFont?: string; secondaryFont?: string; url?: string };
              };
            }
          | undefined;
        const flyer = analysis?.communication?.flyers?.find((f) => f.id === this.flyerId);
        if (!flyer?.html) throw new Error(`Flyer ${this.flyerId} not found`);

        const sections: EditableSection[] = [
          {
            id: flyer.id,
            name: flyer.marketingText?.headline || flyer.concept || flyer.id,
            type: `flyer-${flyer.format}`,
            html: sanitizeSectionHtml(flyer.html),
          },
        ];
        const typography = analysis?.branding?.typography;
        return {
          title: flyer.marketingText?.headline || project?.name || '',
          sections,
          fonts: {
            primaryFont: typography?.primaryFont,
            secondaryFont: typography?.secondaryFont,
            fontUrl: typography?.url,
          },
          pageFormat: FLYER_DIMENSIONS[flyer.format] ?? FLYER_DIMENSIONS.square,
        };
      }),
    );
  }

  save(projectId: string, sections: EditableSection[]): Observable<unknown> {
    const html = sections[0]?.html ?? '';
    return this.http.put(`${this.apiBase}/${projectId}/flyer/${this.flyerId}/html`, { html });
  }

  aiEdit(projectId: string, sectionId: string, instruction: string): Observable<{ html: string }> {
    return this.http
      .post<Flyer>(
        `${this.apiBase}/${projectId}/flyer/${encodeURIComponent(sectionId)}/ai-edit`,
        { instruction },
      )
      .pipe(map((flyer) => ({ html: flyer?.html ?? '' })));
  }
}
