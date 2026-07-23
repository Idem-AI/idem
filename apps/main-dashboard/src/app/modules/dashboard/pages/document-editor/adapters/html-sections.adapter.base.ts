import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ProjectService } from '../../../services/project.service';
import { SectionModel } from '../../../models/section.model';
import {
  DocumentTypeAdapter,
  EditableSection,
  EditorDocumentType,
  LoadedDocument,
  PageFormat,
} from '../models/editor.types';
import { sanitizeSectionHtml } from '../utils/sanitize-section';

/**
 * Base RÉUTILISABLE des adaptateurs de document HTML (business plan, pitch deck,
 * charte graphique). Les 3 documents ont la même forme (`sections[]` dont `data`
 * = HTML), la même persistance (`/project/<resource>/:id/sections`) et la même
 * édition IA (`.../ai-edit`). Les sous-classes ne fournissent que la config.
 */
export abstract class HtmlSectionsEditorAdapter implements DocumentTypeAdapter {
  abstract readonly type: EditorDocumentType;
  abstract readonly pageFormat: PageFormat;
  abstract readonly i18nTitleKey: string;
  abstract readonly backRoute: string;

  /** Segment d'URL de l'API (ex: 'businessPlans', 'pitchDecks', 'brandings'). */
  protected abstract readonly resource: string;
  /** Clé du document dans analysisResultModel. */
  protected abstract readonly analysisKey: 'businessPlan' | 'pitchDeck' | 'branding';

  private readonly http = inject(HttpClient);
  private readonly projectService = inject(ProjectService);
  private readonly apiBase = `${environment.services.api.url}/project`;

  /** Sections d'origine (préserve name/type/summary/id lors de la sauvegarde). */
  private readonly rawById = new Map<string, SectionModel>();

  load(projectId: string): Observable<LoadedDocument> {
    return this.projectService.getProjectById(projectId).pipe(
      map((project) => {
        const analysis = project?.analysisResultModel as
          | {
              [key: string]: { sections?: SectionModel[] } | undefined;
              branding?: { typography?: { primaryFont?: string; secondaryFont?: string; url?: string } } & {
                sections?: SectionModel[];
              };
            }
          | undefined;
        const bucket = analysis?.[this.analysisKey];
        const rawSections = bucket?.sections ?? [];
        this.rawById.clear();

        const sections: EditableSection[] = rawSections
          .filter((s) => typeof s.data === 'string')
          .map((s) => {
            const id = s.id || s.name;
            this.rawById.set(id, s);
            return { id, name: s.name, type: s.type, html: sanitizeSectionHtml(s.data as string) };
          });

        const typography = analysis?.branding?.typography;
        return {
          title: project?.name ?? '',
          sections,
          fonts: {
            primaryFont: typography?.primaryFont,
            secondaryFont: typography?.secondaryFont,
            fontUrl: typography?.url,
          },
        };
      }),
    );
  }

  save(projectId: string, sections: EditableSection[]): Observable<unknown> {
    const payload: SectionModel[] = sections.map((s) => {
      const raw = this.rawById.get(s.id);
      return {
        id: raw?.id,
        name: raw?.name ?? s.name,
        type: raw?.type ?? s.type,
        data: s.html,
        summary: raw?.summary ?? '',
      };
    });
    return this.http.put(`${this.apiBase}/${this.resource}/${projectId}/sections`, { sections: payload });
  }

  aiEdit(projectId: string, sectionId: string, instruction: string): Observable<{ html: string }> {
    return this.http
      .post<{ section: SectionModel }>(
        `${this.apiBase}/${this.resource}/${projectId}/sections/${encodeURIComponent(sectionId)}/ai-edit`,
        { instruction },
      )
      .pipe(map((res) => ({ html: (res.section?.data as string) ?? '' })));
  }
}
