import crypto from 'crypto';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { ProjectModel } from '../../models/project.model';
import { SectionModel } from '../../models/section.model';
import {
  BusinessCardExport,
  BusinessCardHolder,
  BusinessCardModel,
  BusinessCardOrientation,
  BusinessCardSide,
  BUSINESS_CARD_BACK_ID,
  BUSINESS_CARD_FIELDS,
  BUSINESS_CARD_FRONT_ID,
  BusinessCardField,
} from '../../models/businessCard.model';
import { GenericService } from '../common/generic.service';
import { AIChatMessage, PromptConfig, PromptService } from '../prompt.service';
import { parseLlmJson } from '../../utils/llm-json.util';
import { sanitizeSectionHtml } from '../../utils/sanitize-section-html';
import { interpolateBusinessCard } from '../../utils/business-card-template';
import { SupportedLanguage } from '../../utils/request-language';
import { buildBusinessCardPrompt } from './prompts/business-card-generation.prompt';
import { buildArtDirectionBlock } from '../../utils/art-direction.util';
import { businessCardRenderService } from './businessCardRender.service';

/** Réponse attendue du modèle. */
interface GeneratedTemplate {
  name?: string;
  concept?: string;
  frontHtml?: string;
  backHtml?: string;
  fields?: string[];
}

export interface GenerateTemplateOptions {
  orientation?: BusinessCardOrientation;
  /** Direction artistique libre saisie par l'utilisateur. */
  styleBrief?: string;
  language?: SupportedLanguage;
}

/**
 * BusinessCardService — cartes de visite du projet.
 *
 * Modèle mental : UN template (recto/verso) + N personnes. La carte d'une
 * personne n'est jamais stockée : c'est le template interpolé à la volée. Toute
 * modification du template (éditeur WYSIWYG ou régénération) se propage donc
 * immédiatement à toutes les cartes, ce qui est exactement le comportement
 * attendu côté produit.
 *
 * Le template vit dans `analysisResultModel.businessCard.sections` avec les
 * mêmes conventions que les autres documents HTML, ce qui permet de réutiliser
 * `sectionEditingService` (sauvegarde + édition IA) sans code spécifique.
 */
export class BusinessCardService extends GenericService {
  private readonly collection = (userId: string) => `users/${userId}/projects`;

  constructor(promptService: PromptService) {
    super(promptService);
    logger.info('BusinessCardService initialized.');
  }

  // ---------------------------------------------------------------------------
  // Lecture
  // ---------------------------------------------------------------------------

  async getBusinessCard(userId: string, projectId: string): Promise<BusinessCardModel | null> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId), {
      bypassCache: true,
    });
    if (!project) return null;
    return this.normalize((project.analysisResultModel as any)?.businessCard);
  }

  /** Garantit la forme du modèle même sur des données anciennes/partielles. */
  private normalize(raw: any): BusinessCardModel {
    return {
      template: raw?.template,
      sections: Array.isArray(raw?.sections) ? raw.sections : [],
      holders: Array.isArray(raw?.holders) ? raw.holders : [],
      createdAt: raw?.createdAt,
      updatedAt: raw?.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Génération du template
  // ---------------------------------------------------------------------------

  async generateTemplate(
    userId: string,
    projectId: string,
    options: GenerateTemplateOptions = {}
  ): Promise<BusinessCardModel> {
    const project = await this.getProject(projectId, userId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const orientation: BusinessCardOrientation = options.orientation ?? 'landscape';
    const branding = (project.analysisResultModel as any)?.branding;
    if (!branding?.colors?.colors && !branding?.logo?.svg && !branding?.logo?.assetUrls?.primary) {
      throw new Error('BRANDING_REQUIRED');
    }

    const prompt = buildBusinessCardPrompt({
      projectName: project.name || 'Brand',
      projectDescription: project.description || '',
      industry: project.type || project.scope || 'general',
      orientation,
      width: orientation === 'landscape' ? 85 : 55,
      height: orientation === 'landscape' ? 55 : 85,
      colors: {
        primary: branding?.colors?.colors?.primary || '#111827',
        secondary: branding?.colors?.colors?.secondary || '#374151',
        accent: branding?.colors?.colors?.accent || '#2563EB',
        background: branding?.colors?.colors?.background || '#FFFFFF',
        text: branding?.colors?.colors?.text || '#111827',
      },
      typography: {
        primaryFont: branding?.typography?.primaryFont || 'Archivo',
        secondaryFont: branding?.typography?.secondaryFont || 'IBM Plex Sans',
      },
      logos: this.collectLogoUrls(branding),
      styleBrief: options.styleBrief?.trim() || undefined,
      // La carte est tenue à côté du logo : c'est le support où un écart avec
      // la direction artistique de la marque se voit le plus.
      artDirectionBlock: buildArtDirectionBlock(branding?.artDirection, { medium: 'poster' }),
    });

    const config: PromptConfig = {
      provider: AI_CONFIG.branding.businessCard.provider,
      modelName: AI_CONFIG.branding.businessCard.modelName,
      fallbackModels: AI_CONFIG.branding.businessCard.fallbackModels,
      llmOptions: { ...AI_CONFIG.branding.businessCard.llmOptions },
      userId,
      promptType: 'branding_business_card',
      language: options.language,
    };
    const messages: AIChatMessage[] = [{ role: 'user', content: prompt }];

    logger.info('[BusinessCard] generating template', { projectId, orientation });
    const raw = await this.promptService.runPrompt(config, messages);
    const parsed = this.parseTemplateResponse(raw);

    const frontHtml = sanitizeSectionHtml(parsed.frontHtml ?? '');
    const backHtml = sanitizeSectionHtml(parsed.backHtml ?? '');
    if (!frontHtml) {
      // Trace de quoi diagnostiquer sans déverser une réponse entière (plusieurs
      // milliers de caractères) dans les logs.
      logger.error('[BusinessCard] AI returned no usable front face', {
        projectId,
        rawLength: raw?.length ?? 0,
        rawHead: (raw ?? '').slice(0, 300),
        rawTail: (raw ?? '').slice(-300),
      });
      throw new Error('TEMPLATE_GENERATION_FAILED');
    }

    const sections: SectionModel[] = [
      {
        id: BUSINESS_CARD_FRONT_ID,
        name: 'Front',
        type: 'business-card',
        data: frontHtml,
        summary: 'Business card front face template',
        updatedAt: new Date(),
      },
      {
        id: BUSINESS_CARD_BACK_ID,
        name: 'Back',
        type: 'business-card',
        data: backHtml || frontHtml,
        summary: 'Business card back face template',
        updatedAt: new Date(),
      },
    ];

    return this.patch(userId, projectId, (existing) => ({
      ...existing,
      template: {
        id: `card-tpl-${crypto.randomUUID()}`,
        name: parsed?.name?.trim() || 'Business card',
        concept: parsed?.concept?.trim() || '',
        orientation,
        fields: this.normalizeFields(parsed?.fields, `${frontHtml}${backHtml}`),
        createdAt: existing.template?.createdAt ?? new Date(),
        updatedAt: new Date(),
      },
      sections,
      // Les personnes déjà saisies sont conservées : leurs cartes basculent
      // simplement sur le nouveau template.
      holders: existing.holders ?? [],
      createdAt: existing.createdAt ?? new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Lit la réponse du modèle.
   *
   * Le format demandé est délimité par des marqueurs `===NAME===` plutôt que
   * du JSON : deux faces de HTML Tailwind dans des chaînes JSON, ce sont des
   * centaines de guillemets à échapper, et un seul raté rendait TOUTE la
   * réponse inparsable (`parseLlmJson: all parse attempts failed`). Les
   * marqueurs n'ont pas ce problème. Le repli JSON reste là pour les modèles
   * qui ignorent la consigne.
   */
  private parseTemplateResponse(raw: string): GeneratedTemplate {
    const text = (raw ?? '').trim();

    const block = (marker: string, next: string | null): string | undefined => {
      const pattern = next
        ? new RegExp(`={2,}\\s*${marker}\\s*={2,}([\\s\\S]*?)={2,}\\s*${next}\\s*={2,}`, 'i')
        : new RegExp(`={2,}\\s*${marker}\\s*={2,}([\\s\\S]*)$`, 'i');
      const match = text.match(pattern);
      return match ? match[1].trim() : undefined;
    };

    const frontHtml = block('FRONT', 'BACK');
    if (frontHtml) {
      return {
        name: block('NAME', 'CONCEPT'),
        concept: block('CONCEPT', 'FRONT'),
        frontHtml,
        backHtml: block('BACK', null),
      };
    }

    const json = parseLlmJson<GeneratedTemplate>(text);
    if (json?.frontHtml) return json;

    logger.warn('[BusinessCard] neither the delimited format nor JSON could be read');
    return {};
  }

  /**
   * Champs réellement exploitables : ceux annoncés par le modèle, recoupés avec
   * les marqueurs présents dans le HTML (le modèle se trompe parfois dans sa
   * liste, le HTML fait foi).
   */
  private normalizeFields(declared: string[] | undefined, html: string): BusinessCardField[] {
    const inHtml = new Set<string>();
    const matcher = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(html)) !== null) inHtml.add(match[1]);

    const fields = BUSINESS_CARD_FIELDS.filter(
      (field) => inHtml.has(field) || declared?.includes(field)
    );
    return fields.length > 0 ? [...fields] : ['fullName'];
  }

  /** Extrait les URLs PNG des déclinaisons du logo (chaînes vides si absentes). */
  private collectLogoUrls(branding: any) {
    const urls = branding?.logo?.assetUrls;
    const primary = urls?.primary || '';
    const pick = (value?: string) => (value && String(value).trim()) || primary;
    return {
      primary,
      withTextLight: pick(urls?.withText?.lightBackground),
      withTextDark: pick(urls?.withText?.darkBackground),
      withTextMono: pick(urls?.withText?.monochrome),
      iconLight: pick(urls?.iconOnly?.lightBackground || urls?.icon),
      iconDark: pick(urls?.iconOnly?.darkBackground || urls?.icon),
      iconMono: pick(urls?.iconOnly?.monochrome || urls?.icon),
    };
  }

  // ---------------------------------------------------------------------------
  // Personnes (porteurs de carte)
  // ---------------------------------------------------------------------------

  async addHolder(
    userId: string,
    projectId: string,
    input: Omit<BusinessCardHolder, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BusinessCardHolder> {
    const clean = this.sanitizeHolderInput(input);
    const holder: BusinessCardHolder = {
      ...clean,
      fullName: clean.fullName ?? '',
      id: `holder-${crypto.randomUUID()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.patch(userId, projectId, (existing) => ({
      ...existing,
      holders: [...(existing.holders ?? []), holder],
      updatedAt: new Date(),
    }));
    return holder;
  }

  async updateHolder(
    userId: string,
    projectId: string,
    holderId: string,
    updates: Partial<BusinessCardHolder>
  ): Promise<BusinessCardHolder | null> {
    let updated: BusinessCardHolder | null = null;
    await this.patch(userId, projectId, (existing) => ({
      ...existing,
      holders: (existing.holders ?? []).map((holder) => {
        if (holder.id !== holderId) return holder;
        updated = {
          ...holder,
          ...this.sanitizeHolderInput(updates),
          id: holder.id,
          createdAt: holder.createdAt,
          updatedAt: new Date(),
        };
        return updated;
      }),
      updatedAt: new Date(),
    }));
    return updated;
  }

  async deleteHolder(userId: string, projectId: string, holderId: string): Promise<boolean> {
    let removed = false;
    await this.patch(userId, projectId, (existing) => {
      const holders = (existing.holders ?? []).filter((holder) => {
        if (holder.id === holderId) {
          removed = true;
          return false;
        }
        return true;
      });
      return { ...existing, holders, updatedAt: new Date() };
    });
    return removed;
  }

  /** Ne conserve que les champs connus et les normalise en chaînes trimées. */
  private sanitizeHolderInput(input: Partial<BusinessCardHolder>): Partial<BusinessCardHolder> {
    const clean: Record<string, string> = {};
    for (const field of BUSINESS_CARD_FIELDS) {
      const value = (input as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.trim()) clean[field] = value.trim();
    }
    return clean as Partial<BusinessCardHolder>;
  }

  // ---------------------------------------------------------------------------
  // Rendu d'une carte
  // ---------------------------------------------------------------------------

  /**
   * Rend la carte d'une personne (une face) en PNG ou PDF prêt à imprimer.
   * Le HTML rendu est toujours dérivé du template courant.
   */
  async renderHolderCard(
    userId: string,
    projectId: string,
    holderId: string,
    side: BusinessCardSide,
    format: BusinessCardExport
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const project = await this.getProject(projectId, userId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const card = this.normalize((project.analysisResultModel as any)?.businessCard);
    const holder = card.holders.find((h) => h.id === holderId);
    if (!holder) throw new Error('HOLDER_NOT_FOUND');

    const sectionId = side === 'back' ? BUSINESS_CARD_BACK_ID : BUSINESS_CARD_FRONT_ID;
    const section = card.sections.find((s) => s.id === sectionId);
    if (!section || typeof section.data !== 'string' || !section.data.trim()) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }

    const branding = (project.analysisResultModel as any)?.branding;
    const values: Record<string, string | undefined> = {
      companyName: project.name,
      tagline: (project.description ?? '').split('.')[0],
    };
    for (const field of BUSINESS_CARD_FIELDS) {
      const value = (holder as unknown as Record<string, unknown>)[field];
      if (typeof value === 'string') values[field] = value;
    }
    const html = interpolateBusinessCard(section.data, values);

    const buffer = await businessCardRenderService.render(html, {
      orientation: card.template?.orientation ?? 'landscape',
      format,
      typography: branding?.typography,
    });

    const slug = (holder.fullName || 'card').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return { buffer, fileName: `${slug}-${side}.${format}` };
  }

  // ---------------------------------------------------------------------------
  // Persistance
  // ---------------------------------------------------------------------------

  private async patch(
    userId: string,
    projectId: string,
    patcher: (existing: BusinessCardModel) => BusinessCardModel
  ): Promise<BusinessCardModel> {
    const project = await this.projectRepository.findById(projectId, this.collection(userId), {
      bypassCache: true,
    });
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const analysis = ((project as ProjectModel).analysisResultModel as any) ?? {};
    const patched = patcher(this.normalize(analysis.businessCard));

    await this.projectRepository.update(
      projectId,
      { analysisResultModel: { ...analysis, businessCard: patched } } as Partial<ProjectModel>,
      this.collection(userId)
    );
    return patched;
  }
}
