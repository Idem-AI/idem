import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';

import { BusinessPlanService } from '../../dashboard/services/ai-agents/business-plan.service';
import { PitchDeckService } from '../../dashboard/services/ai-agents/pitch-deck.service';
import { PreviewDocumentType } from '../../dashboard/components/document-preview/document-preview';
import { expectedBrandingSections, StoredBranding } from '../../dashboard/models/branding-charter';
import {
  analyzeGenerationCompleteness,
  BUSINESS_PLAN_SECTION_NAMES,
  PITCH_DECK_SECTION_NAMES,
  SectionCompletionItem,
} from '../../dashboard/models/generation-completeness';
import {
  DeliverableDocumentSummary,
  documentActivityTime,
  findDeliverableDocument,
} from '../../dashboard/models/deliverable-document.model';
import {
  businessPlanVariantLabel,
  pitchDeckTypeLabel,
} from '../../dashboard/utils/deliverable-labels';
import { ChatDocumentListItem, DeliverableKind } from '../models/chat.model';

/** Livrables que l'aperçu de document sait rendre (mêmes pages que l'éditeur). */
export type PreviewableKind = 'businessPlan' | 'pitchDeck' | 'branding';

/** Livrables dont un projet garde PLUSIEURS documents. */
export type MultiDocumentKind = 'businessPlan' | 'pitchDeck';

/**
 * Un document du projet, tel que la carte de liste le présente dans le fil.
 * La forme est celle du modèle de message : la liste est posée dans le fil et
 * doit survivre à la persistance de la conversation.
 */
export type ChatDocumentSummary = ChatDocumentListItem;

interface PreviewConfig {
  documentType: PreviewDocumentType;
  /** Préfixe i18n des noms de section (se termine par un point). */
  sectionLabelPrefix: string;
}

const PREVIEW_CONFIG: Record<PreviewableKind, PreviewConfig> = {
  businessPlan: {
    documentType: 'business-plan',
    sectionLabelPrefix: 'dashboard.generationPanel.sections.businessPlan.',
  },
  pitchDeck: {
    documentType: 'pitch-deck',
    sectionLabelPrefix: 'dashboard.showPitchDeck.slides.',
  },
  branding: {
    documentType: 'branding',
    sectionLabelPrefix: 'dashboard.generationPanel.sections.branding.',
  },
};

/**
 * Les documents d'un projet vus du mode Chat.
 *
 * Un projet garde plusieurs business plans et plusieurs pitch decks (dossier
 * bancaire ET plan investisseur, deck de levée ET présentation commerciale).
 * Le mode Avancé les liste depuis toujours ; le chat n'en voyait qu'un — le
 * plus récent — et agissait donc parfois sur un autre document que celui que
 * l'utilisateur avait en tête.
 *
 * Aucun nouvel endpoint : ce sont les services du mode Avancé, appelés avec le
 * même `documentId`.
 */
@Injectable({ providedIn: 'root' })
export class ChatDocumentsService {
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly translate = inject(TranslateService);

  previewConfig(kind: PreviewableKind): PreviewConfig {
    return PREVIEW_CONFIG[kind];
  }

  /** `true` si l'aperçu de document sait rendre ce livrable. */
  isPreviewable(kind: DeliverableKind): kind is PreviewableKind {
    return kind === 'businessPlan' || kind === 'pitchDeck' || kind === 'branding';
  }

  /** Les documents du livrable, du plus récemment modifié au plus ancien. */
  async list(kind: MultiDocumentKind, projectId: string): Promise<ChatDocumentSummary[]> {
    try {
      const documents = await firstValueFrom(
        kind === 'businessPlan'
          ? this.businessPlanService.listBusinessPlans(projectId)
          : this.pitchDeckService.listPitchDecks(projectId),
      );
      return [...(documents ?? [])]
        .sort((a, b) => documentActivityTime(b) - documentActivityTime(a))
        .map((document) => this.toSummary(kind, document));
    } catch (error) {
      console.error(`Chat documents: listing ${kind} failed`, error);
      return [];
    }
  }

  private toSummary(
    kind: MultiDocumentKind,
    document: DeliverableDocumentSummary,
  ): ChatDocumentSummary {
    const variantLabel =
      kind === 'businessPlan'
        ? businessPlanVariantLabel(this.translate, document.variant)
        : pitchDeckTypeLabel(this.translate, document.variant);
    const expected = document.expectedSectionNames?.length ?? 0;
    const completed = document.completedSectionCount ?? 0;
    return {
      id: document.id,
      name: document.name?.trim() || variantLabel,
      variantLabel,
      status: completed === 0 ? 'draft' : completed < expected ? 'partial' : 'complete',
      completed,
      expected,
      expectedSectionNames: document.expectedSectionNames ?? [],
      updatedAt: document.updatedAt ?? document.createdAt,
    };
  }

  rename(kind: MultiDocumentKind, projectId: string, documentId: string, name: string) {
    return kind === 'businessPlan'
      ? this.businessPlanService.renameBusinessPlan(projectId, documentId, name)
      : this.pitchDeckService.renamePitchDeck(projectId, documentId, name);
  }

  remove(kind: MultiDocumentKind, projectId: string, documentId: string) {
    return kind === 'businessPlan'
      ? this.businessPlanService.deleteBusinessPlan(projectId, documentId)
      : this.pitchDeckService.deletePitchDeck(projectId, documentId);
  }

  /**
   * Pages attendues du document et leur état, dans l'ordre — ce que l'aperçu
   * utilise pour poser une page de remplacement là où il manque une section.
   *
   * Les noms attendus viennent du document lui-même (sa structure, son type) :
   * un dossier bancaire de neuf sections ne doit pas être annoncé incomplet
   * parce qu'il ne contient pas les sections d'un plan investisseur.
   */
  outline(
    kind: PreviewableKind,
    project: ProjectModel | null,
    documentId: string | null,
    expectedSectionNames?: readonly string[],
  ): SectionCompletionItem[] {
    const analysis = project?.analysisResultModel;

    if (kind === 'branding') {
      const branding = analysis?.branding as unknown as StoredBranding | undefined;
      return analyzeGenerationCompleteness(
        expectedBrandingSections(branding),
        branding?.sections ?? [],
      ).items;
    }

    const document = findDeliverableDocument(analysis, kind, documentId);
    const fallback =
      kind === 'businessPlan' ? BUSINESS_PLAN_SECTION_NAMES : PITCH_DECK_SECTION_NAMES;
    const expected = expectedSectionNames?.length ? expectedSectionNames : fallback;
    return analyzeGenerationCompleteness(expected, document?.sections).items;
  }

  /** Nom du document affiché en tête de l'aperçu. */
  heading(
    kind: PreviewableKind,
    project: ProjectModel | null,
    documentId: string | null,
    fallbackTitle: string,
  ): string {
    if (kind === 'branding') return fallbackTitle;
    const document = findDeliverableDocument(analysisOf(project), kind, documentId);
    return document?.name?.trim() || fallbackTitle;
  }

  /** Identifiant du document que le chat vise par défaut : le plus récent. */
  latestDocumentId(kind: MultiDocumentKind, project: ProjectModel | null): string | null {
    return findDeliverableDocument(analysisOf(project), kind)?.id ?? null;
  }
}

function analysisOf(project: ProjectModel | null): unknown {
  return project?.analysisResultModel;
}
