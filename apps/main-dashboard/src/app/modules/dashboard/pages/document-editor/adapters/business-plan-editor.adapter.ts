import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ProjectService } from '../../../services/project.service';
import { SectionModel } from '../../../models/section.model';
import {
  DocumentTypeAdapter,
  EditableSection,
  LoadedDocument,
  PageFormat,
} from '../models/editor.types';
import { sanitizeSectionHtml } from '../utils/sanitize-section';

/**
 * Adaptateur du Business Plan : mappe les sections (HTML dans `data`) vers le
 * modèle d'édition et inversement, en préservant name/type/summary/id d'origine
 * lors de la sauvegarde. Persistance et édition IA via les endpoints dédiés
 * (`/project/businessPlans/:projectId/sections` et `.../ai-edit`).
 */
@Injectable({ providedIn: 'root' })
export class BusinessPlanEditorAdapter implements DocumentTypeAdapter {
  readonly type = 'business-plan' as const;
  readonly pageFormat: PageFormat = { width: '210mm', height: '297mm' };
  readonly i18nTitleKey = 'dashboard.documentEditor.businessPlan.title';
  readonly backRoute = '/project/business-plan';

  private readonly http = inject(HttpClient);
  private readonly projectService = inject(ProjectService);
  private readonly baseUrl = `${environment.services.api.url}/project/businessPlans`;

  /** Sections d'origine indexées par clé d'édition (préserve les métadonnées). */
  private rawById = new Map<string, SectionModel>();

  load(projectId: string): Observable<LoadedDocument> {
    return this.projectService.getProjectById(projectId).pipe(
      map((project) => {
        const analysis = project?.analysisResultModel as
          | { businessPlan?: { sections?: SectionModel[] }; branding?: { typography?: { primaryFont?: string; secondaryFont?: string; url?: string } } }
          | undefined;
        const rawSections = analysis?.businessPlan?.sections ?? [];
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
          title: project?.name ?? 'Business Plan',
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
    return this.http.put(`${this.baseUrl}/${projectId}/sections`, { sections: payload });
  }

  aiEdit(projectId: string, sectionId: string, instruction: string): Observable<{ html: string }> {
    return this.http
      .post<{ section: SectionModel }>(
        `${this.baseUrl}/${projectId}/sections/${encodeURIComponent(sectionId)}/ai-edit`,
        { instruction },
      )
      .pipe(map((res) => ({ html: (res.section?.data as string) ?? '' })));
  }
}
