import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { BusinessPlanService } from '../../dashboard/services/ai-agents/business-plan.service';
import { BrandingService } from '../../dashboard/services/ai-agents/branding.service';
import { PitchDeckService } from '../../dashboard/services/ai-agents/pitch-deck.service';
import { FinanceService } from '../../dashboard/services/finance.service';
import {
  DeliverableCardData,
  DeliverableKind,
  DeliverableSectionPreview,
  DeliverableSectionStatus,
} from '../models/chat.model';

interface DeliverableKindConfig {
  titleKey: string;
  icon: string;
  editorRoute: string;
  generateRoute?: string;
  pdfSupported: boolean;
}

const KIND_CONFIG: Record<DeliverableKind, DeliverableKindConfig> = {
  businessPlan: {
    titleKey: 'chat.deliverables.businessPlan',
    icon: 'pi pi-calendar',
    editorRoute: '/project/business-plan',
    generateRoute: '/project/business-plan/generate',
    pdfSupported: true,
  },
  branding: {
    titleKey: 'chat.deliverables.branding',
    icon: 'pi pi-palette',
    editorRoute: '/project/branding',
    generateRoute: '/project/branding/generate',
    pdfSupported: true,
  },
  pitchDeck: {
    titleKey: 'chat.deliverables.pitchDeck',
    icon: 'pi pi-desktop',
    editorRoute: '/project/pitch-deck',
    pdfSupported: true,
  },
  diagrams: {
    titleKey: 'chat.deliverables.diagrams',
    icon: 'pi pi-chart-line',
    editorRoute: '/project/diagrams',
    generateRoute: '/project/diagrams/generate',
    pdfSupported: false,
  },
  legalDocs: {
    titleKey: 'chat.deliverables.legalDocs',
    icon: 'pi pi-file-edit',
    editorRoute: '/project/legal-docs',
    pdfSupported: false,
  },
  finance: {
    titleKey: 'chat.deliverables.finance',
    icon: 'pi pi-chart-pie',
    editorRoute: '/project/finance',
    pdfSupported: true,
  },
};

/**
 * Construit les cartes de livrables du mode Chat à partir des données projet
 * existantes et orchestre la prévisualisation / le téléchargement des PDF en
 * réutilisant les services du mode Avancé (aucun nouvel endpoint).
 */
@Injectable({ providedIn: 'root' })
export class ChatDeliverablesService {
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly brandingService = inject(BrandingService);
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly financeService = inject(FinanceService);
  private readonly translate = inject(TranslateService);

  config(kind: DeliverableKind): DeliverableKindConfig {
    return KIND_CONFIG[kind];
  }

  kinds(): DeliverableKind[] {
    return Object.keys(KIND_CONFIG) as DeliverableKind[];
  }

  /** Construit la carte d'un livrable depuis le projet (analysisResultModel). */
  buildCard(kind: DeliverableKind, project: ProjectModel | null): DeliverableCardData {
    const config = KIND_CONFIG[kind];
    const sections = this.buildSections(kind, project);
    const available = sections.some((s) => s.status !== 'missing');

    return {
      kind,
      titleKey: config.titleKey,
      icon: config.icon,
      updatedAt: this.resolveUpdatedAt(kind, project),
      sections,
      available,
      pdfSupported: config.pdfSupported,
      editorRoute: config.editorRoute,
      generateRoute: config.generateRoute,
    };
  }

  private sectionStatus(hasContent: boolean): DeliverableSectionStatus {
    return hasContent ? 'ready' : 'missing';
  }

  private buildSections(
    kind: DeliverableKind,
    project: ProjectModel | null,
  ): DeliverableSectionPreview[] {
    const analysis = project?.analysisResultModel;

    switch (kind) {
      case 'businessPlan': {
        const sections = analysis?.businessPlan?.sections ?? [];
        return sections.map((s: { name: string; data?: unknown; summary?: string }) => ({
          name: s.name,
          status: this.sectionStatus(!!s.data || !!s.summary),
        }));
      }
      case 'pitchDeck': {
        const sections = analysis?.pitchDeck?.sections ?? [];
        return sections.map((s: { name: string; data?: unknown; summary?: string }) => ({
          name: s.name,
          status: this.sectionStatus(!!s.data || !!s.summary),
        }));
      }
      case 'branding': {
        const branding = analysis?.branding;
        const base: DeliverableSectionPreview[] = [
          {
            name: this.translate.instant('chat.card.brandingSections.logo'),
            status: this.sectionStatus(!!branding?.logo?.svg || !!branding?.logo?.id),
          },
          {
            name: this.translate.instant('chat.card.brandingSections.colors'),
            status: this.sectionStatus(!!branding?.colors?.colors?.primary),
          },
          {
            name: this.translate.instant('chat.card.brandingSections.typography'),
            status: this.sectionStatus(!!branding?.typography?.primaryFont),
          },
        ];
        const extraSections = (branding?.sections ?? []).map(
          (s: { name: string; data?: unknown; summary?: string }) => ({
            name: s.name,
            status: this.sectionStatus(!!s.data || !!s.summary),
          }),
        );
        return [...base, ...extraSections];
      }
      case 'diagrams': {
        const design = analysis?.design;
        const sections = design?.sections ?? [];
        if (sections.length > 0) {
          return sections.map((s: { name: string; data?: unknown; summary?: string }) => ({
            name: s.name,
            status: this.sectionStatus(!!s.data || !!s.summary),
          }));
        }
        return [
          {
            name: this.translate.instant('chat.card.diagramsSection'),
            status: this.sectionStatus(!!design?.content),
          },
        ];
      }
      case 'legalDocs': {
        const documents = analysis?.legalDocs?.documents ?? [];
        return documents.map((d: { name: string; data?: string }) => ({
          name: d.name,
          status: this.sectionStatus(!!d.data),
        }));
      }
      case 'finance': {
        // Le détail finance vit derrière son propre endpoint ; la carte expose
        // l'essentiel et renvoie vers l'éditeur ou le PDF.
        return [
          {
            name: this.translate.instant('chat.card.financeSection'),
            status: 'inProgress',
          },
        ];
      }
    }
  }

  private resolveUpdatedAt(kind: DeliverableKind, project: ProjectModel | null): string | undefined {
    const analysis = project?.analysisResultModel;
    const raw =
      (kind === 'businessPlan' && (analysis?.businessPlan?.updatedAt || analysis?.businessPlan?.createdAt)) ||
      (kind === 'pitchDeck' && analysis?.pitchDeck?.generatedAt) ||
      (kind === 'branding' && (analysis?.branding?.updatedAt || analysis?.branding?.createdAt)) ||
      (kind === 'diagrams' && (analysis?.design?.updatedAt || analysis?.design?.createdAt)) ||
      (kind === 'legalDocs' && analysis?.legalDocs?.updatedAt) ||
      project?.updatedAt;
    if (!raw) return undefined;
    const date = new Date(raw);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  /** Récupère le PDF d'un livrable (réutilise les endpoints existants). */
  fetchPdf(kind: DeliverableKind, projectId: string): Observable<Blob> {
    switch (kind) {
      case 'businessPlan':
        return this.businessPlanService.downloadBusinessPlanPdf(projectId);
      case 'branding':
        return this.brandingService.downloadBrandingPdf(projectId);
      case 'pitchDeck':
        return this.pitchDeckService.downloadPitchDeckPdf(projectId);
      case 'finance':
        return this.financeService.downloadFinancePdf(projectId);
      default:
        return throwError(() => new Error(`PDF non disponible pour ${kind}`));
    }
  }

  /** Déclenche le téléchargement immédiat d'un blob (pas de page intermédiaire). */
  triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  downloadFilename(kind: DeliverableKind, projectName: string | undefined): string {
    const safeName = (projectName || 'idem-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    const suffix: Record<DeliverableKind, string> = {
      businessPlan: 'business-plan',
      branding: 'branding',
      pitchDeck: 'pitch-deck',
      diagrams: 'diagrams',
      legalDocs: 'legal-docs',
      finance: 'finance-report',
    };
    return `${safeName}-${suffix[kind]}.pdf`;
  }

  /** Télécharge un livrable ; résout true si le fichier a été obtenu. */
  async download(kind: DeliverableKind, projectId: string, projectName?: string): Promise<boolean> {
    try {
      const blob = await firstValueFrom(this.fetchPdf(kind, projectId));
      if (!blob || blob.size === 0) return false;
      this.triggerDownload(blob, this.downloadFilename(kind, projectName));
      return true;
    } catch {
      return false;
    }
  }

  /** "Tout exporter" : télécharge tous les PDF disponibles, retourne le compte. */
  async exportAll(projectId: string, projectName?: string): Promise<number> {
    const pdfKinds = this.kinds().filter((k) => KIND_CONFIG[k].pdfSupported);
    let downloaded = 0;
    for (const kind of pdfKinds) {
      const ok = await this.download(kind, projectId, projectName);
      if (ok) downloaded += 1;
    }
    return downloaded;
  }

  /** Résumé markdown de l'avancement du projet pour l'intent "où en est mon projet". */
  buildStatusSummary(project: ProjectModel | null): string {
    const lines: string[] = [
      this.translate.instant('chat.status.intro', { name: project?.name ?? '' }),
      '',
    ];
    for (const kind of this.kinds()) {
      const card = this.buildCard(kind, project);
      const title = this.translate.instant(card.titleKey);
      const ready = card.sections.filter((s) => s.status === 'ready').length;
      const total = card.sections.length;
      let statusLabel: string;
      if (kind === 'finance') {
        statusLabel = this.translate.instant('chat.status.openEditor');
      } else if (total === 0 || ready === 0) {
        statusLabel = this.translate.instant('chat.status.missing');
      } else if (ready < total) {
        statusLabel = this.translate.instant('chat.status.partial', { ready, total });
      } else {
        statusLabel = this.translate.instant('chat.status.ready');
      }
      lines.push(`- **${title}** — ${statusLabel}`);
    }
    lines.push('');
    lines.push(this.translate.instant('chat.status.hint'));
    return lines.join('\n');
  }
}
