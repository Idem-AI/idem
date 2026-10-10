import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { DocumentTypeAdapter, EditableSection, FontHints, LoadedDocument, PageFormat, sanitizeSectionHtml } from '@idem/shared-document-editor/angular';
import { ApiService } from '../../../core/api.service';
import { Brand } from '../../../core/models';

/** Dimensions réelles des formats (celles du rendu, `core/src/visual/flyer.render.ts`). */
export const VISUAL_PAGES: Record<string, PageFormat> = {
  square: { width: '1080px', height: '1080px' },
  story: { width: '1080px', height: '1920px' },
  banner: { width: '1200px', height: '630px' },
  post: { width: '1200px', height: '1500px' },
  a4: { width: '1240px', height: '1754px' },
};

/** Les polices de la marque, au format de l'éditeur partagé. */
export function brandFonts(brand: Brand | null | undefined): FontHints {
  return { primaryFont: brand?.fonts.display, secondaryFont: brand?.fonts.body, fontUrl: brand?.fonts.displayCss || brand?.fonts.bodyCss };
}

/**
 * Un VISUEL d'iVision dans l'éditeur partagé (`@idem/shared-document-editor`, le même qu'IDEM).
 * Contexte = la marque, document = le visuel : une seule section, son HTML. Enregistrer re-rend
 * l'image côté API. Pas de retouche IA : un visuel n'est jamais réécrit par le modèle (moteur
 * d'affiches) — l'éditeur masque donc son panneau IA.
 */
@Injectable({ providedIn: 'root' })
export class IvisionVisualAdapter implements DocumentTypeAdapter {
  private readonly api = inject(ApiService);
  readonly type = 'flyer' as const;
  readonly pageFormat: PageFormat = VISUAL_PAGES['square'];
  readonly multiPage = false;
  readonly fitRoot = true;
  readonly i18nTitleKey = 'visualEdit.title';
  readonly backRoute = '/studio/image';

  load(brandId: string, visualId?: string | null): Observable<LoadedDocument> {
    return forkJoin({ visual: this.api.visual(visualId!), brand: this.api.brand(brandId) }).pipe(
      map(({ visual, brand }) => {
        if (!visual?.html) throw new Error('visual_without_html');
        const sections: EditableSection[] = [{ id: visual.id, name: visual.prompt.slice(0, 60) || visual.id, type: `flyer-${visual.format}`, html: sanitizeSectionHtml(visual.html) }];
        return { title: visual.prompt.slice(0, 80), sections, fonts: brandFonts(brand), pageFormat: VISUAL_PAGES[visual.format] ?? VISUAL_PAGES['square'] };
      }),
    );
  }

  save(_brandId: string, sections: EditableSection[], visualId?: string | null): Observable<unknown> {
    return this.api.saveVisualHtml(visualId!, sections[0]?.html ?? '');
  }
}
