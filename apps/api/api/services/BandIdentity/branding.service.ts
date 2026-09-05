import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import { LLMProvider, PromptService } from '../prompt.service';
import { AI_CONFIG } from '../../config/ai.config';
import { SvgToPsdService } from '../svgToPsd.service';
import * as fs from 'fs-extra';

import { BrandIdentityModel, ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { LOGO_GENERATION_PROMPT } from './prompts/singleGenerations/00_logo-generation-section.prompt';
import { LOGO_GENERATION_ICON_TYPE_PROMPT } from './prompts/singleGenerations/00_logo-generation-icon-type.prompt';
import { LOGO_GENERATION_NAME_TYPE_PROMPT } from './prompts/singleGenerations/00_logo-generation-name-type.prompt';
import { LOGO_GENERATION_INITIAL_TYPE_PROMPT } from './prompts/singleGenerations/00_logo-generation-initial-type.prompt';
import { LOGO_VARIATION_LIGHT_PROMPT } from './prompts/singleGenerations/logo-variation-light.prompt';
import { LOGO_VARIATION_DARK_PROMPT } from './prompts/singleGenerations/logo-variation-dark.prompt';
import { LOGO_VARIATION_MONOCHROME_PROMPT } from './prompts/singleGenerations/logo-variation-monochrome.prompt';
import {
  LOGO_VARIATION_LIGHT_WITHTEXT_PROMPT,
  LOGO_VARIATION_DARK_WITHTEXT_PROMPT,
  LOGO_VARIATION_MONOCHROME_WITHTEXT_PROMPT,
} from './prompts/singleGenerations/logo-variation-withtext.prompt';
import {
  ICON_ONLY_EDIT_SCOPE,
  LOGO_EDIT_PROMPT,
} from './prompts/singleGenerations/logo-edit.prompt';
import {
  COMPOSED_LOCKUP_REVIEW_NOTE,
  LOGO_CRITIQUE_PROMPT,
} from './prompts/singleGenerations/logo-critique.prompt';
import {
  ICON_ONLY_REVISION_SCOPE,
  LOGO_REVISION_PROMPT,
} from './prompts/singleGenerations/logo-revision.prompt';

import { BRAND_HEADER_SECTION_PROMPT } from './prompts/00_brand-header-section.prompt';
import { ART_DIRECTION_SECTION_PROMPT } from './prompts/03b_art-direction-section.prompt';
import { buildArtDirectionPrompt } from './prompts/singleGenerations/art-direction.prompt';
import { ArtDirectionModel, ArtDirectionStyleId } from '../../models/art-direction.model';
import {
  ART_DIRECTION_STYLES,
  ART_DIRECTION_STYLE_IDS,
  resolveStyle,
} from '../design/artDirection.catalog';
import { ANTI_SLOP_BLOCK, SELF_REVIEW_BLOCK } from '../design/antiSlop.prompt';
import {
  EDITORIAL_RESTRAINT_BLOCK,
  RESTRAINT_SELF_REVIEW_BLOCK,
} from '../design/editorialRestraint.prompt';
import {
  buildDocumentSeed,
  buildPaletteConstraint,
  buildSectionSeed,
  buildTypographyConstraint,
  describeDocumentSeed,
  describePaletteConstraint,
  describeSectionSeed,
} from '../design/designSeed';
import { enforceDesignRules } from '../design/slopLint.service';
import { inspectSvg } from '../design/svgGate';
import { logAIEvent } from '../../utils/ai-trace.util';
import { buildArtDirectionBlock } from '../../utils/art-direction.util';
import {
  LOGO_SYSTEM_SECTION_PROMPT,
  LOGO_VARIATION_PAGE_PROMPT,
  LOGO_BEST_PRACTICES_PAGE_PROMPT,
} from './prompts/01_logo-system-section.prompt';
import { COLOR_PALETTE_SECTION_PROMPT } from './prompts/02_color-palette-section.prompt';
import { TYPOGRAPHY_SECTION_PROMPT } from './prompts/03_typography-section.prompt';
import { BRAND_FOOTER_SECTION_PROMPT } from './prompts/07_brand-footer-section.prompt';
import { MOCKUP_CONFIG } from '../../config/mockup.config';
import { SectionModel } from '../../models/section.model';
import { BrandIdentityBuilder } from '../../models/builders/brandIdentity.builder';
import {
  GenericService,
  IPromptStep,
  ISectionResult,
  withSectionConfigs,
} from '../common/generic.service';
import { LogoLockupSpec, LogoModel, LogoPreferences, LogoType } from '../../models/logo.model';
import {
  logoLockupService,
  normalizeTracking,
  normalizeWordmarkWeight,
  pickWordmarkColor,
} from './lockup/logoLockup.service';
import { COLORS_GENERATION_PROMPT } from './prompts/singleGenerations/colors-generation.prompt';
import { TYPOGRAPHY_GENERATION_PROMPT } from './prompts/singleGenerations/typography-generation.prompt';
import {
  COLORS_FROM_LOGO_PROMPT,
  TYPOGRAPHY_FROM_LOGO_PROMPT,
} from './prompts/singleGenerations/colors-from-logo.prompt';
import {
  generateLogoVariations,
  AiRecolorRequest,
  measureSvgVisibility,
  applyColorMappingToSvg,
} from '../logoVariationEngine.service';
import { LOGO_VARIATION_CRITIQUE_PROMPT } from './prompts/singleGenerations/logo-variation-critique.prompt';
import { resolveSvgContent } from '../logo-import.service';
import { parseLlmJson } from '../../utils/llm-json.util';
import { summarizeLogoForPrompt } from '../../utils/logo-context.util';
import { LOGO_VARIATION_RECOLOR_PROMPT } from './prompts/singleGenerations/logo-variation-recolor.prompt';
import { PdfService, PAGE_FORMATS } from '../pdf.service';
import { cacheService } from '../cache.service';
import crypto from 'crypto';
import { projectService } from '../project.service';
import { LogoJsonToSvgService } from './logoJsonToSvg.service';
import { SvgOptimizerService } from './svgOptimizer.service';
import {
  geminiMockupService,
  MockupGenerationResult,
  MockupLogoVariants,
} from '../brandMockup.service';
import { StorageService } from '../storage.service';
import { openAiUsageBatch, setAiUsageContext } from '../../utils/ai-usage-context.util';

/** Verdict de l'agent critique sur un concept de logo */
export interface LogoCritiqueResult {
  verdict: 'pass' | 'fail';
  score: number;
  summary: string;
  remarks: Array<{ criterion: string; issue: string; fix: string }>;
}

/** Événement émis pendant la génération streamée des concepts de logo */
export interface ILogoStreamEvent {
  type:
    | 'concept_started'
    | 'concept_generated'
    | 'critique_started'
    | 'critique_result'
    | 'revision_started'
    | 'concept_updated'
    | 'concept_finalized'
    | 'concept_cancelled'
    | 'concept_error';
  conceptIndex: number;
  logo?: LogoModel;
  critique?: LogoCritiqueResult;
  message?: string;
}

/** Déclinaison de logo : type + fond cible */
export type LogoVariationKind = 'lightBackground' | 'darkBackground' | 'monochrome';

/**
 * Style de déclinaison :
 *  - 'withText'  → logo COMPLET recoloré (icône + wordmark), le nom de marque est
 *    conservé. C'est le jeu "héros" affiché en direct et jugé par le vérificateur.
 *  - 'iconOnly'  → symbole seul, texte retiré + recentré (déclinaison d'icône).
 * Les deux jeux partagent la même géométrie ; seules les couleurs et la présence
 * du texte diffèrent.
 */
export type LogoVariationStyle = 'withText' | 'iconOnly';

const VARIATION_BACKGROUNDS: Record<LogoVariationKind, string> = {
  lightBackground: '#ffffff',
  darkBackground: '#1a1a2e',
  monochrome: '#f4f4f6',
};

/** Prompts recolorant le LOGO COMPLET en conservant le texte (jeu withText). */
const WITHTEXT_VARIATION_PROMPTS: Record<LogoVariationKind, string> = {
  lightBackground: LOGO_VARIATION_LIGHT_WITHTEXT_PROMPT,
  darkBackground: LOGO_VARIATION_DARK_WITHTEXT_PROMPT,
  monochrome: LOGO_VARIATION_MONOCHROME_WITHTEXT_PROMPT,
};

/** Prompts extrayant + recentrant + recolorant l'icône seule (jeu iconOnly). */
const ICONONLY_VARIATION_PROMPTS: Record<LogoVariationKind, string> = {
  lightBackground: LOGO_VARIATION_LIGHT_PROMPT,
  darkBackground: LOGO_VARIATION_DARK_PROMPT,
  monochrome: LOGO_VARIATION_MONOCHROME_PROMPT,
};

function safeParseJson(content: string): any {
  if (!content) return null;
  let cleaned = content.trim();
  // Strip markdown code fences (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Find JSON structure { ... } or [ ... ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  // Attempt 1: direct parse
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Attempt 2: escape raw newlines
  try {
    const sanitized = cleaned.replace(/[\r\n]/g, (match) => (match === '\n' ? '\\n' : '\\r'));
    return JSON.parse(sanitized);
  } catch (_) {
    // continue
  }

  // Attempt 3: repair truncated JSON — close open brackets/braces
  try {
    let repaired = cleaned;
    // Strip trailing comma + whitespace that precedes a missing element
    repaired = repaired.replace(/,\s*$/, '');
    // Strip incomplete trailing key/value (e.g. `"name": "foo`, `"id":`)
    repaired = repaired.replace(/,?\s*"[^"]*":\s*"?[^",}\]]*$/m, '');
    // Count open vs close braces/brackets and append missing closers
    const opens = { '{': 0, '[': 0 };
    for (const ch of repaired) {
      if (ch === '{') opens['{']++;
      else if (ch === '}') opens['{']--;
      else if (ch === '[') opens['[']++;
      else if (ch === ']') opens['[']--;
    }
    // Close innermost first: arrays before objects
    for (let i = 0; i < opens['[']; i++) repaired += ']';
    for (let i = 0; i < opens['{']; i++) repaired += '}';
    return JSON.parse(repaired);
  } catch (e) {
    logger.error(`safeParseJson: all repair attempts failed`, {
      error: e instanceof Error ? e.message : e,
      snippet: cleaned.slice(0, 300),
    });
    throw new Error(
      `safeParseJson failed: ${e instanceof Error ? e.message : 'unknown error'}`
    );
  }
}

/** Événement émis pendant la génération streamée des déclinaisons */
export interface ILogoVariationStreamEvent {
  type:
    | 'variation_started'
    | 'variation_generated'
    | 'critique_started'
    | 'critique_result'
    | 'revision_started'
    | 'variation_updated'
    | 'variation_finalized'
    | 'variation_cancelled'
    | 'variation_error';
  variant: LogoVariationKind;
  svg?: string;
  critique?: LogoCritiqueResult;
  message?: string;
}

export class BrandingService extends GenericService {
  private pdfService: PdfService;
  private logoJsonToSvgService: LogoJsonToSvgService;
  private storageService: StorageService;

  /**
   * Générations de logos en cours, pour l'annulation anticipée
   * (l'utilisateur sélectionne un logo → on arrête les autres concepts).
   * Clé : `${userId}_${projectId}` (concepts) / `variations_${userId}_${projectId}`.
   */
  private static readonly activeLogoGenerations = new Map<string, { cancelled: boolean }>();

  private static logoGenerationKey(userId: string, projectId: string): string {
    return `${userId}_${projectId}`;
  }

  private static variationsGenerationKey(userId: string, projectId: string): string {
    return `variations_${userId}_${projectId}`;
  }

  /** Annule la génération streamée des déclinaisons (fermeture de page, etc.) */
  cancelLogoVariationsGeneration(userId: string, projectId: string): boolean {
    const state = BrandingService.activeLogoGenerations.get(
      BrandingService.variationsGenerationKey(userId, projectId)
    );
    if (state) {
      state.cancelled = true;
      logger.info(`Logo variations generation cancelled - UserId: ${userId}, ProjectId: ${projectId}`);
      return true;
    }
    return false;
  }

  /**
   * Annule la génération de logos en cours pour ce projet.
   * Retourne true si une génération était effectivement en cours.
   */
  cancelLogoGeneration(userId: string, projectId: string): boolean {
    const state = BrandingService.activeLogoGenerations.get(
      BrandingService.logoGenerationKey(userId, projectId)
    );
    if (state) {
      state.cancelled = true;
      logger.info(`Logo generation cancelled - UserId: ${userId}, ProjectId: ${projectId}`);
      return true;
    }
    return false;
  }

  // Configuration LLM pour la génération de logos et variations
  // Optimisée pour qualité maximale avec vitesse préservée
  private static readonly LOGO_LLM_CONFIG = {
    provider: AI_CONFIG.branding.logo.provider,
    modelName: AI_CONFIG.branding.logo.modelName,
    // Sans cette ligne la chaîne de repli déclarée dans ai.config.ts
    // n'atteignait jamais runPrompt (`fallbacks=0` dans les logs) : le
    // seul repli restant était celui codé en dur côté PromptService.
    fallbackModels: AI_CONFIG.branding.logo.fallbackModels,
    llmOptions: {
      ...AI_CONFIG.branding.logo.llmOptions,
    },
  };

  // Configuration LLM optimisée pour la vitesse — génération de couleurs
  private static readonly COLORS_LLM_CONFIG = {
    provider: AI_CONFIG.branding.colors.provider,
    modelName: AI_CONFIG.branding.colors.modelName,
    // Sans cette ligne la chaîne de repli déclarée dans ai.config.ts
    // n'atteignait jamais runPrompt (`fallbacks=0` dans les logs) : le
    // seul repli restant était celui codé en dur côté PromptService.
    fallbackModels: AI_CONFIG.branding.colors.fallbackModels,
    llmOptions: {
      ...AI_CONFIG.branding.colors.llmOptions,
    },
  };

  // Configuration LLM optimisée pour la vitesse — génération de typographies
  private static readonly TYPOGRAPHY_LLM_CONFIG = {
    provider: AI_CONFIG.branding.typography.provider,
    modelName: AI_CONFIG.branding.typography.modelName,
    // Sans cette ligne la chaîne de repli déclarée dans ai.config.ts
    // n'atteignait jamais runPrompt (`fallbacks=0` dans les logs) : le
    // seul repli restant était celui codé en dur côté PromptService.
    fallbackModels: AI_CONFIG.branding.typography.fallbackModels,
    llmOptions: {
      ...AI_CONFIG.branding.typography.llmOptions,
    },
  };

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    this.logoJsonToSvgService = new LogoJsonToSvgService();
    this.storageService = new StorageService();
    logger.info('BrandingService initialized with optimized logo generation');
  }

  /**
   * Adapte un prompt de section (écrit par défaut en slide 16:9 = 297×167mm) au
   * format de page RÉELLEMENT choisi par l'utilisateur, en remplaçant les tokens
   * de dimensions. No-op quand le format cible est déjà 297×167.
   */
  private applyPageFormatToPrompt(
    prompt: string,
    format: { width: string; height: string; orientation: string }
  ): string {
    if (format.width === '297mm' && format.height === '167mm') {
      return prompt;
    }
    return prompt
      .split('w-[297mm] h-[167mm]')
      .join(`w-[${format.width}] h-[${format.height}]`)
      .split('h-[167mm]')
      .join(`h-[${format.height}]`)
      .split('w-[297mm]')
      .join(`w-[${format.width}]`)
      .split('Landscape 16:9')
      .join(`${format.orientation} ${format.width}×${format.height}`);
  }

  /**
   * Récupération optimisée du projet avec cache intelligent
   */
  private async getProjectOptimized(
    userId: string,
    projectId: string
  ): Promise<ProjectModel | null> {
    const projectCacheKey = `project_${userId}_${projectId}`;

    // Tentative de récupération depuis le cache
    let project = await cacheService.get<ProjectModel>(projectCacheKey, {
      prefix: 'project',
    });

    if (project) {
      logger.info(`Project cache hit - ProjectId: ${projectId}`);
      return project;
    }

    // Fallback vers la base de données
    logger.info(`Project cache miss, fetching from database - ProjectId: ${projectId}`);
    project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (project) {
      // Cache asynchrone (non-bloquant)
      cacheService
        .set(projectCacheKey, project, {
          prefix: 'project',
          ttl: 3600,
        })
        .catch((error) => logger.error(`Error caching project:`, error));
    }

    return project;
  }

  /**
   * Extrait le nom du projet depuis la description
   */
  private extractProjectName(projectDescription: string): string {
    // Chercher le nom du projet dans la description (généralement au début)
    const nameMatch = projectDescription.match(
      /(?:project name|nom du projet|name)[:\s]+([^\n.]+)/i
    );
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    // Fallback: première ligne non vide
    const firstLine = projectDescription.split('\n').find((line) => line.trim());
    return firstLine?.trim() || 'Brand';
  }

  /**
   * Nom de marque à afficher dans le logo : le nom du projet, sinon celui
   * déduit de la description. Jamais le titre créatif du concept.
   */
  private resolveBrandName(project: ProjectModel): string {
    const projectName = project.name?.trim();
    if (projectName) return projectName;
    return this.extractProjectName(this.extractProjectDescription(project));
  }

  /**
   * Génère les initiales depuis le nom du projet
   */
  private generateInitials(projectName: string): string {
    // Nettoyer et diviser le nom
    const words = projectName
      .replace(/[^\w\s]/g, '') // Enlever la ponctuation
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) return 'BR';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();

    // Prendre la première lettre de chaque mot (max 3)
    return words
      .slice(0, 3)
      .map((word) => word[0].toUpperCase())
      .join('');
  }

  /**
   * Extrait les informations clés du projet pour guider la génération de logo
   */
  private extractProjectContext(projectDescription: string): {
    industry: string;
    values: string[];
    targetAudience: string;
    uniqueSellingPoint: string;
  } {
    // Analyser la description pour extraire le contexte
    const lowerDesc = projectDescription.toLowerCase();

    // Détecter l'industrie
    let industry = 'Technology';
    if (
      lowerDesc.includes('livraison') ||
      lowerDesc.includes('delivery') ||
      lowerDesc.includes('logisti') ||
      lowerDesc.includes('transport') ||
      lowerDesc.includes('colis') ||
      lowerDesc.includes('shipping') ||
      lowerDesc.includes('coursier')
    ) {
      industry = 'Delivery & Logistics';
    } else if (
      lowerDesc.includes('food') ||
      lowerDesc.includes('restaurant') ||
      lowerDesc.includes('cuisine') ||
      lowerDesc.includes('chef') ||
      lowerDesc.includes('menu') ||
      lowerDesc.includes('traiteur')
    ) {
      industry = 'Food & Beverage';
    } else if (
      lowerDesc.includes('fashion') ||
      lowerDesc.includes('clothing') ||
      lowerDesc.includes('apparel') ||
      lowerDesc.includes('mode') ||
      lowerDesc.includes('vêtement')
    ) {
      industry = 'Fashion';
    } else if (
      lowerDesc.includes('health') ||
      lowerDesc.includes('medical') ||
      lowerDesc.includes('wellness') ||
      lowerDesc.includes('santé') ||
      lowerDesc.includes('médic') ||
      lowerDesc.includes('clinic') ||
      lowerDesc.includes('pharma')
    ) {
      industry = 'Healthcare';
    } else if (
      lowerDesc.includes('finance') ||
      lowerDesc.includes('bank') ||
      lowerDesc.includes('investment') ||
      lowerDesc.includes('banque') ||
      lowerDesc.includes('assurance') ||
      lowerDesc.includes('comptab')
    ) {
      industry = 'Finance';
    } else if (
      lowerDesc.includes('education') ||
      lowerDesc.includes('learning') ||
      lowerDesc.includes('school') ||
      lowerDesc.includes('éducation') ||
      lowerDesc.includes('formation') ||
      lowerDesc.includes('école')
    ) {
      industry = 'Education';
    } else if (
      lowerDesc.includes('sport') ||
      lowerDesc.includes('fitness') ||
      lowerDesc.includes('gym') ||
      lowerDesc.includes('entraîn')
    ) {
      industry = 'Sports & Fitness';
    } else if (
      lowerDesc.includes('travel') ||
      lowerDesc.includes('tourism') ||
      lowerDesc.includes('hotel') ||
      lowerDesc.includes('voyage') ||
      lowerDesc.includes('hôtel') ||
      lowerDesc.includes('tourisme')
    ) {
      industry = 'Travel & Hospitality';
    } else if (
      lowerDesc.includes('immobili') ||
      lowerDesc.includes('real estate') ||
      lowerDesc.includes('property') ||
      lowerDesc.includes('logement') ||
      lowerDesc.includes('maison')
    ) {
      industry = 'Real Estate';
    } else if (
      lowerDesc.includes('beauté') ||
      lowerDesc.includes('beauty') ||
      lowerDesc.includes('cosmét') ||
      lowerDesc.includes('cosmet') ||
      lowerDesc.includes('salon') ||
      lowerDesc.includes('coiffure')
    ) {
      industry = 'Beauty & Cosmetics';
    } else if (
      lowerDesc.includes('construct') ||
      lowerDesc.includes('bâtiment') ||
      lowerDesc.includes('btp') ||
      lowerDesc.includes('architect') ||
      lowerDesc.includes('building')
    ) {
      industry = 'Construction';
    } else if (
      lowerDesc.includes('e-commerce') ||
      lowerDesc.includes('boutique') ||
      lowerDesc.includes('shop') ||
      lowerDesc.includes('magasin') ||
      lowerDesc.includes('retail') ||
      lowerDesc.includes('vente')
    ) {
      industry = 'Retail & E-commerce';
    } else if (
      lowerDesc.includes('eco') ||
      lowerDesc.includes('green') ||
      lowerDesc.includes('sustainable') ||
      lowerDesc.includes('durable') ||
      lowerDesc.includes('écolog')
    ) {
      industry = 'Sustainability';
    }

    // Extraire les valeurs
    const values: string[] = [];
    if (lowerDesc.includes('innovation') || lowerDesc.includes('innovative'))
      values.push('Innovation');
    if (lowerDesc.includes('trust') || lowerDesc.includes('reliable')) values.push('Trust');
    if (lowerDesc.includes('quality') || lowerDesc.includes('premium')) values.push('Quality');
    if (lowerDesc.includes('speed') || lowerDesc.includes('fast') || lowerDesc.includes('quick'))
      values.push('Speed');
    if (
      lowerDesc.includes('simple') ||
      lowerDesc.includes('easy') ||
      lowerDesc.includes('intuitive')
    )
      values.push('Simplicity');
    if (lowerDesc.includes('creative') || lowerDesc.includes('artistic')) values.push('Creativity');
    if (lowerDesc.includes('professional') || lowerDesc.includes('business'))
      values.push('Professionalism');
    if (lowerDesc.includes('fun') || lowerDesc.includes('playful') || lowerDesc.includes('joy'))
      values.push('Playfulness');

    // Audience cible
    let targetAudience = 'General Public';
    if (
      lowerDesc.includes('young') ||
      lowerDesc.includes('youth') ||
      lowerDesc.includes('millennial')
    ) {
      targetAudience = 'Young Adults (18-35)';
    } else if (
      lowerDesc.includes('professional') ||
      lowerDesc.includes('business') ||
      lowerDesc.includes('corporate')
    ) {
      targetAudience = 'Business Professionals';
    } else if (
      lowerDesc.includes('luxury') ||
      lowerDesc.includes('premium') ||
      lowerDesc.includes('high-end')
    ) {
      targetAudience = 'Luxury Market';
    } else if (lowerDesc.includes('family') || lowerDesc.includes('parent')) {
      targetAudience = 'Families';
    }

    // Point de différenciation
    const uniqueSellingPoint = projectDescription.substring(0, 200);

    return { industry, values, targetAudience, uniqueSellingPoint };
  }

  /**
   * Sélectionne le prompt approprié en fonction du type de logo choisi par l'utilisateur
   */
  private selectLogoPromptByType(logoType?: 'icon' | 'name' | 'initial'): string {
    switch (logoType) {
      case 'icon':
        logger.info('Using ICON-BASED logo prompt');
        return LOGO_GENERATION_ICON_TYPE_PROMPT;
      case 'name':
        logger.info('Using NAME-BASED logo prompt');
        return LOGO_GENERATION_NAME_TYPE_PROMPT;
      case 'initial':
        logger.info('Using INITIAL-BASED logo prompt');
        return LOGO_GENERATION_INITIAL_TYPE_PROMPT;
      default:
        logger.info('Using default NAME-BASED logo prompt (no type specified)');
        return LOGO_GENERATION_NAME_TYPE_PROMPT;
    }
  }

  /**
   * Construction du prompt optimisé pour la génération de logos avec préférences utilisateur
   */
  private buildOptimizedLogoPrompt(
    projectDescription: string,
    colors: ColorModel,
    typography: TypographyModel,
    preferences?: LogoPreferences
  ): string {
    // Extraire le contexte du projet
    const projectContext = this.extractProjectContext(projectDescription);
    const projectName = this.extractProjectName(projectDescription);
    const projectInitials = this.generateInitials(projectName);

    // Construire un contexte riche pour guider la génération
    let contextPrompt = `**PROJECT CONTEXT - USE THIS TO INSPIRE YOUR DESIGN:**\n`;
    contextPrompt += `- Project Name: "${projectName}"\n`;
    contextPrompt += `- Industry: ${projectContext.industry}\n`;
    contextPrompt += `- Core Values: ${
      projectContext.values.length > 0
        ? projectContext.values.join(', ')
        : 'Innovation, Quality, Trust'
    }\n`;
    contextPrompt += `- Target Audience: ${projectContext.targetAudience}\n`;
    contextPrompt += `- Project Description: ${projectContext.uniqueSellingPoint}\n`;

    // Informations de design
    const colorInfo = `Primary: ${
      colors.colors?.primary || 'N/A'
    }, Secondary: ${colors.colors?.secondary || 'N/A'}`;
    const fontInfo = `Primary: ${typography.primaryFont || 'N/A'}, Secondary: ${
      typography.secondaryFont || 'N/A'
    }`;
    contextPrompt += `\n**DESIGN PALETTE:**\n`;
    contextPrompt += `- Colors: ${colorInfo}\n`;
    contextPrompt += `- Typography: ${fontInfo}\n`;

    // Ajouter les préférences utilisateur au contexte avec instructions détaillées
    let preferenceContext = '';
    if (preferences) {
      const typeDescriptions = {
        icon: 'Icon Based - Create a memorable icon/symbol + full brand name (like Apple, Nike, Twitter)',
        name: 'Name Based - Typography IS the logo, NO separate icon (like Coca-Cola, Google, FedEx)',
        initial: 'Initial Based - Stylized initials as main element (like IBM, HP, CNN)',
      };

      preferenceContext = `\n**USER PREFERENCES:**\n- Logo Type: ${
        preferences.type
      } - ${typeDescriptions[preferences.type]}\n`;

      if (preferences.type === 'initial') {
        preferenceContext += `- Initials to use: "${projectInitials}" (from "${projectName}")\n`;
      }

      if (preferences.customDescription) {
        preferenceContext += `- Custom Design Requirements: ${preferences.customDescription}\n`;
      }

      preferenceContext += `\n**DESIGN DIRECTION FOR ${preferences.type.toUpperCase()} TYPE:**\n`;
      preferenceContext += `Based on the project context (${
        projectContext.industry
      }, values: ${projectContext.values.join(', ')}), create a logo that:\n`;

      switch (preferences.type) {
        case 'icon':
          preferenceContext += `- Creates an icon that visually represents the ${projectContext.industry} industry\n`;
          preferenceContext += `- Embodies the values: ${projectContext.values.join(', ')}\n`;
          preferenceContext += `- Appeals to ${projectContext.targetAudience}\n`;
          preferenceContext += `- Includes the FULL brand name "${projectName}" as text\n`;
          preferenceContext += `- Makes the icon memorable and instantly recognizable\n`;
          break;
        case 'name':
          preferenceContext += `- Uses ONLY the brand name "${projectName}" with typography that reflects ${projectContext.industry}\n`;
          preferenceContext += `- Conveys ${projectContext.values.join(
            ' and '
          )} through font styling\n`;
          preferenceContext += `- Resonates with ${projectContext.targetAudience}\n`;
          preferenceContext += `- NO separate icon - typography IS the complete logo\n`;
          preferenceContext += `- Creates visual impact through creative letterforms\n`;
          break;
        case 'initial':
          preferenceContext += `- Uses ONLY the initials "${projectInitials}" in a way that suggests ${projectContext.industry}\n`;
          preferenceContext += `- Stylizes the letters to communicate ${projectContext.values.join(
            ' and '
          )}\n`;
          preferenceContext += `- Creates appeal for ${projectContext.targetAudience}\n`;
          preferenceContext += `- NO full brand name - initials ARE the complete logo\n`;
          preferenceContext += `- Makes the initials iconic and sophisticated\n`;
          break;
      }

      preferenceContext += `\n**IMPORTANT:** Let the project's industry, values, and target audience guide your creative decisions. The logo should tell the brand's story visually.\n`;
    }

    // Sélectionner le prompt approprié en fonction du type de logo
    const selectedPrompt = this.selectLogoPromptByType(preferences?.type);

    return `${contextPrompt}${preferenceContext}\n\n${selectedPrompt}`;
  }

  async generateBrandingWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>,
    pdfFormat: string = 'SLIDE_16_9',
    forceRegenerate = false,
    targetSections: string[] = []
  ): Promise<ProjectModel | null> {
    logger.info(
      `Generating branding with streaming for userId: ${userId}, projectId: ${projectId}, pdfFormat: ${pdfFormat}, force: ${forceRegenerate}, targetSections: [${targetSections.join(', ')}]`
    );

    setAiUsageContext({
      userId,
      projectId,
      feature: 'branding',
      element: 'sections',
      operation: forceRegenerate ? 'regenerate' : 'generate',
    });

    // Get project
    const project = await this.getProject(projectId, userId);
    if (!project) {
      return null;
    }

    // Make sure the logo has hosted PNG URLs before we build any prompt — else
    // the fallback would inject a giant SVG data-URI that the LLM turns into a
    // broken link (e.g. "https://brand-logo.svg"). Persists them for reuse.
    await this.ensureLogoAssetUrls(userId, projectId, project);

    // La charte doit RESPECTER la direction artistique, donc celle-ci doit
    // exister avant la première page. Décidée ici, elle est ensuite relue par
    // tous les autres modules (visuels, business plan, deck, mockups, site) :
    // c'est le point unique où le parti pris visuel du projet est arbitré.
    const artDirection = await this.ensureArtDirection(userId, projectId, project);
    const artDirectionBlock = buildArtDirectionBlock(artDirection, { medium: 'document' });

    // Graine de composition DÉTERMINISTE, dérivée du projet : deux projets
    // n'obtiennent pas la même charte, mais une charte régénérée garde sa mise
    // en page. Le tirage est borné par le style retenu (cf. designSeed.ts), donc
    // il ne peut pas contredire la direction artistique.
    const brandSeed = buildDocumentSeed(artDirection?.styleId, `branding:${projectId}`);
    const designDirectives = [
      artDirectionBlock,
      `<composition_invariants>\n${describeDocumentSeed(brandSeed)}\n</composition_invariants>`,
      ANTI_SLOP_BLOCK,
      // Deux pathologies distinctes : l'anti-slop retire les tics du corpus,
      // la retenue éditoriale retire ce qui ne sert à rien. Une page peut être
      // parfaitement originale et rester illisible parce qu'elle est saturée
      // d'ornements et de phrases creuses.
      EDITORIAL_RESTRAINT_BLOCK,
      SELF_REVIEW_BLOCK,
      RESTRAINT_SELF_REVIEW_BLOCK,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Generate cache key based on project content
    const branding = project.analysisResultModel?.branding;
    // Description BRUTE du projet, avant l'empilement des directives de charte.
    // La génération d'images la reprend telle quelle : les consignes HTML,
    // la graine de composition et les interdits anti-slop ne la concernent pas.
    const baseProjectDescription = this.extractProjectDescription(project);
    const projectDescription =
      baseProjectDescription +
      '\n\nHere is the project branding colors: ' +
      JSON.stringify(branding?.colors || {}) +
      '\n\nHere is the project branding typography: ' +
      JSON.stringify(branding?.typography || {}) +
      // Token-lean: send the hosted logo URLs (use them as <img src>), never the
      // raw SVG markup — an SVG runs thousands of tokens and this is appended to
      // every brand-book step.
      '\n\nHere is the project branding logo (hosted asset URLs — use as <img src>): ' +
      JSON.stringify(summarizeLogoForPrompt(branding?.logo)) +
      // La direction artistique et les interdits anti-génériques accompagnent
      // CHAQUE page : une charte dont seule la couverture respecte le parti pris
      // n'est pas une charte.
      (designDirectives ? `\n\n${designDirectives}` : '');

    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: project.name,
          description: project.longDescription || project.description,
          branding: project.analysisResultModel?.branding,
          // Sans la graine et le style, une régénération après changement de
          // direction artistique resservait la charte précédente depuis le cache.
          artDirection: artDirection?.styleId,
          brandSeed,
          projectDescription,
        })
      )
      .digest('hex')
      .substring(0, 16);

    const cacheKey = cacheService.generateAIKey('branding', userId, projectId, contentHash);

    // The cached result may be an incomplete brand guide (it is updated after each
    // step), so only short-circuit on it when nothing needs to be (re)generated.
    // 8 pages historiques + la page « Direction Artistique » + les mockups.
    const expectedSectionCount = 9 + MOCKUP_CONFIG.MOCKUP_COUNT;
    const currentSections = project.analysisResultModel?.branding?.sections || [];
    const skipCacheRead =
      forceRegenerate ||
      targetSections.length > 0 ||
      currentSections.length < expectedSectionCount;

    if (!skipCacheRead) {
      const cachedResult = await cacheService.get<ProjectModel>(cacheKey, {
        prefix: 'ai',
        ttl: 7200, // 2 hours
      });

      if (cachedResult) {
        logger.info(`Branding cache hit for projectId: ${projectId}`);
        return cachedResult;
      }
    }

    logger.info(`Branding cache miss, generating new content for projectId: ${projectId}`);

    try {
      const branding = project.analysisResultModel?.branding;
      const logo = branding?.logo;
      const logoVariations = logo?.variations;
      const assetUrls = logo?.assetUrls;

      // Turn a logo field into a valid <img src>: pass URLs/data-URIs through,
      // wrap inline SVG markup into a data-URI. Prefer the hosted PNG URLs
      // (assetUrls); fall back to the inline SVG variations for legacy projects.
      const toImgSrc = (val?: string): string => {
        const trimmed = (val || '').trim();
        if (!trimmed) return '';
        if (
          trimmed.startsWith('http://') ||
          trimmed.startsWith('https://') ||
          trimmed.startsWith('data:')
        ) {
          return trimmed;
        }
        if (trimmed.includes('<svg')) {
          return `data:image/svg+xml;base64,${Buffer.from(trimmed).toString('base64')}`;
        }
        return trimmed;
      };

      const logoUrl = toImgSrc(assetUrls?.primary || logo?.svg);
      const lightLogoUrl =
        toImgSrc(assetUrls?.withText?.lightBackground || logoVariations?.withText?.lightBackground) ||
        logoUrl;
      const darkLogoUrl =
        toImgSrc(assetUrls?.withText?.darkBackground || logoVariations?.withText?.darkBackground) ||
        logoUrl;
      const monochromeLogoUrl =
        toImgSrc(assetUrls?.withText?.monochrome || logoVariations?.withText?.monochrome) ||
        logoUrl;

      // Define branding steps
      const steps: IPromptStep[] = [
        {
          // La couverture réclame désormais le logo : sans une URL nommée pour
          // CETTE page, le modèle ne le pose pas — la table d'URLs du contexte
          // se lit comme de la documentation, pas comme une consigne.
          promptConstant:
            BRAND_HEADER_SECTION_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the brand logo image: "${lightLogoUrl}" (dark ink, for a light zone) or "${darkLogoUrl}" (light ink, for a dark zone). Pick the one that contrasts with the zone you place it on.\n\n`,
          stepName: 'Brand Header',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_SYSTEM_SECTION_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the primary logo image: "${logoUrl}"\n\n`,
          stepName: 'Logo Principal',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the logo variation image: "${lightLogoUrl}"\n\n` +
            '\nVariation type: Light Background\nDisplay the logo variation for light backgrounds. Use a white or very light background.\n\n',
          stepName: 'Logo Variation Fond Clair',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the logo variation image: "${darkLogoUrl}"\n\n` +
            "\nVariation type: Dark Background\nDisplay the logo variation for dark backgrounds. Use the brand's dark color or a rich dark tone as the full-page background.\n\n",
          stepName: 'Logo Variation Fond Sombre',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the logo variation image: "${monochromeLogoUrl}"\n\n` +
            '\nVariation type: Monochrome\nDisplay the monochrome logo variation on a neutral gray background.\n\n',
          stepName: 'Logo Variation Monochrome',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_BEST_PRACTICES_PAGE_PROMPT +
            `\n\n**SPECIFIC LOGO URL FOR THIS PAGE:**\nUse this URL for the logo image in visual examples: "${logoUrl}"\n\n`,
          stepName: 'Logo Bonnes Pratiques',
          hasDependencies: false,
        },
        {
          promptConstant: COLOR_PALETTE_SECTION_PROMPT,
          stepName: 'Color Palette',
          hasDependencies: false,
        },
        {
          promptConstant: TYPOGRAPHY_SECTION_PROMPT,
          stepName: 'Typography',
          hasDependencies: false,
        },
        // Placée après les ATOMES (logo, couleur, typographie) parce que son
        // objet est la grammaire qui les assemble, et avant les mockups, qui en
        // sont la première application.
        {
          promptConstant: ART_DIRECTION_SECTION_PROMPT,
          stepName: 'Direction Artistique',
          hasDependencies: false,
        },
      ];

      // Mises en situation. Ces pages ne sont pas RÉDIGÉES : elles portent une
      // photographie du support, produite par le modèle d'image puis marquée du
      // vrai logo. Les faire passer par le LLM revenait à payer une page HTML
      // complète par mockup pour la jeter aussitôt — et, quand l'image
      // manquait, à publier cette page de secours à la place du mockup. Elles
      // sont donc fabriquées (`execute`), et absentes quand l'image manque.
      const mockupCount = MOCKUP_CONFIG.MOCKUP_COUNT;
      const buildMockupPage = this.createMockupPageBuilder({
        project,
        userId,
        projectId,
        projectDescription: baseProjectDescription,
        pdfFormat,
        artDirection,
      });
      for (let i = 1; i <= mockupCount; i++) {
        steps.push({
          promptConstant: '',
          stepName: `Brand Mockup ${i}`,
          hasDependencies: false,
          execute: () => buildMockupPage(i),
        });
      }

      // Adapter les prompts au FORMAT DE PAGE CHOISI (les prompts sont écrits en
      // 16:9 par défaut). No-op si le format choisi est déjà SLIDE_16_9.
      const chosenFormat =
        PAGE_FORMATS[pdfFormat as keyof typeof PAGE_FORMATS] || PAGE_FORMATS.SLIDE_16_9;
      for (const step of steps) {
        step.promptConstant = this.applyPageFormatToPrompt(step.promptConstant, chosenFormat);
      }

      // Un archétype de composition PAR PAGE, tiré sans répétition dans l'espace
      // du style. Douze pages qui partagent leur archétype sont douze fois la
      // même page — or c'est précisément le reproche fait à la charte avant que
      // la graine n'existe. Les invariants (couleur, typographie, rythme,
      // accent) restent, eux, dans le préfixe stable.
      //
      // Les pages FABRIQUÉES (mockups, `execute`) sont exclues : elles ne
      // passent pas par le modèle, leur donner une graine n'aurait aucun effet.
      const usedArchetypes = new Set<string>();
      for (const step of steps) {
        if (step.execute) continue;
        const seed = buildSectionSeed(
          artDirection?.styleId,
          `branding:${projectId}`,
          step.stepName,
          usedArchetypes
        );
        step.promptConstant += `\n\n<composition_for_this_page>\n${describeSectionSeed(seed)}\n</composition_for_this_page>`;
      }

      logger.info(`[BRANDING] Generated ${mockupCount} mockup steps dynamically`, {
        projectId,
        mockupCount,
        totalSteps: steps.length,
      });

      // Optionnel : footer
      // steps.push({
      //   promptConstant: BRAND_FOOTER_SECTION_PROMPT + projectDescription,
      //   stepName: 'Brand Footer',
      //   hasDependencies: false,
      // });

      // Load existing sections if not forcing regeneration.
      // Sections listed in targetSections are dropped so they get regenerated,
      // while the others are kept as-is (resume semantics).
      const existingSections = forceRegenerate
        ? []
        : targetSections.length > 0
          ? currentSections.filter((s) => !targetSections.includes(s.name))
          : currentSections;

      // Initialize sections array to collect results
      let sections: SectionModel[] = [...existingSections];

      // Chaque section de la charte reçoit ses propres réglages
      // (voir AI_CONFIG.branding.brandIdentity.sections).
      // PRÉFIXE STABLE — la description du projet ET toutes les directives de
      // charte (direction artistique, invariants de composition, anti-slop,
      // retenue éditoriale) étaient concaténées à la FIN de chacune des douze
      // pages. Émises une fois en tête, elles deviennent le seul début de prompt
      // identique d'une page à l'autre, donc le seul candidat au cache.
      const configuredSteps = withSectionConfigs(
        AI_CONFIG.branding.brandIdentity,
        steps,
        projectDescription
      );

      // Process steps one by one with streaming if callback provided
      if (streamCallback) {
        await this.processStepsWithStreaming(
          configuredSteps,
          project,
          async (result: ISectionResult) => {
            logger.info(`Received streamed result for step: ${result.name}`);

            // Skip progress and completion events - handle only actual step results
            if (result.data === 'steps_in_progress' || result.data === 'all_steps_completed') {
              await streamCallback(result);
              return;
            }

            // Préparer la section finale
            let finalSection: SectionModel;

            // Les pages de mise en situation portent une photographie, pas de
            // la prose : leur HTML est fabriqué ici (cf. `createMockupPageBuilder`)
            // et n'a rien à faire passer au linter anti-générique.
            if (result.name.startsWith('Brand Mockup')) {
              finalSection = {
                name: result.name,
                type: result.type,
                data: result.data,
                summary: result.summary,
              };
            } else {
              // Passe déterministe anti-générique sur le HTML produit.
              //
              // Le prompt demande déjà de ne pas sortir de la charte ; sur une
              // douzaine de pages, il en reste toujours. Les fautes MÉCANIQUES
              // (couleur hors palette, police écrite en dur, titre en dégradé,
              // image sans alt) ont une bonne réponse unique : on les corrige
              // ici sans dépenser un token. Ce qui relève du goût est seulement
              // journalisé — le linter ne recompose jamais une page.
              const rawHtml = typeof result.data === 'string' ? result.data : '';
              let cleanedHtml = rawHtml;
              if (rawHtml) {
                const lintOptions = {
                  palette: branding?.colors?.colors,
                  fonts: [
                    branding?.typography?.primaryFont,
                    branding?.typography?.secondaryFont,
                  ].filter((f): f is string => !!f),
                  // Le contrôle de présence du logo ne vaut QUE pour les pages
                  // censées en porter un. L'appliquer à la page palette ou à la
                  // page typographie produirait une alerte à chaque génération,
                  // et un linter qui crie tout le temps est un linter qu'on
                  // n'écoute plus.
                  expectedLogoUrls: /^(Brand Header|Logo )/.test(result.name)
                    ? [logoUrl, lightLogoUrl, darkLogoUrl, monochromeLogoUrl].filter(Boolean)
                    : [],
                  styleId: artDirection?.styleId,
                  label: `charte/${result.name}`,
                };
                cleanedHtml = enforceDesignRules(rawHtml, lintOptions).html;
              }

              finalSection = {
                name: result.name,
                type: result.type,
                data: cleanedHtml || result.data,
                summary: result.summary,
              };
            }

            // Add or replace in sections array to avoid duplicates
            const existingIndex = sections.findIndex((s) => s.name === finalSection.name);
            if (existingIndex !== -1) {
              sections[existingIndex] = finalSection;
            } else {
              sections.push(finalSection);
            }

            // Sort sections to match original step order
            const stepOrder = steps.map((s) => s.stepName);
            sections.sort((a, b) => stepOrder.indexOf(a.name) - stepOrder.indexOf(b.name));

            // Prepare the updated project data
            const currentBranding = project.analysisResultModel?.branding;
            const updatedProjectData = {
              ...project,
              analysisResultModel: {
                ...project.analysisResultModel,
                branding: {
                  // On repart de l'objet existant : cette écriture est faite à
                  // CHAQUE section, et reconstruire la marque champ par champ
                  // effaçait tout ce qui n'était pas listé — les préférences de
                  // logo, puis la direction artistique.
                  ...currentBranding,
                  sections: sections,
                  colors: currentBranding?.colors,
                  typography: currentBranding?.typography,
                  logo: currentBranding?.logo,
                  generatedLogos: currentBranding?.generatedLogos || [],
                  generatedColors: currentBranding?.generatedColors || [],
                  generatedTypography: currentBranding?.generatedTypography || [],
                  pdfFormat: pdfFormat, // Stocker le format PDF choisi
                  createdAt: currentBranding?.createdAt || new Date(),
                  updatedAt: new Date(),
                },
              },
            };

            // Update the project in the database
            const updatedProject = await this.projectRepository.update(
              projectId,
              updatedProjectData,
              `users/${userId}/projects`
            );

            if (updatedProject) {
              logger.info(
                `Successfully updated project with step: ${result.name} - projectId: ${projectId}`
              );

              // Update cache with latest project state
              await cacheService.set(cacheKey, updatedProject, {
                prefix: 'ai',
                ttl: 7200, // 2 hours
              });
              logger.info(`Branding cached after step: ${result.name} - projectId: ${projectId}`);

              // Envoyer le résultat FINAL (avec URLs injectées) au frontend
              const finalResult: ISectionResult = {
                name: finalSection.name,
                type: finalSection.type,
                data: finalSection.data,
                summary: finalSection.summary || '',
              };
              await streamCallback(finalResult);
            } else {
              logger.error(
                `Failed to update project after step: ${result.name} - projectId: ${projectId}`
              );
              throw new Error(`Failed to update project after step: ${result.name}`);
            }
          },
          {
            provider: AI_CONFIG.branding.brandIdentity.provider,
            modelName: AI_CONFIG.branding.brandIdentity.modelName,
            // Étaient omis : la charte partait sans budget de tokens ni repli,
            // alors que ai.config.ts en déclare pour cette feature.
            llmOptions: AI_CONFIG.branding.brandIdentity.llmOptions,
            fallbackModels: AI_CONFIG.branding.brandIdentity.fallbackModels,
            userId,
          }, // promptConfig
          'branding', // promptType
          userId,
          undefined, // finalizationCallback
          existingSections
        );

        // The stored PDF no longer matches the regenerated sections
        const pdfCacheKey = cacheService.generateAIKey('branding-pdf', userId, projectId);
        await cacheService.delete(pdfCacheKey, { prefix: 'pdf' });

        // Return the updated project (it should be available in cache or fetch it again)
        const finalProject = await this.projectRepository.findById(
          projectId,
          `users/${userId}/projects`
        );
        return finalProject;
      } else {
        // If no streaming callback, process without streaming
        logger.info('Processing branding without streaming');
        // TODO: Implement non-streaming version if needed
        return project;
      }
    } catch (error) {
      logger.error(`Error generating branding for projectId ${projectId}:`, error);
      throw error;
    } finally {
      logger.info(`Completed branding generation for projectId ${projectId}`);
    }
  }

  /**
   * Génère un seul ensemble de couleurs - Méthode privée pour génération parallèle
   */
  private async generateSingleColors(
    projectDescription: string,
    project: ProjectModel
  ): Promise<ColorModel[]> {
    logger.info(`Generating colors`);

    // Affine l'élément dans le lot ouvert par generateColorsAndTypography, pour
    // que le panel admin distingue le coût des palettes de celui des typos.
    setAiUsageContext({ feature: 'branding', element: 'colors' });

    const steps: IPromptStep[] = [
      {
        promptConstant:
          COLORS_GENERATION_PROMPT.replace('{{PROJECT_DESCRIPTION}}', projectDescription) +
          // La région chromatique est tirée par le CODE, pas laissée à
          // l'échantillonnage : c'est ce qui empêche deux marques d'un même
          // secteur de recevoir la même palette, y compris sur un petit modèle.
          `\n\n${describePaletteConstraint(buildPaletteConstraint(project.id!))}`,
        stepName: 'Colors Generation',
        modelParser: (content) => {
          // Use safeParseJson to handle markdown fences, truncated JSON,
          // and raw newlines that cause naive JSON.parse to fail.
          const parsed = safeParseJson(content);
          if (!parsed) {
            throw new Error('safeParseJson returned null – empty or unparseable content');
          }
          const colors = parsed.colors ?? parsed;
          if (!Array.isArray(colors)) {
            throw new Error(
              `Expected colors array but got ${typeof colors}: ${JSON.stringify(colors).slice(0, 200)}`
            );
          }
          return colors;
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.COLORS_LLM_CONFIG
    );
    const colorsResult: ISectionResult = sectionResults[0];

    logger.info(`Colors generated successfully`);
    return colorsResult.parsedData as ColorModel[];
  }

  /**
   * Génère un seul ensemble de typographies - Méthode privée pour génération parallèle
   */
  private async generateSingleTypography(
    projectDescription: string,
    project: ProjectModel
  ): Promise<TypographyModel[]> {
    logger.info(`Generating typography`);

    setAiUsageContext({ feature: 'branding', element: 'typography' });

    const steps: IPromptStep[] = [
      {
        promptConstant:
          projectDescription +
          TYPOGRAPHY_GENERATION_PROMPT +
          `\n\n${buildTypographyConstraint(project.id!)}`,
        stepName: 'Typography Generation',
        modelParser: (content) => {
          const parsed = safeParseJson(content);
          if (!parsed) {
            throw new Error('safeParseJson returned null – empty or unparseable content');
          }
          const typography = parsed.typography ?? parsed;
          if (!Array.isArray(typography)) {
            throw new Error(
              `Expected typography array but got ${typeof typography}: ${JSON.stringify(typography).slice(0, 200)}`
            );
          }
          return typography;
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.TYPOGRAPHY_LLM_CONFIG
    );
    const typographyResult = sectionResults[0];

    logger.info(`Typography generated successfully`);
    return typographyResult.parsedData as TypographyModel[];
  }

  async generateColorsAndTypography(
    userId: string,
    project: ProjectModel
  ): Promise<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }> {
    logger.info(`Generating colors and typography in parallel for userId: ${userId}`);

    // Palettes et couples typographiques sont eux aussi proposés en plusieurs
    // exemplaires parmi lesquels l'utilisateur choisit : même traitement en lot
    // que les logos. Les deux sous-appels affinent ensuite `element`.
    openAiUsageBatch({
      userId,
      projectId: project.id,
      feature: 'branding',
      element: 'colorsAndTypography',
    });

    // Réutiliser le projet existant (workflow complete-branding) au lieu de créer
    // un doublon — voir generateColorsAndTypographyFromLogo.
    const existingProject = project.id
      ? await this.projectRepository.findById(project.id, `users/${userId}/projects`)
      : null;

    let createdProject: ProjectModel;
    if (existingProject) {
      logger.info(
        `Reusing existing project for colors/typography generation - ProjectId: ${existingProject.id}`
      );
      createdProject = {
        ...existingProject,
        analysisResultModel: {
          ...existingProject.analysisResultModel,
          branding: existingProject.analysisResultModel?.branding || BrandIdentityBuilder.createEmpty(),
        },
      };
    } else {
      project = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: BrandIdentityBuilder.createEmpty(),
        },
      };
      createdProject = await projectService.createUserProject(userId, project);
    }

    if (!createdProject.id) {
      throw new Error(`Failed to create project`);
    }

    // Rasterize + upload the selected logo's PNG assets now, at selection time,
    // so every downstream consumer (brand book, pitch deck, business plan,
    // communication, dashboard) references hosted URLs instead of inline SVG.
    // persist=false: the project update below already writes the mutated logo.
    await this.ensureLogoAssetUrls(userId, createdProject.id, createdProject, false);

    // Stocker le projet en cache
    try {
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, createdProject, {
        prefix: 'project',
        ttl: 3600, // 1 heure
      });
      logger.info(`Project cached with ID: ${createdProject.id} for userId: ${userId}`);
    } catch (error) {
      logger.error(`Error caching project for userId: ${userId}`, error);
      // Continue without failing - cache is not critical
    }

    const projectDescription = this.extractProjectDescription(project);

    // Génération parallèle des couleurs et typographies
    const startTime = Date.now();

    // Créer 2 promesses pour générer couleurs et typographies en parallèle
    const [colors, typography] = await Promise.all([
      this.generateSingleColors(projectDescription, createdProject),
      this.generateSingleTypography(projectDescription, createdProject),
    ]);

    const generationTime = Date.now() - startTime;
    logger.info(`Parallel colors and typography generation completed in ${generationTime}ms`);

    // Mettre à jour le projet avec les couleurs et typographies générées
    const updatedProjectData = {
      ...createdProject,
      analysisResultModel: {
        ...createdProject.analysisResultModel,
        branding: {
          ...createdProject.analysisResultModel?.branding,
          generatedColors: colors,
          generatedTypography: typography,
          updatedAt: new Date(),
        },
      },
    };

    // Mise à jour en base de données
    const updatedProject = await this.projectRepository.update(
      createdProject.id!,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with colors and typography - ProjectId: ${createdProject.id}`
      );

      // Mise à jour du cache projet
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: 'project',
        ttl: 3600,
      });

      logger.info(
        `Project cache updated with colors and typography - ProjectId: ${createdProject.id}`
      );
    }

    return {
      colors,
      typography,
      project: updatedProject || createdProject,
    };
  }

  /**
   * Generate single logo concept using direct SVG generation
   * AI generates complete SVG content directly for professional results
   */
  /**
   * Génération AI pure sans optimisation SVG (pour parallélisation maximale)
   */
  private async generateRawLogoConcept(
    optimizedPrompt: string,
    project: ProjectModel,
    conceptIndex: number,
    preferences?: LogoPreferences,
    skipQuotaCheck = false,
    modelNameOverride?: string
  ): Promise<LogoModel> {
    logger.info(
      `Generating raw logo concept ${
        conceptIndex + 1
      } with direct SVG generation - Type: ${preferences?.type || 'name'}`
    );

    // AI generation avec prompt pré-optimisé
    const steps: IPromptStep[] = [
      {
        promptConstant: optimizedPrompt,
        stepName: `Logo Concept ${conceptIndex + 1}`,
        maxOutputTokens: 3500,
        modelParser: (content) => {
          // Robust parse: repairs malformed LLM JSON (raw newlines in the SVG,
          // fences, trailing commas) and salvages the raw SVG if needed.
          const logoData = this.parseLogoModelResponse(content);

          if (!logoData || typeof logoData.svg !== 'string' || !logoData.svg.includes('<svg')) {
            logger.error(
              `Error parsing logo data concept ${conceptIndex + 1}: no usable SVG in response`
            );
            throw new Error(`Failed to parse logo data concept ${conceptIndex + 1}`);
          }

          // Ensure unique ID for each concept
          if (!logoData.id) {
            logoData.id = `concept${String(conceptIndex + 1).padStart(2, '0')}`;
          }

          return logoData;
        },
        hasDependencies: false,
      },
    ];

    const config = {
      ...BrandingService.LOGO_LLM_CONFIG,
      skipQuotaCheck,
    };
    if (modelNameOverride) {
      config.modelName = modelNameOverride;
    }

    const sectionResults = await this.processSteps(
      steps,
      project,
      config
    );
    const logoResult = sectionResults[0];
    const logoData = logoResult.parsedData;

    const branding = project.analysisResultModel?.branding;
    // Le nom affiché est celui de la marque, jamais le titre créatif du concept.
    const brandName = this.resolveBrandName(project);
    const artwork = await this.finalizeLogoArtwork(
      logoData,
      branding?.typography,
      preferences?.type,
      brandName
    );

    // Créer LogoModel RAW (sans optimisation SVG)
    const logoModel: LogoModel = {
      id: `concept${String(conceptIndex + 1).padStart(2, '0')}`,
      name: logoData.name || `Logo Concept ${conceptIndex + 1}`,
      concept: logoData.concept || 'Professional logo design',
      colors: logoData.colors || [],
      fonts: artwork.lockup ? [artwork.lockup.fontFamily] : logoData.fonts || [],
      svg: artwork.svg,
      iconSvg: artwork.iconSvg ?? this.extractIconFromSvg(artwork.svg),
      type: preferences?.type,
      customDescription: preferences?.customDescription,
      ...(artwork.lockup ? { lockup: artwork.lockup } : {}),
    };

    logger.info(`Raw logo concept ${conceptIndex + 1} generated successfully`);
    return logoModel;
  }

  /**
   * Mise à jour asynchrone du projet avec les logos (pour parallélisation)
   */
  private async updateProjectWithLogosAsync(
    userId: string,
    projectId: string,
    project: ProjectModel,
    selectedColors: ColorModel,
    selectedTypography: TypographyModel,
    logos: LogoModel[]
  ): Promise<void> {
    try {
      // Préparer les données de mise à jour
      const updatedProjectData = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: {
            ...project.analysisResultModel?.branding,
            colors: selectedColors,
            typography: selectedTypography,
            generatedLogos: logos,
            updatedAt: new Date(),
          },
        },
      };

      // Paralléliser DB update et cache update
      const [updatedProject, _] = await Promise.allSettled([
        this.projectRepository.update(projectId, updatedProjectData, `users/${userId}/projects`),
        // Pré-calculer la clé de cache
        Promise.resolve(`project_${userId}_${projectId}`),
      ]);

      if (updatedProject.status === 'fulfilled' && updatedProject.value) {
        logger.info(
          `Successfully updated project with logos - ProjectId: ${projectId}, LogoCount: ${logos.length}`
        );

        // Mise à jour du cache en arrière-plan (non-bloquant)
        const projectCacheKey = `project_${userId}_${projectId}`;
        cacheService
          .set(projectCacheKey, updatedProject.value, {
            prefix: 'project',
            ttl: 3600,
          })
          .catch((error) => {
            logger.error(`Cache update failed for project ${projectId}:`, error);
          });

        logger.info(`Project cache update initiated - ProjectId: ${projectId}`);
      } else {
        logger.error(
          `Failed to update project ${projectId}:`,
          updatedProject.status === 'rejected' ? updatedProject.reason : 'Unknown error'
        );
      }
    } catch (error) {
      logger.error(`Error in updateProjectWithLogosAsync for project ${projectId}:`, error);
      // Ne pas faire échouer le processus principal
    }
  }

  // --------------------------------------------------------------------------
  // Direction artistique
  //
  // Décidée UNE fois par marque, puis imposée à toutes les générations. Le
  // module vivait sans : chaque prompt (charte, visuel, deck, plan, site)
  // improvisait un parti pris, et deux livrables du même projet n'avaient
  // aucune parenté visuelle. Ce n'est pas un problème de qualité de prompt mais
  // d'absence d'arbitrage partagé — c'est ce que cette section apporte.
  // --------------------------------------------------------------------------

  /**
   * Ramène une sortie de modèle à un {@link ArtDirectionModel} exploitable.
   *
   * Le champ qui compte vraiment est `styleId` : tout le reste (fiche de style,
   * espace de tirage de la graine, prompt négatif des images) en dépend. Un
   * identifiant inventé par le modèle casserait la chaîne en silence, donc on
   * le valide contre le catalogue et on retombe sur un style plausible plutôt
   * que de laisser passer une valeur inconnue.
   */
  private normalizeArtDirection(raw: any, fallbackStyleId: ArtDirectionStyleId = 'editorial'): ArtDirectionModel {
    const requested = String(raw?.styleId || '').trim().toLowerCase();
    const styleId = (ART_DIRECTION_STYLE_IDS as string[]).includes(requested)
      ? (requested as ArtDirectionStyleId)
      : fallbackStyleId;
    const style = ART_DIRECTION_STYLES[styleId];

    const list = (value: any, fallback: string[] = []): string[] => {
      const arr = Array.isArray(value) ? value : [];
      const clean = arr.map((v: any) => String(v || '').trim()).filter(Boolean);
      return clean.length ? clean : fallback;
    };
    const str = (value: any, fallback: string): string => {
      const v = String(value ?? '').trim();
      return v || fallback;
    };

    return {
      styleId,
      styleName: str(raw?.styleName, style.name),
      tagline: str(raw?.tagline, style.essence),
      rationale: str(raw?.rationale, style.essence),
      keywords: list(raw?.keywords, [style.name]),
      layout: {
        grid: str(raw?.layout?.grid, style.layout),
        density: str(raw?.layout?.density, 'balanced'),
        whitespace: str(raw?.layout?.whitespace, 'marges généreuses et régulières'),
        signatureMove: str(raw?.layout?.signatureMove, style.devices),
      },
      color: {
        distribution: str(raw?.color?.distribution, '60 / 30 / 10'),
        application: str(raw?.color?.application, style.color),
        contrast: str(raw?.color?.contrast, 'franc'),
      },
      typography: {
        scaleContrast: str(
          raw?.typography?.scaleContrast,
          `rapport ${style.typeRatio} entre deux niveaux, trois niveaux minimum`
        ),
        caseAndTracking: str(raw?.typography?.caseAndTracking, style.typography),
        treatment: str(raw?.typography?.treatment, 'aucun'),
      },
      imagery: {
        medium: str(raw?.imagery?.medium, 'photography'),
        subjects: str(raw?.imagery?.subjects, "l'activité réelle de la marque"),
        treatment: str(raw?.imagery?.treatment, style.imagery),
        lighting: str(raw?.imagery?.lighting, 'cohérente sur toute la marque'),
        framing: str(raw?.imagery?.framing, 'constant'),
      },
      graphicDevices: list(raw?.graphicDevices, [style.devices]),
      dos: list(raw?.dos, [style.layout]),
      donts: list(raw?.donts, style.bans),
      imagePromptModifier: str(raw?.imagePromptModifier, style.imagePromptModifier),
      updatedAt: new Date(),
    };
  }

  /**
   * Produit la direction artistique du projet (sans la persister).
   *
   * `excludeStyleIds` sert la régénération : sans elle, un utilisateur qui
   * demande « autre chose » reçoit deux fois la même proposition, le brief
   * n'ayant pas changé.
   */
  async generateArtDirection(
    userId: string,
    project: ProjectModel,
    excludeStyleIds: string[] = []
  ): Promise<ArtDirectionModel> {
    const projectDescription = this.extractProjectDescription(project);
    const projectContext = this.extractProjectContext(projectDescription);
    const branding = project.analysisResultModel?.branding;

    const prompt = buildArtDirectionPrompt({
      projectName: project.name || 'Marque',
      projectDescription: projectDescription.slice(0, 4000),
      industry: projectContext.industry,
      targetAudience: projectContext.targetAudience,
      colorsJson: JSON.stringify(branding?.colors?.colors || {}),
      typographyJson: JSON.stringify({
        primaryFont: branding?.typography?.primaryFont,
        secondaryFont: branding?.typography?.secondaryFont,
      }),
      logoConcept: branding?.logo?.concept,
      logoType: branding?.logo?.type,
      excludeStyleIds,
    });

    setAiUsageContext({ feature: 'branding', element: 'art-direction' });

    const raw = await this.promptService.runPrompt(
      {
        provider: AI_CONFIG.branding.artDirection.provider,
        modelName: AI_CONFIG.branding.artDirection.modelName,
        fallbackModels: AI_CONFIG.branding.artDirection.fallbackModels,
        llmOptions: AI_CONFIG.branding.artDirection.llmOptions,
        userId,
      },
      [{ role: 'user', content: prompt }]
    );

    const parsed = parseLlmJson<any>(raw);
    const direction = this.normalizeArtDirection(parsed, 'editorial');
    logger.info(`[ArtDirection] Direction retenue: ${direction.styleId} (${direction.styleName})`, {
      projectId: project.id,
      tagline: direction.tagline,
    });
    return direction;
  }

  /**
   * Garantit que le projet porte une direction artistique, et la persiste.
   *
   * Appelée avant toute génération dépendant du parti pris visuel. Non
   * bloquante : un échec laisse simplement le livrable sans bloc
   * `<art_direction>` plutôt que d'interrompre la génération — le repli est
   * dégradé, pas cassé.
   */
  async ensureArtDirection(
    userId: string,
    projectId: string,
    project: ProjectModel,
    opts: { force?: boolean; persist?: boolean } = {}
  ): Promise<ArtDirectionModel | null> {
    const branding = project.analysisResultModel?.branding;
    if (!branding) return null;
    if (!opts.force && branding.artDirection?.styleId) {
      return branding.artDirection;
    }

    try {
      const excluded = opts.force && branding.artDirection?.styleId ? [branding.artDirection.styleId] : [];
      const direction = await this.generateArtDirection(userId, project, excluded);
      direction.createdAt = branding.artDirection?.createdAt || new Date();

      // Mutation en mémoire d'abord : la génération en cours doit utiliser la
      // direction immédiatement, même si l'écriture en base échoue.
      branding.artDirection = direction;

      if (opts.persist !== false) {
        const updated = {
          ...project,
          analysisResultModel: {
            ...project.analysisResultModel,
            branding: { ...branding, artDirection: direction },
          },
        };
        await this.projectRepository.update(projectId, updated as any, `users/${userId}/projects`);
        await cacheService
          .set(`project_${userId}_${projectId}`, updated, { prefix: 'project', ttl: 3600 })
          .catch((error) => logger.error('[ArtDirection] cache update failed', error));
      }
      return direction;
    } catch (error) {
      logger.error('[ArtDirection] génération impossible (poursuite sans direction)', error);
      return branding.artDirection || null;
    }
  }

  /**
   * Régénère la direction artistique d'un projet et la persiste.
   * Exposée à l'API : c'est le bouton « proposer une autre direction ».
   */
  async regenerateArtDirection(userId: string, projectId: string): Promise<ArtDirectionModel | null> {
    const project = await this.getProject(projectId, userId);
    if (!project) return null;
    return this.ensureArtDirection(userId, projectId, project, { force: true, persist: true });
  }

  /**
   * Extract icon-only SVG from the complete logo SVG
   * Removes text elements to create an icon-only version
   */
  /**
   * Guarantees the project's logo carries hosted PNG asset URLs (`assetUrls`).
   *
   * The upload normally happens when the logo is selected / colors are generated,
   * but some flows reach a downstream consumer (brand book, pitch deck…) before
   * that ran. Without hosted URLs, consumers fall back to inline SVG data-URIs —
   * which the LLM then hallucinates into broken links (e.g. `https://brand-logo.svg`).
   *
   * When `assetUrls` is missing this rasterizes+uploads now, mutates the in-memory
   * project so the current run uses real URLs, and (unless `persist` is false)
   * writes them back to DB + cache. Non-fatal: logs and returns on failure.
   */
  private async ensureLogoAssetUrls(
    userId: string,
    projectId: string,
    project: ProjectModel,
    persist = true
  ): Promise<void> {
    const logo = project.analysisResultModel?.branding?.logo;
    // On teste `primary` et non la seule présence de `assetUrls` : une passe où la
    // rasterisation du logo principal a échoué laisse un objet partiel (icône +
    // déclinaisons), et sortir ici gelait cette lacune définitivement.
    if (!logo || logo.assetUrls?.primary) return;

    const v = logo.variations;
    const hasContent = !!(
      logo.svg ||
      v?.withText?.lightBackground ||
      v?.withText?.darkBackground ||
      v?.withText?.monochrome ||
      v?.iconOnly?.lightBackground ||
      v?.iconOnly?.darkBackground ||
      v?.iconOnly?.monochrome
    );
    if (!hasContent) return;

    try {
      // First, upload inline SVGs to MinIO if they haven't been externalized yet.
      // uploadAllLogoSvgs skips values that are already URLs.
      try {
        const svgUrls = await this.storageService.uploadAllLogoSvgs(logo, userId, projectId);
        logo.svg = svgUrls.svg;
        if (svgUrls.iconSvg) logo.iconSvg = svgUrls.iconSvg;
        if (svgUrls.variations) logo.variations = svgUrls.variations;
        logger.info(`ensureLogoAssetUrls: externalized inline SVGs to MinIO`, { projectId });
      } catch (svgUploadError) {
        logger.warn(`ensureLogoAssetUrls: SVG externalization failed (continuing with inline)`, svgUploadError);
      }

      const assetUrls = await this.storageService.uploadProjectLogoAssets(logo, userId, projectId);
      // Mutate in-memory so the current generation uses hosted URLs immediately.
      logo.assetUrls = assetUrls;

      logger.info(`ensureLogoAssetUrls: uploaded logo asset URLs`, {
        projectId,
        uploaded: Object.keys(assetUrls),
        persisted: persist,
      });

      if (persist && project.analysisResultModel?.branding) {
        const updated = {
          ...project,
          analysisResultModel: {
            ...project.analysisResultModel,
            branding: {
              ...project.analysisResultModel?.branding,
              logo: { ...logo, assetUrls },
            },
          },
        };
        await this.projectRepository.update(projectId, updated as any, `users/${userId}/projects`);
        await cacheService
          .set(`project_${userId}_${projectId}`, updated, { prefix: 'project', ttl: 3600 })
          .catch((error) => logger.error(`ensureLogoAssetUrls: cache update failed`, error));
      }
    } catch (error) {
      logger.error(`ensureLogoAssetUrls failed (continuing without asset URLs)`, error);
    }
  }

  /**
   * Best-effort SVG salvage from raw model text. Used as a last resort when the
   * JSON wrapper is unrecoverable but the `<svg>…</svg>` markup itself is intact
   * (e.g. an unescaped quote in the SVG broke the surrounding JSON string).
   */
  private extractSvgFromText(text: string): string | null {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/<svg[\s\S]*<\/svg>/i);
    return match ? match[0] : null;
  }

  /**
   * Robustly parse a logo model response (concept / revision / edit). Repairs
   * the common LLM-JSON breakages (fences, raw newlines inside the SVG string,
   * trailing commas) and, when the JSON is beyond repair, salvages the raw
   * `<svg>` so a broken wrapper never yields a logo with an undefined SVG.
   * Returns `null` only when no usable SVG can be recovered.
   */
  private parseLogoModelResponse(content: string): Record<string, any> | null {
    const parsed = parseLlmJson<Record<string, any>>(content);
    if (parsed && typeof parsed.svg === 'string' && parsed.svg.includes('<svg')) {
      return parsed;
    }

    const salvagedSvg = this.extractSvgFromText(content);
    if (salvagedSvg) {
      logger.warn('Logo JSON unparseable — salvaged SVG directly from raw response');
      return { ...(parsed && typeof parsed === 'object' ? parsed : {}), svg: salvagedSvg };
    }

    return parsed;
  }

  private extractIconFromSvg(fullSvg: string): string {
    if (!fullSvg || typeof fullSvg !== 'string') {
      logger.warn('extractIconFromSvg called with a non-string SVG; skipping icon extraction');
      return '';
    }
    try {
      // Extract the icon group from the full SVG (using multiline regex)
      const iconMatch = fullSvg.match(/<g id="icon"[^>]*>([\s\S]*?)<\/g>/);
      if (iconMatch) {
        // Create a new SVG with just the icon content
        const iconContent = iconMatch[1];
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><g id="icon">${iconContent}</g></svg>`;
      }

      // Fallback: return a simplified version of the full SVG
      logger.warn('Could not extract icon from SVG, using fallback');
      return fullSvg.replace(/<g id="text"[^>]*>[\s\S]*?<\/g>/, '');
    } catch (error) {
      logger.error('Error extracting icon from SVG:', error);
      return fullSvg; // Return original if extraction fails
    }
  }

  /**
   * Finalise l'artwork d'un concept, après l'IA et avant tout stockage.
   *
   * Type `icon` : le modèle n'a produit que l'icône ; le nom de marque est
   * composé ici (logoLockupService) à partir des métriques réelles de la police
   * choisie, puis vectorisé. L'alignement icône/texte et la typographie
   * deviennent donc des invariants du pipeline, plus des paris sur le modèle.
   *
   * Types `name` / `initial` : le texte dessiné par l'IA est vectorisé dans la
   * même police, ce qui garantit la typographie jusque dans les PNG/PDF.
   */
  private async finalizeLogoArtwork(
    logoData: Record<string, any>,
    typography: TypographyModel | undefined,
    logoType: LogoType | undefined,
    brandName: string
  ): Promise<{ svg: string; iconSvg?: string; lockup?: LogoLockupSpec }> {
    const svg: string = logoData?.svg;
    if (!svg || typeof svg !== 'string') return { svg };

    const fontFamily = typography?.primaryFont?.trim();
    if (!fontFamily) return { svg };

    const fontWeight = normalizeWordmarkWeight(logoData.wordmarkWeight);

    if (logoType === 'icon' && brandName) {
      const composed = await logoLockupService.compose(svg, {
        brandName,
        fontFamily,
        fontWeight,
        letterSpacing: normalizeTracking(logoData.wordmarkTracking),
        wordmarkColor: pickWordmarkColor(
          logoData.wordmarkColor,
          Array.isArray(logoData.colors) ? logoData.colors : []
        ),
        arrangement: logoData.lockupArrangement === 'stacked' ? 'stacked' : 'horizontal',
      });

      if (composed) {
        if (!composed.outlined) {
          logger.warn(
            `Lockup composed without outlines (font "${fontFamily}" unavailable) — falling back to <text>`
          );
        }
        return { svg: composed.svg, iconSvg: composed.iconSvg, lockup: composed.spec };
      }

      // Composition impossible (SVG illisible) : on garde le SVG du modèle
      // plutôt que de perdre le concept, en imposant au moins la police.
      logger.warn('Lockup composition failed, keeping the model SVG with enforced typography');
    }

    return { svg: await logoLockupService.outlineSvgText(svg, fontFamily, fontWeight) };
  }

  /**
   * Optimize logo SVGs using advanced compression techniques
   */
  private optimizeLogoSvgs(logoModel: LogoModel): LogoModel {
    logger.info(`Optimizing SVGs for logo: ${logoModel.id}`);

    const optimized = { ...logoModel };

    // Optimize main SVG
    if (optimized.svg) {
      optimized.svg = SvgOptimizerService.optimizeSvg(optimized.svg);
    }

    // Optimize icon SVG
    if (optimized.iconSvg) {
      optimized.iconSvg = SvgOptimizerService.optimizeSvg(optimized.iconSvg);
    }

    // Optimize variations if present
    if (optimized.variations) {
      optimized.variations = this.optimizeLogoVariations(optimized.variations);
    }

    return optimized;
  }

  /**
   * Optimize logo variations SVGs
   */
  private optimizeLogoVariations(variations: any): any {
    const optimized = { ...variations };

    if (variations.withText) {
      optimized.withText = this.optimizeVariationSet(variations.withText);
    }

    if (variations.iconOnly) {
      optimized.iconOnly = this.optimizeVariationSet(variations.iconOnly);
    }

    return optimized;
  }

  /**
   * Optimize a set of variations
   */
  private optimizeVariationSet(variationSet: any): any {
    const optimized = { ...variationSet };

    Object.keys(optimized).forEach((key) => {
      if (typeof optimized[key] === 'string') {
        optimized[key] = SvgOptimizerService.optimizeSvg(optimized[key]);
      }
    });

    return optimized;
  }

  /**
   * Étape 1: Génère 3 concepts de logos principaux en parallèle - Version optimisée avec préférences
   */
  async generateLogoConcepts(
    userId: string,
    projectId: string,
    forceRegenerate = false,
    skipQuotaCheck = false
  ): Promise<{
    logos: LogoModel[];
  }> {
    const totalStartTime = Date.now();

    // Un seul geste utilisateur ⇒ plusieurs propositions dont une seule sera
    // retenue. Le lot les regroupe pour que le coût réel du "choix de logo"
    // additionne TOUTES les propositions, pas seulement celle conservée.
    openAiUsageBatch({
      userId,
      projectId,
      feature: 'branding',
      element: 'logo',
      operation: forceRegenerate ? 'regenerate' : 'variant',
    });

    // Étape 1: Récupération optimisée du projet avec fallback gracieux
    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const branding = project.analysisResultModel?.branding;
    const selectedColors = branding?.colors;
    const selectedTypography = branding?.typography;
    const preferences = branding?.logoPreferences;

    if (!selectedColors || !selectedTypography) {
      throw new Error(`Project is missing colors or typography. Cannot generate logos.`);
    }

    // Load existing generated logos unless forcing a regeneration from scratch
    const existingLogos = (!forceRegenerate && branding?.generatedLogos) ? branding.generatedLogos : [];
    const existingLogosCount = existingLogos.length;

    if (existingLogosCount >= 3) {
      logger.info(`Logos already complete (${existingLogosCount}/3) for projectId: ${projectId}. Skipping.`);
      return { logos: existingLogos };
    }

    const logosToGenerateCount = 3 - existingLogosCount;
    const isRetry = existingLogosCount > 0 || skipQuotaCheck;

    logger.info(
      `Generating ${logosToGenerateCount} logo concepts in parallel for userId: ${userId}, projectId: ${projectId}, logoType: ${
        preferences?.type || 'name'
      }`
    );

    // Étape 2: Préparation du prompt optimisé (une seule fois)
    const projectDescription = this.extractProjectDescription(project);
    const optimizedPrompt = this.buildOptimizedLogoPrompt(
      projectDescription,
      selectedColors,
      selectedTypography,
      preferences
    );

    // Étape 3: Génération AI parallèle PURE (sans optimisation SVG)
    const aiStartTime = Date.now();

    // Créer promesses pour génération AI pure en parallèle pour les concepts restants
    const modelsToTry = [
      AI_CONFIG.branding.logo.modelName,
      ...(AI_CONFIG.branding.logo.fallbackModels || [])
    ];
    let failedIndexes = Array.from({ length: logosToGenerateCount }, (_, i) => i);
    const rawLogos: LogoModel[] = [];

    for (let modelIndex = 0; modelIndex < modelsToTry.length && failedIndexes.length > 0; modelIndex++) {
      const currentModel = modelsToTry[modelIndex];
      const isFallback = modelIndex > 0;

      if (isFallback) {
        logger.warn(
          `Retrying ${failedIndexes.length} failed logo concept(s) using fallback model ${currentModel}: [${failedIndexes.join(', ')}]`
        );
      }

      const retryPromises = failedIndexes.map(async (index) => {
        return {
          index,
          result: await this.generateRawLogoConcept(optimizedPrompt, project, index + existingLogosCount, preferences, isRetry, currentModel)
        };
      });

      const retryResults = await Promise.allSettled(retryPromises);
      const stillFailed: number[] = [];

      retryResults.forEach((result, i) => {
        const originalIndex = failedIndexes[i];
        if (result.status === 'fulfilled') {
          rawLogos.push(result.value.result);
        } else {
          logger.error(`Logo concept ${originalIndex + existingLogosCount + 1} generation failed with model ${currentModel}:`, result.reason);
          stillFailed.push(originalIndex);
        }
      });
      failedIndexes = stillFailed;
    }

    const aiGenerationTime = Date.now() - aiStartTime;
    logger.info(
      `AI generation completed in ${aiGenerationTime}ms - Success: ${rawLogos.length}/${logosToGenerateCount} after retry`
    );

    // Étape 4: Optimisation SVG en parallèle (séparée de l'AI)
    const optimizationStartTime = Date.now();

    const finalLogosList = [...existingLogos, ...rawLogos];

    // Paralléliser l'optimisation SVG + mise à jour DB/cache
    const [finalOptimizedLogos, _] = await Promise.all([
      // Optimisation SVG batch (rapide)
      Promise.resolve(SvgOptimizerService.optimizeLogos(rawLogos)),

      // Mise à jour DB/cache en parallèle (peut être lente)
      this.updateProjectWithLogosAsync(
        userId,
        projectId,
        project,
        selectedColors,
        selectedTypography,
        finalLogosList // Utiliser la liste complète de logos
      ),
    ]);

    const optimizationTime = Date.now() - optimizationStartTime;
    const totalTime = Date.now() - totalStartTime;

    logger.info(`Logo optimization completed in ${optimizationTime}ms`);
    logger.info(
      `Total parallel logo generation completed in ${totalTime}ms for ${finalOptimizedLogos.length} concepts (AI: ${aiGenerationTime}ms, Optimization: ${optimizationTime}ms)`
    );

    return {
      logos: [...existingLogos, ...finalOptimizedLogos] as LogoModel[],
    };
  }

  /**
   * Agent critique : audite un concept de logo contre la doctrine design.
   * Interne (pas de décompte de crédits) — le verdict pilote la boucle de révision.
   */
  private async critiqueLogoConcept(
    logo: LogoModel,
    project: ProjectModel
  ): Promise<LogoCritiqueResult> {
    // Lockup composé côté serveur : on soumet l'ICÔNE SEULE. Le wordmark est
    // déterministe (métriques réelles), le critique n'a donc rien à y juger —
    // et on évite de lui envoyer un tracé vectorisé de plusieurs kilo-octets.
    const isComposedLockup = Boolean(logo.lockup && logo.iconSvg);
    const logoJson = JSON.stringify({
      // "conceptName" = titre créatif du concept ; le nom de marque est passé à part
      // pour que le critique ne les confonde pas (le wordmark doit afficher la marque)
      conceptName: logo.name,
      concept: logo.concept,
      colors: logo.colors,
      fonts: logo.fonts,
      svg: isComposedLockup ? logo.iconSvg : logo.svg,
    });
    // GRILLE DÉTERMINISTE D'ABORD. Un SVG tronqué, sans viewBox, à texte vivant
    // ou saturé de tracés est rejetable sans modèle : le défaut est factuel.
    // L'envoyer au critique coûtait un aller-retour complet (10 à 20 s, un appel
    // facturé) pour un verdict qu'une expression régulière rend gratuitement —
    // et le critique répondait parfois « pass » sur un SVG cassé.
    const paletteHexes = (project.analysisResultModel?.branding?.colors?.colors
      ? Object.values(project.analysisResultModel.branding.colors.colors)
      : []
    ).filter((value): value is string => typeof value === 'string');

    const mechanical = inspectSvg(logo.iconSvg || logo.svg || '', { palette: paletteHexes });
    if (!mechanical.ok) {
      logger.warn(
        `Logo "${logo.name ?? 'sans nom'}" : défauts mécaniques détectés sans appel modèle — ${mechanical.summary}`
      );
      logAIEvent('logo.svg_gate_failed', {
        projectId: project.id,
        defects: mechanical.defects.map((defect) => defect.code),
      });
      // Verdict rendu SANS payer le critique : la révision part directement des
      // défauts constatés, qui sont exactement ceux qu'il faut corriger.
      return {
        verdict: 'fail',
        issues: mechanical.defects.map((defect) => defect.message),
        suggestions: [],
      } as unknown as LogoCritiqueResult;
    }

    const brandName = this.resolveBrandName(project);
    const prompt = LOGO_CRITIQUE_PROMPT.replace('{{LOGO_JSON}}', logoJson)
      .replace(/\{\{BRAND_NAME\}\}/g, brandName)
      .replace(/\{\{LOGO_TYPE\}\}/g, logo.type || 'unspecified')
      .replace('{{COMPOSITION_NOTE}}', isComposedLockup ? COMPOSED_LOCKUP_REVIEW_NOTE : '');

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        // ⚠️ Le modèle de la feature `logo` est un modèle "thinking" : ses tokens
        // de raisonnement sont décomptés du budget. À 1200, puis à 4096 une fois
        // le raisonnement RÉELLEMENT activé, la réponse revenait vide
        // (finish_reason=length, contenu nul) ou tronquée en plein milieu — d'où
        // les « Unexpected token 'Q' » au parsing. La boucle qualité (critique →
        // révision) ne s'exécutait alors jamais.
        stepName: 'Logo Critique',
        maxOutputTokens: 16000,
        modelParser: (content) => {
          const parsed = parseLlmJson<Record<string, any>>(content);
          if (!parsed) {
            logger.error('Error parsing logo critique JSON: unparseable response');
            throw new Error('Failed to parse logo critique');
          }
          return parsed;
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, {
      ...BrandingService.LOGO_LLM_CONFIG,
      llmOptions: {
        ...BrandingService.LOGO_LLM_CONFIG.llmOptions,
        // Évaluation, pas création : la température reste basse. Le budget, lui,
        // doit couvrir le raisonnement EN PLUS du petit JSON de verdict — sous
        // MIN_TOKENS_FOR_THINKING la réflexion consomme toute l'enveloppe et la
        // réponse revient vide.
        temperature: 0.15,
        maxOutputTokens: 16000,
      },
      skipQuotaCheck: true,
    });
    const parsed = sectionResults[0].parsedData;

    return {
      verdict: parsed?.verdict === 'fail' ? 'fail' : 'pass',
      score: typeof parsed?.score === 'number' ? parsed.score : 75,
      summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
      remarks: Array.isArray(parsed?.remarks)
        ? parsed.remarks
            .filter((r: any) => r && typeof r.issue === 'string')
            .slice(0, 4)
            .map((r: any) => ({
              criterion: r.criterion || 'quality',
              issue: r.issue,
              fix: r.fix || r.issue,
            }))
        : [],
    };
  }

  /**
   * Agent de révision : corrige le logo à partir des remarques de la critique.
   * Conserve le concept et l'id ; seuls les défauts pointés sont corrigés.
   */
  private async reviseLogoConcept(
    logo: LogoModel,
    critique: LogoCritiqueResult,
    project: ProjectModel
  ): Promise<LogoModel> {
    const remarksText = critique.remarks
      .map((r, i) => `${i + 1}. [${r.criterion}] ${r.fix}`)
      .join('\n');

    const brandName = this.resolveBrandName(project);
    // Même règle que la critique : sur un lockup composé, on ne fait réviser que
    // l'icône — le nom sera recomposé ensuite, à l'identique.
    const isComposedLockup = Boolean(logo.lockup && logo.iconSvg);
    const prompt = LOGO_REVISION_PROMPT.replace(
      '{{ORIGINAL_LOGO_JSON}}',
      JSON.stringify({
        id: logo.id,
        name: logo.name,
        concept: logo.concept,
        colors: logo.colors,
        fonts: logo.fonts,
        svg: isComposedLockup ? logo.iconSvg : logo.svg,
        ...(isComposedLockup
          ? {
              wordmarkColor: logo.lockup?.wordmarkColor,
              wordmarkTracking: logo.lockup?.letterSpacing,
              wordmarkWeight: logo.lockup?.fontWeight,
              lockupArrangement: logo.lockup?.arrangement,
            }
          : {}),
      })
    )
      .replace(/\{\{BRAND_NAME\}\}/g, brandName)
      .replace('{{REVISION_SCOPE}}', isComposedLockup ? ICON_ONLY_REVISION_SCOPE : '')
      .replace('{{CRITIQUE_REMARKS}}', remarksText || critique.summary);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: 'Logo Revision',
        maxOutputTokens: 3500,
        modelParser: (content) => {
          const parsed = this.parseLogoModelResponse(content);
          if (!parsed || typeof parsed.svg !== 'string' || !parsed.svg.includes('<svg')) {
            logger.error('Error parsing logo revision JSON: no usable SVG in response');
            throw new Error('Failed to parse logo revision');
          }
          return parsed;
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, {
      ...BrandingService.LOGO_LLM_CONFIG,
      skipQuotaCheck: true,
    });
    const logoData = sectionResults[0].parsedData;

    if (!logoData?.svg || typeof logoData.svg !== 'string') {
      throw new Error('Logo revision returned no SVG');
    }

    const branding = project.analysisResultModel?.branding;
    const artwork = await this.finalizeLogoArtwork(
      logoData,
      branding?.typography,
      logo.type ?? branding?.logoPreferences?.type,
      brandName
    );

    return {
      ...logo,
      name: logoData.name || logo.name,
      concept: logoData.concept || logo.concept,
      colors: Array.isArray(logoData.colors) ? logoData.colors : logo.colors,
      fonts: artwork.lockup
        ? [artwork.lockup.fontFamily]
        : Array.isArray(logoData.fonts)
          ? logoData.fonts
          : logo.fonts,
      svg: artwork.svg,
      iconSvg: artwork.iconSvg ?? this.extractIconFromSvg(artwork.svg),
      ...(artwork.lockup ? { lockup: artwork.lockup } : {}),
    };
  }

  /**
   * Génération streamée des concepts de logo avec boucle qualité :
   * génération → critique (agent design director) → révision si échec.
   * Chaque étape est poussée au client via streamCallback (SSE), les logos
   * finalisés sont persistés au fil de l'eau, et la génération peut être
   * annulée à tout moment (sélection anticipée par l'utilisateur).
   */
  async generateLogoConceptsWithStreaming(
    userId: string,
    projectId: string,
    streamCallback: (event: ILogoStreamEvent) => Promise<void>,
    forceRegenerate = false,
    preferencesOverride?: LogoPreferences
  ): Promise<LogoModel[]> {
    openAiUsageBatch({
      userId,
      projectId,
      feature: 'branding',
      element: 'logo',
      operation: forceRegenerate ? 'regenerate' : 'variant',
    });

    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const branding = project.analysisResultModel?.branding;
    const selectedColors = branding?.colors;
    const selectedTypography = branding?.typography;
    // Priorité aux préférences passées par le client (formulaire non encore persisté)
    const preferences = preferencesOverride ?? branding?.logoPreferences;

    if (!selectedColors || !selectedTypography) {
      throw new Error(`Project is missing colors or typography. Cannot generate logos.`);
    }

    const existingLogos =
      !forceRegenerate && branding?.generatedLogos ? branding.generatedLogos : [];

    // Émettre les logos déjà générés (reprise après interruption)
    for (let i = 0; i < existingLogos.length; i++) {
      await streamCallback({ type: 'concept_finalized', conceptIndex: i, logo: existingLogos[i] });
    }
    if (existingLogos.length >= 3) {
      logger.info(
        `Streamed logos already complete (${existingLogos.length}/3) for projectId: ${projectId}`
      );
      return existingLogos;
    }

    const logosToGenerateCount = 3 - existingLogos.length;
    const isRetry = existingLogos.length > 0;

    const generationKey = BrandingService.logoGenerationKey(userId, projectId);
    const cancelState = { cancelled: false };
    BrandingService.activeLogoGenerations.set(generationKey, cancelState);

    const projectDescription = this.extractProjectDescription(project);
    const optimizedPrompt = this.buildOptimizedLogoPrompt(
      projectDescription,
      selectedColors,
      selectedTypography,
      preferences
    );

    const finalLogos: LogoModel[] = [...existingLogos];

    // Persistance sérialisée : les concepts finissent en parallèle,
    // les updates DB/cache se suivent pour éviter les écrasements.
    let persistChain: Promise<void> = Promise.resolve();
    const persistLogos = () => {
      const snapshot = [...finalLogos];
      persistChain = persistChain
        .then(() =>
          this.updateProjectWithLogosAsync(
            userId,
            projectId,
            project,
            selectedColors,
            selectedTypography,
            snapshot
          )
        )
        .catch((error) => {
          logger.error('Progressive logo persist failed:', error);
        });
    };

    const modelsToTry = [
      AI_CONFIG.branding.logo.modelName,
      ...(AI_CONFIG.branding.logo.fallbackModels || [])
    ];

    const processConcept = async (offset: number): Promise<LogoModel | null> => {
      const index = existingLogos.length + offset;
      
      for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
        const currentModel = modelsToTry[modelIndex];
        try {
          if (cancelState.cancelled) {
            if (modelIndex === 0) await streamCallback({ type: 'concept_cancelled', conceptIndex: index });
            return null;
          }
          if (modelIndex === 0) await streamCallback({ type: 'concept_started', conceptIndex: index });

          let logo = await this.generateRawLogoConcept(
            optimizedPrompt,
            project,
            index,
            preferences,
            isRetry,
            currentModel
          );
          logo = this.optimizeLogoSvgs(logo);
          await streamCallback({ type: 'concept_generated', conceptIndex: index, logo });

          // Annulé pendant la génération : on garde le logo tel quel, sans passe qualité
          if (!cancelState.cancelled) {
            await streamCallback({ type: 'critique_started', conceptIndex: index });
            let critique: LogoCritiqueResult | null = null;
            try {
              critique = await this.critiqueLogoConcept(logo, project);
            } catch (error) {
              logger.warn(`Logo critique failed for concept ${index + 1}, keeping logo as-is`);
            }
            if (critique) {
              await streamCallback({ type: 'critique_result', conceptIndex: index, critique });

              if (critique.verdict === 'fail' && !cancelState.cancelled) {
                await streamCallback({ type: 'revision_started', conceptIndex: index, critique });
                try {
                  let revised = await this.reviseLogoConcept(logo, critique, project);
                  revised = this.optimizeLogoSvgs(revised);
                  logo = revised;
                  await streamCallback({ type: 'concept_updated', conceptIndex: index, logo });
                } catch (error) {
                  logger.warn(`Logo revision failed for concept ${index + 1}, keeping original`);
                }
              }
            }
          }

          finalLogos.push(logo);
          persistLogos();
          await streamCallback({ type: 'concept_finalized', conceptIndex: index, logo });
          return logo;
        } catch (error: any) {
          logger.error(`Streamed logo concept ${index + 1} failed with model ${currentModel}:`, error);
          if (modelIndex === modelsToTry.length - 1) {
            try {
              await streamCallback({
                type: 'concept_error',
                conceptIndex: index,
                message: error.message,
              });
            } catch {
              // le client a peut-être fermé la connexion
            }
            return null;
          } else {
            logger.warn(`Streamed logo concept ${index + 1} falling back to ${modelsToTry[modelIndex + 1]}...`);
          }
        }
      }
      return null;
    };

    try {
      await Promise.all(
        Array.from({ length: logosToGenerateCount }, (_, offset) => processConcept(offset))
      );
      await persistChain;
      logger.info(
        `Streamed logo generation completed - ProjectId: ${projectId}, finalized: ${finalLogos.length}, cancelled: ${cancelState.cancelled}`
      );
      return finalLogos;
    } finally {
      BrandingService.activeLogoGenerations.delete(generationKey);
    }
  }

  /**
   * Génère UNE déclinaison (un fond) pour un style donné. Générique : le prompt
   * (withText vs iconOnly) et la structure source (logo complet vs icône) sont
   * fournis par l'appelant. Renvoie le SVG brut de l'IA, ou `undefined` si la
   * réponse n'est pas exploitable (le parser échoue → parsedData n'est pas un SVG).
   */
  private async generateSingleVariation(
    kind: LogoVariationKind,
    logoStructure: any,
    promptTemplate: string,
    project: ProjectModel,
    skipQuotaCheck = false
  ): Promise<string | undefined> {
    const prompt = `Logo structure: ${JSON.stringify(logoStructure)}\n\n${promptTemplate}`;

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: `${kind} Variation`,
        maxOutputTokens: 16000,
        modelParser: (content) => {
          try {
            const parsed = safeParseJson(content);
            const container = parsed?.variation ?? parsed;
            // Le SVG peut être sous la clé du fond ({ lightBackground: svg }) ou
            // directement une chaîne. On valide qu'un vrai <svg> est présent.
            const svg =
              typeof container === 'string' ? container : container?.[kind];
            if (typeof svg !== 'string' || !svg.includes('<svg')) {
              throw new Error('no usable SVG in variation response');
            }
            return svg;
          } catch (error) {
            logger.error(`Error parsing ${kind} variation JSON:`, error);
            throw new Error(`Failed to parse ${kind} variation JSON`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, {
      ...BrandingService.LOGO_LLM_CONFIG,
      skipQuotaCheck,
    });
    const svg = sectionResults[0].parsedData;
    return typeof svg === 'string' ? svg : undefined;
  }

  /**
   * Déclinaison « fond clair » : le logo RETENU par l'utilisateur.
   *
   * Il n'y a rien à générer. Le concept validé à l'écran a été dessiné sur fond
   * clair — c'est sa définition, et c'est exactement l'image que l'utilisateur a
   * choisie. Le faire régénérer revenait à demander au modèle de reproduire un
   * tracé qu'on possède déjà : au mieux à l'identique, pour deux appels IA et une
   * critique inutiles ; au pire en le recolorant ou en le simplifiant, et
   * l'utilisateur retrouvait alors une déclinaison « claire » qui n'était plus le
   * logo qu'il avait approuvé.
   *
   * Renvoie le SVG résolu (la source peut être une URL MinIO), ou `undefined` si
   * la résolution échoue — l'appelant retombe alors sur la génération.
   */
  private async lightBackgroundFromSelectedLogo(
    logo: Pick<LogoModel, 'svg' | 'iconSvg'>
  ): Promise<{ withText?: string; iconOnly?: string }> {
    const resolve = async (value?: string): Promise<string | undefined> => {
      if (!value || !value.trim()) return undefined;
      try {
        const svg = await resolveSvgContent(value);
        return svg && svg.includes('<svg') ? svg : undefined;
      } catch {
        return undefined;
      }
    };

    const withText = await resolve(logo.svg);
    // Sans icône dédiée, le logo complet fait office d'icône — c'est déjà la
    // convention du reste du pipeline (`iconSvg || svg`).
    const iconOnly = (await resolve(logo.iconSvg)) ?? withText;
    return { withText, iconOnly };
  }

  /**
   * Reconstruit les déclinaisons « avec texte » à partir des icônes recolorées,
   * en réappliquant la recette de lockup (police, interlettrage, alignement).
   * Aucun appel IA : la seule variable est la couleur du nom, choisie pour son
   * contraste sur le fond visé.
   */
  private async recomposeWithTextVariations(
    iconOnlySet: Record<LogoVariationKind, string | undefined>,
    selectedLogo: LogoModel,
    existing: Partial<Record<LogoVariationKind, string>>
  ): Promise<Record<LogoVariationKind, string | undefined>> {
    const lockup = selectedLogo.lockup!;
    const backgrounds: Record<LogoVariationKind, 'light' | 'dark' | 'mono'> = {
      lightBackground: 'light',
      darkBackground: 'dark',
      monochrome: 'mono',
    };

    const entries = await Promise.all(
      (Object.keys(backgrounds) as LogoVariationKind[]).map(async (kind) => {
        const reused = existing[kind];
        if (reused) return [kind, reused] as const;

        const iconVariation = iconOnlySet[kind];
        if (!iconVariation) return [kind, undefined] as const;

        try {
          // Une déclinaison réutilisée d'un run précédent peut être une URL MinIO.
          const iconSvg = await resolveSvgContent(iconVariation);
          const composed = await logoLockupService.recompose(iconSvg, lockup, backgrounds[kind]);
          return [kind, composed ?? undefined] as const;
        } catch (error) {
          logger.warn(
            `Lockup recomposition failed for ${kind}: ${(error as Error).message}`
          );
          return [kind, undefined] as const;
        }
      })
    );

    return Object.fromEntries(entries) as Record<LogoVariationKind, string | undefined>;
  }

  /**
   * Generate logo variations using parallel execution for each variation type
   * Implements optimized parallel generation strategy
   */
  async generateLogoVariations(
    userId: string,
    projectId: string,
    selectedLogo: LogoModel,
    forceRegenerate = false,
    skipQuotaCheck = false
  ): Promise<{
    withText: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
    iconOnly: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
  }> {
    logger.info(`Generating logo variations using parallel execution for logo: ${selectedLogo.id}`);

    openAiUsageBatch({
      userId,
      projectId,
      feature: 'branding',
      element: 'logoVariations',
      operation: forceRegenerate ? 'regenerate' : 'variant',
    });

    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    // Deux structures source : le LOGO COMPLET (avec texte) pour le jeu withText,
    // et l'icône seule pour le jeu iconOnly. Le nom de marque n'est conservé que
    // pour withText — c'est ce que le vérificateur contrôle.
    const withTextStructure = {
      id: selectedLogo.id,
      name: selectedLogo.name,
      colors: selectedLogo.colors,
      concept: selectedLogo.concept,
      svg: selectedLogo.svg,
    };
    const iconStructure = { ...withTextStructure, svg: selectedLogo.iconSvg || selectedLogo.svg };

    const existingWithText: Record<string, string | undefined> =
      !forceRegenerate && selectedLogo.variations?.withText
        ? { ...selectedLogo.variations.withText }
        : {};
    const existingIconOnly: Record<string, string | undefined> =
      !forceRegenerate && selectedLogo.variations?.iconOnly
        ? { ...selectedLogo.variations.iconOnly }
        : {};
    const isRetry = selectedLogo.variations?.withText !== undefined || skipQuotaCheck;

    // Même règle que la voie streamée : le fond clair EST le logo retenu.
    const lightSource = await this.lightBackgroundFromSelectedLogo(selectedLogo);
    if (lightSource.withText) existingWithText.lightBackground = lightSource.withText;
    if (lightSource.iconOnly) existingIconOnly.lightBackground = lightSource.iconOnly;

    const kinds: LogoVariationKind[] = ['lightBackground', 'darkBackground', 'monochrome'];

    // Génère (ou réutilise) un jeu complet pour un style donné, en parallèle sur
    // les 3 fonds.
    const buildSet = async (
      structure: any,
      prompts: Record<LogoVariationKind, string>,
      existing: Partial<Record<LogoVariationKind, string>>
    ): Promise<Record<LogoVariationKind, string | undefined>> => {
      const entries = await Promise.all(
        kinds.map(async (kind) => {
          const reused = existing[kind];
          if (reused) return [kind, reused] as const;
          const svg = await this.generateSingleVariation(
            kind,
            structure,
            prompts[kind],
            project,
            isRetry
          );
          return [kind, svg] as const;
        })
      );
      return Object.fromEntries(entries) as Record<LogoVariationKind, string | undefined>;
    };

    // Lockup composé : les déclinaisons "avec texte" se déduisent des icônes
    // recolorées, en recomposant le wordmark. Aucune IA n'a à recopier un tracé
    // vectorisé (coûteux et fragile), et la géométrie reste rigoureusement
    // identique d'une déclinaison à l'autre.
    let withTextSet: Record<LogoVariationKind, string | undefined>;
    let iconOnlySet: Record<LogoVariationKind, string | undefined>;

    if (selectedLogo.lockup) {
      logger.info('Generating iconOnly variations, then recomposing the withText lockups');
      // Le modèle doit recevoir le SVG de l'icône, pas son URL MinIO.
      const sourceIcon = await resolveSvgContent(iconStructure.svg).catch(() => iconStructure.svg);
      iconOnlySet = await buildSet(
        { ...iconStructure, svg: sourceIcon },
        ICONONLY_VARIATION_PROMPTS,
        existingIconOnly
      );
      withTextSet = await this.recomposeWithTextVariations(
        iconOnlySet,
        selectedLogo,
        existingWithText
      );
    } else {
      logger.info('Generating withText + iconOnly variation sets (resuming completed ones)');
      [withTextSet, iconOnlySet] = await Promise.all([
        buildSet(withTextStructure, WITHTEXT_VARIATION_PROMPTS, existingWithText),
        buildSet(iconStructure, ICONONLY_VARIATION_PROMPTS, existingIconOnly),
      ]);
    }

    logger.info(`Successfully processed all variations (withText + iconOnly)`);

    // Apply advanced SVG optimization
    const optimizedVariations = {
      withText: this.optimizeVariationSet(withTextSet),
      iconOnly: this.optimizeVariationSet(iconOnlySet),
    };

    // Upload ALL SVGs (logo primary + icon + variations) to MinIO.
    // Replace inline SVG content with hosted URLs before persisting to DB.
    let logoSvgUrl = selectedLogo.svg;
    let iconSvgUrl = selectedLogo.iconSvg;
    let variationUrls: typeof optimizedVariations | undefined = optimizedVariations;
    try {
      const svgUrls = await this.storageService.uploadAllLogoSvgs(
        { svg: selectedLogo.svg, iconSvg: selectedLogo.iconSvg, variations: optimizedVariations },
        userId,
        projectId
      );
      logoSvgUrl = svgUrls.svg;
      if (svgUrls.iconSvg) iconSvgUrl = svgUrls.iconSvg;
      if (svgUrls.variations) variationUrls = svgUrls.variations as typeof optimizedVariations;
      logger.info(`Logo SVGs (primary + variations) uploaded to MinIO`, { projectId });
    } catch (uploadError: any) {
      logger.error(`Logo SVG upload failed after variation generation (keeping inline): ${uploadError.message}`);
    }

    // Update project with hosted URLs for logo SVGs
    const updatedProjectData = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel?.branding,
          logo: {
            ...selectedLogo,
            svg: logoSvgUrl,
            ...(iconSvgUrl ? { iconSvg: iconSvgUrl } : {}),
            variations: variationUrls,
          },
          generatedLogos: [], // Delete other generated logo concepts once one is selected
          updatedAt: new Date(),
        },
      },
    };

    // Database update
    const updatedProject = await this.projectRepository.update(
      projectId,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with optimized logo variations - ProjectId: ${projectId}, LogoId: ${selectedLogo.id}`
      );

      // Update project cache
      const projectCacheKey = `project_${userId}_${projectId}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: 'project',
        ttl: 3600,
      });

      // Cache AI variations with 2h TTL
      const variationsCacheKey = cacheService.generateAIKey(
        'logo_variations',
        userId,
        projectId,
        crypto
          .createHash('sha256')
          .update(JSON.stringify(selectedLogo))
          .digest('hex')
          .substring(0, 16)
      );
      await cacheService.set(variationsCacheKey, optimizedVariations, {
        prefix: 'ai',
        ttl: 7200,
      });

      logger.info(
        `Optimized logo variations cached - ProjectId: ${projectId}, Variations: ${Object.keys(
          optimizedVariations.iconOnly
        ).join('/')}`
      );
    }

    return optimizedVariations;
  }

  /**
   * Agent critique des déclinaisons : juge la fidélité géométrique et la
   * lisibilité sur le fond cible, avec la mesure de visibilité réelle (rendu)
   * en entrée. Interne — pas de décompte de crédits.
   */
  private async critiqueLogoVariation(
    originalSvg: string,
    variationSvg: string,
    variant: LogoVariationKind,
    project: ProjectModel,
    style: LogoVariationStyle = 'withText'
  ): Promise<LogoCritiqueResult> {
    const background = VARIATION_BACKGROUNDS[variant];
    const visibility = await measureSvgVisibility(variationSvg, background);

    // Règle texte dépendante du style : withText EXIGE le nom de marque ;
    // iconOnly l'INTERDIT (le texte est délibérément retiré). Sans cette bascule,
    // le vérificateur échouait à trouver le nom sur les déclinaisons icône.
    const textRule =
      style === 'withText'
        ? 'TEXT — this is a WITH-TEXT declination: the brand name / wordmark MUST be present and identical to the original (same string, same font, readable on the target background). If the text is missing, altered or unreadable, it is an automatic fail.'
        : 'TEXT — this is an ICON-ONLY declination: the wordmark is intentionally removed. The variation must contain NO <text>. NEVER flag a missing brand name or missing text as an issue here.';

    const prompt = LOGO_VARIATION_CRITIQUE_PROMPT.replace(/\{\{VARIANT\}\}/g, variant)
      .replace(/\{\{BACKGROUND\}\}/g, background)
      .replace(/\{\{VISIBILITY\}\}/g, String(Math.round(visibility * 100)))
      .replace(/\{\{TEXT_RULE\}\}/g, textRule)
      .replace('{{ORIGINAL_SVG}}', originalSvg)
      .replace('{{VARIATION_SVG}}', variationSvg);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: `Variation Critique ${variant}`,
        maxOutputTokens: 16000,
        modelParser: (content) => {
          try {
            return safeParseJson(content);
          } catch (error) {
            logger.error('Error parsing variation critique JSON:', error);
            throw new Error('Failed to parse variation critique');
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, {
      ...BrandingService.LOGO_LLM_CONFIG,
      llmOptions: {
        // Même arbitrage que la critique du concept : évaluation à température
        // basse, mais budget suffisant pour que le raisonnement ne dévore pas
        // le JSON de verdict.
        ...BrandingService.LOGO_LLM_CONFIG.llmOptions,
        temperature: 0.15,
        maxOutputTokens: 16000,
      },
      skipQuotaCheck: true,
    });
    const parsed = sectionResults[0].parsedData;

    return {
      verdict: parsed?.verdict === 'fail' ? 'fail' : 'pass',
      score: typeof parsed?.score === 'number' ? parsed.score : 75,
      summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
      remarks: Array.isArray(parsed?.remarks)
        ? parsed.remarks
            .filter((r: any) => r && typeof r.issue === 'string')
            .slice(0, 4)
            .map((r: any) => ({
              criterion: r.criterion || 'quality',
              issue: r.issue,
              fix: r.fix || r.issue,
            }))
        : [],
    };
  }

  /**
   * Déclinaison d'un lockup composé : seule l'icône est recolorée par l'IA (et
   * auditée), le nom est reposé ensuite avec la recette d'origine. Le client
   * reçoit exactement les mêmes événements SSE que la voie classique.
   */
  private async processComposedLockupVariation(
    kind: LogoVariationKind,
    lockup: LogoLockupSpec,
    background: 'light' | 'dark' | 'mono',
    iconStructure: { svg: string; [key: string]: unknown },
    iconResults: Partial<Record<LogoVariationKind, string>>,
    results: Partial<Record<LogoVariationKind, string>>,
    project: ProjectModel,
    cancelState: { cancelled: boolean },
    streamCallback: (event: ILogoVariationStreamEvent) => Promise<void>
  ): Promise<void> {
    const recompose = async (iconSvg: string): Promise<string> => {
      const composed = await logoLockupService.recompose(iconSvg, lockup, background);
      if (!composed) throw new Error(`Lockup recomposition failed for ${kind}`);
      return SvgOptimizerService.optimizeSvg(composed);
    };

    // L'icône source peut déjà être externalisée (URL MinIO) : le modèle doit
    // recevoir le SVG, pas un lien.
    const sourceIcon = await resolveSvgContent(iconStructure.svg).catch(() => iconStructure.svg);

    let iconSvg = iconResults[kind];
    if (!iconSvg) {
      const generated = await this.generateSingleVariation(
        kind,
        { ...iconStructure, svg: sourceIcon },
        ICONONLY_VARIATION_PROMPTS[kind],
        project,
        true
      );
      if (!generated) throw new Error(`Empty ${kind} icon variation`);
      iconSvg = SvgOptimizerService.optimizeSvg(generated);
    }

    let svg = await recompose(iconSvg);
    await streamCallback({ type: 'variation_generated', variant: kind, svg });

    if (!cancelState.cancelled) {
      await streamCallback({ type: 'critique_started', variant: kind });
      let critique: LogoCritiqueResult | null = null;
      try {
        // L'audit porte sur l'icône recolorée : c'est la seule chose qui varie.
        critique = await this.critiqueLogoVariation(sourceIcon, iconSvg, kind, project, 'iconOnly');
      } catch (error) {
        logger.warn(`Variation critique failed for ${kind}, keeping as-is`);
      }

      if (critique) {
        await streamCallback({ type: 'critique_result', variant: kind, critique });

        if (critique.verdict === 'fail' && !cancelState.cancelled) {
          await streamCallback({ type: 'revision_started', variant: kind, critique });
          try {
            const mapping = await this.aiRecolorLogoVariation(
              {
                svg: iconSvg,
                variant: kind,
                background: VARIATION_BACKGROUNDS[kind],
                issue: critique.remarks.map((r) => r.fix).join('; ') || critique.summary,
              },
              project
            );
            if (mapping && Object.keys(mapping).length > 0) {
              const revisedIcon = SvgOptimizerService.optimizeSvg(
                await applyColorMappingToSvg(iconSvg, mapping)
              );
              // Même garde-fou que la voie classique : pas de régression de visibilité.
              const [before, after] = await Promise.all([
                measureSvgVisibility(iconSvg, VARIATION_BACKGROUNDS[kind]),
                measureSvgVisibility(revisedIcon, VARIATION_BACKGROUNDS[kind]),
              ]);
              if (after >= before) {
                iconSvg = revisedIcon;
                svg = await recompose(iconSvg);
                await streamCallback({ type: 'variation_updated', variant: kind, svg });
              }
            }
          } catch (error) {
            logger.warn(`Variation revision failed for ${kind}, keeping original`);
          }
        }
      }
    }

    iconResults[kind] = iconSvg;
    results[kind] = svg;
    await streamCallback({ type: 'variation_finalized', variant: kind, svg });
  }

  /**
   * Génération streamée des déclinaisons (fond clair / sombre / monochrome)
   * avec boucle qualité : génération → critique (fidélité + lisibilité mesurée)
   * → recoloration bornée si échec (la géométrie reste gelée). Chaque étape est
   * poussée au client via SSE ; le résultat est persisté sur le projet.
   */
  async generateLogoVariationsWithStreaming(
    userId: string,
    projectId: string,
    streamCallback: (event: ILogoVariationStreamEvent) => Promise<void>,
    forceRegenerate = false
  ): Promise<{
    variations: {
      withText: { lightBackground?: string; darkBackground?: string; monochrome?: string };
      iconOnly: { lightBackground?: string; darkBackground?: string; monochrome?: string };
    };
    /**
     * Logo principal après externalisation (URLs MinIO). Renvoyé au client pour
     * qu'il persiste ces URLs et n'écrase pas la base avec le SVG inline qu'il
     * détient encore en mémoire depuis la sélection du concept.
     */
    logo: { svg: string; iconSvg?: string };
  }> {
    openAiUsageBatch({
      userId,
      projectId,
      feature: 'branding',
      element: 'logoVariations',
      operation: forceRegenerate ? 'regenerate' : 'variant',
    });

    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const selectedLogo = project.analysisResultModel?.branding?.logo;
    if (!selectedLogo?.svg) {
      throw new Error('No selected logo found on project. Select a logo first.');
    }

    const existingWithText: Record<string, string | undefined> =
      !forceRegenerate && selectedLogo.variations?.withText
        ? { ...selectedLogo.variations.withText }
        : {};
    const existingIconOnly: Record<string, string | undefined> =
      !forceRegenerate && selectedLogo.variations?.iconOnly
        ? { ...selectedLogo.variations.iconOnly }
        : {};
    const isRetry = selectedLogo.variations?.withText !== undefined;

    // Le fond clair n'est pas généré : c'est le logo retenu. On l'injecte dans
    // l'existant, ce qui le fait traiter par le mécanisme de reprise déjà en
    // place — il part au client en `variation_finalized` dès la première boucle,
    // et seules les deux autres déclinaisons sont réellement produites.
    // Vaut aussi en régénération forcée : il n'y a rien à régénérer.
    const lightSource = await this.lightBackgroundFromSelectedLogo(selectedLogo);
    if (lightSource.withText) existingWithText.lightBackground = lightSource.withText;
    if (lightSource.iconOnly) existingIconOnly.lightBackground = lightSource.iconOnly;

    const kinds: LogoVariationKind[] = ['lightBackground', 'darkBackground', 'monochrome'];
    // results = jeu withText (streamé, héros avec le nom) ; iconResults = jeu icône.
    const results: Partial<Record<LogoVariationKind, string>> = {};
    const iconResults: Partial<Record<LogoVariationKind, string>> = {};

    // Réémettre l'existant (reprise), ne générer que le manquant
    for (const kind of kinds) {
      const existingSvg = existingWithText[kind];
      const existingIconSvg = existingIconOnly[kind];
      if (existingIconSvg) {
        iconResults[kind] = existingIconSvg;
      }
      if (existingSvg) {
        results[kind] = existingSvg;
        await streamCallback({ type: 'variation_finalized', variant: kind, svg: existingSvg });
      }
    }
    const missingKinds = kinds.filter((kind) => !results[kind] || !iconResults[kind]);
    if (missingKinds.length === 0) {
      return {
        variations: { withText: { ...results }, iconOnly: { ...iconResults } },
        logo: { svg: selectedLogo.svg, ...(selectedLogo.iconSvg ? { iconSvg: selectedLogo.iconSvg } : {}) },
      };
    }

    const generationKey = BrandingService.variationsGenerationKey(userId, projectId);
    const cancelState = { cancelled: false };
    BrandingService.activeLogoGenerations.set(generationKey, cancelState);

    // Deux sources : le LOGO COMPLET (avec texte) pour withText, l'icône seule
    // pour iconOnly. La critique streamée juge le jeu withText contre le logo
    // complet → elle vérifie que le nom de marque est bien présent.
    const withTextStructure = {
      id: selectedLogo.id,
      name: selectedLogo.name,
      colors: selectedLogo.colors,
      concept: selectedLogo.concept,
      svg: selectedLogo.svg,
    };
    const iconStructure = { ...withTextStructure, svg: selectedLogo.iconSvg || selectedLogo.svg };
    const originalSvg = selectedLogo.svg;

    // withText streamé (héros). Le nom est conservé.
    const generateOne = (kind: LogoVariationKind): Promise<string | undefined> =>
      this.generateSingleVariation(
        kind,
        withTextStructure,
        WITHTEXT_VARIATION_PROMPTS[kind],
        project,
        isRetry
      );

    // iconOnly généré en silence (pas de critique streamée) via les prompts icône.
    const generateIconOnly = (kind: LogoVariationKind): Promise<string | undefined> =>
      this.generateSingleVariation(
        kind,
        iconStructure,
        ICONONLY_VARIATION_PROMPTS[kind],
        project,
        true
      );

    // Lockup composé : la déclinaison "avec texte" n'est plus générée par l'IA.
    // On ne fait recolorer QUE l'icône, puis on repose le nom avec la recette
    // d'origine — la boucle qualité continue de porter sur ce qui varie vraiment
    // (la couleur), et le nom ne peut plus se décaler d'une déclinaison à l'autre.
    const lockup = selectedLogo.lockup;
    const lockupBackgrounds: Record<LogoVariationKind, 'light' | 'dark' | 'mono'> = {
      lightBackground: 'light',
      darkBackground: 'dark',
      monochrome: 'mono',
    };

    const processVariant = async (kind: LogoVariationKind): Promise<void> => {
      try {
        if (cancelState.cancelled) {
          await streamCallback({ type: 'variation_cancelled', variant: kind });
          return;
        }
        await streamCallback({ type: 'variation_started', variant: kind });

        if (lockup) {
          await this.processComposedLockupVariation(
            kind,
            lockup,
            lockupBackgrounds[kind],
            iconStructure,
            iconResults,
            results,
            project,
            cancelState,
            streamCallback
          );
          return;
        }

        // iconOnly généré en parallèle (silencieux) — réutilise l'existant si présent.
        const iconOnlyPromise: Promise<string | undefined> = iconResults[kind]
          ? Promise.resolve(iconResults[kind])
          : generateIconOnly(kind)
              .then((raw) => (raw ? SvgOptimizerService.optimizeSvg(raw) : undefined))
              .catch((error) => {
                logger.warn(`iconOnly ${kind} generation failed: ${error?.message ?? error}`);
                return undefined;
              });

        let svg = await generateOne(kind);
        if (!svg) {
          throw new Error(`Empty ${kind} variation`);
        }
        svg = SvgOptimizerService.optimizeSvg(svg);
        await streamCallback({ type: 'variation_generated', variant: kind, svg });

        if (!cancelState.cancelled) {
          await streamCallback({ type: 'critique_started', variant: kind });
          let critique: LogoCritiqueResult | null = null;
          try {
            // Style 'withText' : la critique EXIGE la présence du nom de marque.
            critique = await this.critiqueLogoVariation(originalSvg, svg, kind, project, 'withText');
          } catch (error) {
            logger.warn(`Variation critique failed for ${kind}, keeping as-is`);
          }
          if (critique) {
            await streamCallback({ type: 'critique_result', variant: kind, critique });

            if (critique.verdict === 'fail' && !cancelState.cancelled) {
              await streamCallback({ type: 'revision_started', variant: kind, critique });
              try {
                // Réparation bornée : remapping de couleurs uniquement, géométrie gelée
                const mapping = await this.aiRecolorLogoVariation(
                  {
                    svg,
                    variant: kind,
                    background: VARIATION_BACKGROUNDS[kind],
                    issue:
                      critique.remarks.map((r) => r.fix).join('; ') || critique.summary,
                  },
                  project
                );
                if (mapping && Object.keys(mapping).length > 0) {
                  const revised = SvgOptimizerService.optimizeSvg(
                    await applyColorMappingToSvg(svg, mapping)
                  );
                  // Garde-fou : ne remplacer que si la visibilité ne régresse pas
                  const background = VARIATION_BACKGROUNDS[kind];
                  const [before, after] = await Promise.all([
                    measureSvgVisibility(svg, background),
                    measureSvgVisibility(revised, background),
                  ]);
                  if (after >= before) {
                    svg = revised;
                    await streamCallback({ type: 'variation_updated', variant: kind, svg });
                  }
                }
              } catch (error) {
                logger.warn(`Variation revision failed for ${kind}, keeping original`);
              }
            }
          }
        }

        results[kind] = svg;
        const iconSvg = await iconOnlyPromise;
        if (iconSvg) {
          iconResults[kind] = iconSvg;
        }
        await streamCallback({ type: 'variation_finalized', variant: kind, svg });
      } catch (error: any) {
        logger.error(`Streamed variation ${kind} failed:`, error);
        try {
          await streamCallback({ type: 'variation_error', variant: kind, message: error.message });
        } catch {
          // client déconnecté
        }
      }
    };

    try {
      await Promise.all(missingKinds.map((kind) => processVariant(kind)));
    } finally {
      BrandingService.activeLogoGenerations.delete(generationKey);
    }

    const optimizedVariations = {
      withText: this.optimizeVariationSet({ ...results }),
      iconOnly: this.optimizeVariationSet({ ...iconResults }),
    };

    // Upload ALL SVGs to MinIO (logo primary + icon + variations)
    let logoSvgUrl = selectedLogo.svg;
    let iconSvgUrl = selectedLogo.iconSvg;
    let variationUrls: typeof optimizedVariations | undefined = optimizedVariations;
    try {
      const svgUrls = await this.storageService.uploadAllLogoSvgs(
        { svg: selectedLogo.svg, iconSvg: selectedLogo.iconSvg, variations: optimizedVariations },
        userId,
        projectId
      );
      logoSvgUrl = svgUrls.svg;
      if (svgUrls.iconSvg) iconSvgUrl = svgUrls.iconSvg;
      if (svgUrls.variations) variationUrls = svgUrls.variations as typeof optimizedVariations;
      logger.info(`Streamed variation SVGs uploaded to MinIO`, { projectId });
    } catch (uploadError: any) {
      logger.error(`Streamed variation SVG upload failed (keeping inline): ${uploadError.message}`);
    }

    // Persistance sur le projet avec les URLs MinIO
    const updatedProjectData = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel?.branding,
          logo: {
            ...selectedLogo,
            svg: logoSvgUrl,
            ...(iconSvgUrl ? { iconSvg: iconSvgUrl } : {}),
            variations: variationUrls,
          },
          generatedLogos: [], // Delete other generated logo concepts once one is selected
          updatedAt: new Date(),
        },
      },
    };
    const updatedProject = await this.projectRepository.update(
      projectId,
      updatedProjectData,
      `users/${userId}/projects`
    );
    if (updatedProject) {
      await cacheService.set(`project_${userId}_${projectId}`, updatedProject, {
        prefix: 'project',
        ttl: 3600,
      });
      logger.info(
        `Streamed logo variations persisted - ProjectId: ${projectId}, kinds: ${Object.keys(results).join('/')}`
      );
    }

    return {
      variations: variationUrls || optimizedVariations,
      logo: { svg: logoSvgUrl, ...(iconSvgUrl ? { iconSvg: iconSvgUrl } : {}) },
    };
  }

  async getBrandingsByProjectId(
    userId: string,
    projectId: string
  ): Promise<BrandIdentityModel | null> {
    logger.info(`Fetching branding for projectId: ${projectId}, userId: ${userId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when fetching branding.`
      );
      return null;
    }
    logger.info(`Successfully fetched branding for projectId: ${projectId}`);

    return project.analysisResultModel?.branding || null;
  }

  async getBrandingById(userId: string, brandingId: string): Promise<BrandIdentityModel | null> {
    logger.info(`Getting branding by ID: ${brandingId} for userId: ${userId}`);
    // In current implementation, branding is nested in project, so we don't have direct access by brandingId
    // This method would need to be implemented differently if we had a separate branding repository
    logger.warn(`Direct access to branding by ID is not supported in the current implementation`);
    return null;
  }

  async updateBranding(
    userId: string,
    projectId: string,
    data: Partial<BrandIdentityModel>
  ): Promise<ProjectModel | null> {
    logger.info(`Updating branding for userId: ${userId}, projectId: ${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when updating branding.`
      );
      return null;
    }

    const updatedProject = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel?.branding,
          ...data,
        },
      },
    };

    const result = await this.projectRepository.update(
      projectId,
      updatedProject,
      `users/${userId}/projects`
    );
    logger.info(`Successfully updated branding for projectId: ${projectId}`);
    return result;
  }

  async deleteBranding(userId: string, projectId: string): Promise<boolean> {
    logger.info(`Removing branding for userId: ${userId}, projectId: ${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when deleting branding.`
      );
      return false;
    }

    // Reset branding to empty state rather than removing it completely
    if (!project.analysisResultModel) {
      project.analysisResultModel = {} as any;
    }
    project.analysisResultModel.branding = {
      logo: {
        svg: '',
        concept: '',
        colors: [],
        fonts: [],
        id: '1',
        name: '',
      },
      generatedLogos: [],
      typography: {
        id: '',
        name: '',
        url: '',
        primaryFont: '',
        secondaryFont: '',
      },
      generatedTypography: [],
      generatedColors: [],
      colors: {
        id: '',
        name: '',
        url: '',
        colors: {
          primary: '',
          secondary: '',
          accent: '',
          background: '',
          text: '',
        },
      },
      sections: [],
    };

    await this.projectRepository.update(projectId, project, `users/${userId}/projects`);
    logger.info(`Successfully reset branding for projectId: ${projectId}`);
    return true;
  }

  /**
   * Génère un PDF à partir des sections de branding d'un projet
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @returns Chemin vers le fichier PDF temporaire généré
   */
  async generateBrandingPdf(userId: string, projectId: string): Promise<string> {
    logger.info(
      `Generating PDF for branding sections - projectId: ${projectId}, userId: ${userId}`
    );
    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating branding PDF.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }
    const branding = project.analysisResultModel?.branding;
    if (!branding || !branding.sections || branding.sections.length === 0) {
      logger.warn(`No branding sections found for project ${projectId} when generating PDF.`);
      return '';
    }

    try {
      // Generate cache key for PDF
      const pdfCacheKey = cacheService.generateAIKey('branding-pdf', userId, projectId);

      // Check if PDF is already cached
      const cachedPdfPath = await cacheService.get<string>(pdfCacheKey, {
        prefix: 'pdf',
        ttl: 3600, // 1 hour
      });

      if (cachedPdfPath) {
        logger.info(`Branding PDF cache hit for projectId: ${projectId}`);
        return cachedPdfPath;
      }

      logger.info(`Branding PDF cache miss, generating new PDF for projectId: ${projectId}`);

      // Déterminer le format de page à utiliser
      const pageFormat = branding?.pdfFormat
        ? PAGE_FORMATS[branding.pdfFormat as keyof typeof PAGE_FORMATS]
        : PAGE_FORMATS.SLIDE_16_9;

      logger.info(
        `Generating PDF with format: ${branding?.pdfFormat || 'SLIDE_16_9'}`
      );

      // Utiliser le PdfService pour générer le PDF avec le format choisi
      const pdfPath = await this.pdfService.generatePdf({
        title: 'Branding',
        projectName: project.name || 'Projet Sans Nom',
        projectDescription: project.longDescription || project.description || '',
        sections: branding.sections,
        sectionDisplayOrder: [
          'Brand Header',
          'Logo Principal',
          'Logo Variation Fond Clair',
          'Logo Variation Fond Sombre',
          'Logo Variation Monochrome',
          'Logo Bonnes Pratiques',
          'Color Palette',
          'Typography',
          'Brand Mockups',
          'Brand Footer',
        ],
        footerText: 'Generated by Idem',
        pageFormat, // Format choisi par l'utilisateur
      });

      // Cache the PDF path for future requests
      await cacheService.set(pdfCacheKey, pdfPath, {
        prefix: 'pdf',
        ttl: 3600, // 1 hour
      });
      logger.info(`Branding PDF cached for projectId: ${projectId}`);

      return pdfPath;
    } catch (error) {
      logger.error(`Error generating branding PDF for projectId: ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Génère un fichier ZIP contenant toutes les déclinaisons du logo
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @param extension - Extension souhaitée (svg, png, psd)
   * @returns Buffer du fichier ZIP
   */
  async generateLogosZip(
    userId: string,
    projectId: string,
    extension: 'svg' | 'png' | 'psd'
  ): Promise<Buffer> {
    logger.info(
      `Generating logos ZIP for projectId: ${projectId}, userId: ${userId}, extension: ${extension}`
    );

    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating logos ZIP.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const branding = project.analysisResultModel?.branding;
    if (!branding || !branding.logo) {
      logger.warn(`No logo found for project ${projectId} when generating logos ZIP.`);
      throw new Error(`No logo found for project ${projectId}`);
    }

    const JSZip = require('jszip');
    const zip = new JSZip();

    try {
      // Récupérer toutes les déclinaisons disponibles
      const logoVariations = branding.logo.variations;
      const logoFiles: { name: string; content: string }[] = [];

      // Logo principal
      if (branding.logo.svg) {
        const content = await this.fetchContentFromUrl(branding.logo.svg);
        if (content) {
          logoFiles.push({
            name: 'logo-main',
            content: content,
          });
        }
      }

      // Logo icône seulement
      if (branding.logo.iconSvg) {
        const content = await this.fetchContentFromUrl(branding.logo.iconSvg);
        if (content) {
          logoFiles.push({
            name: 'logo-icon',
            content: content,
          });
        }
      }

      // Variations avec texte
      if (logoVariations?.withText) {
        if (logoVariations.withText.lightBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.lightBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-light-background',
              content: content,
            });
          }
        }
        if (logoVariations.withText.darkBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.darkBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-dark-background',
              content: content,
            });
          }
        }
        if (logoVariations.withText.monochrome) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.monochrome);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-monochrome',
              content: content,
            });
          }
        }
      }

      // Variations icône seulement
      if (logoVariations?.iconOnly) {
        if (logoVariations.iconOnly.lightBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.lightBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-light-background',
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.darkBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.darkBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-dark-background',
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.monochrome) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.monochrome);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-monochrome',
              content: content,
            });
          }
        }
      }

      if (logoFiles.length === 0) {
        throw new Error('No logo variations found to include in ZIP');
      }

      logger.info(`Found ${logoFiles.length} logo variations to include in ZIP`);

      // Traitement en parallèle selon l'extension demandée
      logger.info(
        `Starting parallel conversion of ${logoFiles.length} logos to ${extension.toUpperCase()}`
      );

      // Pré-initialiser le browser pour les conversions PSD si nécessaire
      if (extension === 'psd') {
        logger.info('Pre-initializing browser for parallel PSD conversions');
        await SvgToPsdService.initializeForParallelConversion();
      }

      const conversionPromises = logoFiles.map(async (logoFile) => {
        const fileName = `${logoFile.name}.${extension}`;

        try {
          if (extension === 'svg') {
            // Pour SVG, pas de conversion nécessaire
            return { fileName, content: logoFile.content };
          } else if (extension === 'png') {
            // Pour PNG, convertir le SVG
            const pngBuffer = await this.convertSvgToPng(logoFile.content);
            return { fileName, content: pngBuffer };
          } else if (extension === 'psd') {
            // Pour PSD, convertir le SVG en vrai fichier PSD
            const psdBuffer = await this.convertSvgToPsd(logoFile.name, logoFile.content);
            return { fileName, content: psdBuffer };
          }

          // Fallback pour extensions non supportées
          return { fileName, content: logoFile.content };
        } catch (error) {
          logger.error(`Error converting ${logoFile.name} to ${extension}:`, error);
          // En cas d'erreur, retourner le contenu SVG original
          return {
            fileName: `${logoFile.name}.svg`,
            content: logoFile.content,
          };
        }
      });

      // Attendre que toutes les conversions se terminent
      const convertedFiles = await Promise.all(conversionPromises);

      logger.info(`Completed parallel conversion of ${convertedFiles.length} logos`);

      // Ajouter tous les fichiers convertis au ZIP
      convertedFiles.forEach(({ fileName, content }) => {
        zip.file(fileName, content);
      });

      // Ajouter un fichier README avec les informations du projet
      const readmeContent = this.generateReadmeContent(project, extension, logoFiles.length);
      zip.file('README.txt', readmeContent);

      // Générer le ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      logger.info(
        `Successfully generated logos ZIP for projectId: ${projectId}, extension: ${extension}, files: ${logoFiles.length}`
      );

      return zipBuffer;
    } catch (error) {
      logger.error(
        `Error generating logos ZIP for projectId: ${projectId}, extension: ${extension}`,
        error
      );
      throw error;
    }
  }

  /**
   * Convertit un SVG en PNG
   */
  private async convertSvgToPng(svgContent: string): Promise<Buffer> {
    try {
      const sharp = require('sharp');

      // Convertir le SVG en PNG avec une résolution de 512x512
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Fond transparent
        })
        .png()
        .toBuffer();

      return pngBuffer;
    } catch (error) {
      logger.error('Error converting SVG to PNG:', error);
      // Fallback: retourner le contenu SVG comme texte
      return Buffer.from(svgContent, 'utf-8');
    }
  }

  /**
   * Convertit un SVG en fichier PSD réel avec calques éditables
   * Utilise le SvgToPsdService pour créer un vrai fichier PSD avec des calques séparés
   */
  private async convertSvgToPsd(logoName: string, svgContent: string): Promise<Buffer> {
    try {
      logger.info(`Converting SVG to PSD with editable layers: ${logoName}`);

      // Utiliser le service SVG to PSD pour créer un fichier avec calques
      const psdPath = await SvgToPsdService.convertSvgToPsd(svgContent, {
        width: 1024,
        height: 1024,
        backgroundColor: 'transparent',
        quality: 100,
      });

      // Lire le fichier PSD généré
      const psdBuffer = await fs.readFile(psdPath);

      // Nettoyer le fichier temporaire
      await SvgToPsdService.cleanupTempFile(psdPath);

      logger.info(
        `Successfully converted ${logoName} to PSD with ${
          svgContent.match(/<(path|rect|circle|ellipse|line|polyline|polygon|text|g)[^>]*>/gi)
            ?.length || 0
        } potential layers`
      );

      return psdBuffer;
    } catch (error) {
      logger.error(`Error converting SVG to PSD for ${logoName}:`, error);

      // Fallback: créer un PNG haute qualité avec extension .psd
      logger.warn(`Falling back to PNG conversion for ${logoName}`);
      try {
        const sharp = require('sharp');
        const pngBuffer = await sharp(Buffer.from(svgContent))
          .resize(1024, 1024, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer();

        return pngBuffer;
      } catch (fallbackError) {
        logger.error(`Fallback PNG conversion also failed for ${logoName}:`, fallbackError);
        return Buffer.from(svgContent, 'utf-8');
      }
    }
  }

  /**
   * Génère le contenu du fichier README
   */
  private generateReadmeContent(project: any, extension: string, fileCount: number): string {
    return `Logo Package - ${project.name}

Project: ${project.name}
Description: ${project.longDescription || project.description || 'No description available'}
Format: ${extension.toUpperCase()}
Files included: ${fileCount}
Generated on: ${new Date().toISOString()}

${
  extension.toLowerCase() === 'psd'
    ? `
✅ PSD FORMAT WITH EDITABLE LAYERS:
These are genuine PSD files with separated, editable layers created from your SVG logos.
Each SVG element (paths, shapes, text, groups) has been converted into individual layers.

Features:
- Editable layers for each SVG element
- Transparent backgrounds
- High resolution (1024x1024)
- Compatible with Photoshop, GIMP, and other PSD editors
- Preserves original SVG structure as separate layers

`
    : ''
}File naming convention:
- logo-main: Main logo with text
- logo-icon: Icon-only version
- logo-with-text-*: Logo with text in different variations
- logo-icon-only-*: Icon-only in different variations

Variations:
- light-background: Optimized for light backgrounds
- dark-background: Optimized for dark backgrounds
- monochrome: Single color version

${
  extension.toLowerCase() === 'svg'
    ? 'SVG files are vector-based and can be scaled to any size without quality loss.'
    : ''
}
${
  extension.toLowerCase() === 'png'
    ? 'PNG files are high-quality raster images with transparent backgrounds.'
    : ''
}
${
  extension.toLowerCase() === 'psd'
    ? 'Files are provided as high-quality PNG format due to technical limitations.'
    : ''
}

Generated by Lexis API - Brand Identity System
`;
  }

  /**
   * Récupère le contenu d'un fichier depuis une URL (Firebase Storage ou autre)
   * @param url - URL du fichier à récupérer
   * @returns Le contenu du fichier ou null si erreur
   */
  private async fetchContentFromUrl(url: string): Promise<string | null> {
    try {
      logger.info(`Fetching content from URL: ${url}`);

      // Vérifier si c'est une URL valide
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        logger.warn(`Invalid URL format: ${url}`);
        // Si ce n'est pas une URL, c'est peut-être déjà le contenu SVG
        if (url && url.includes('<svg')) {
          return url;
        }
        return null;
      }

      // Utiliser fetch pour récupérer le contenu
      const response = await fetch(url);

      if (!response.ok) {
        logger.error(`Failed to fetch content from URL: ${url}, status: ${response.status}`);
        return null;
      }

      const content = await response.text();

      // Vérifier que le contenu semble être du SVG
      if (!content.includes('<svg')) {
        logger.warn(`Content from URL ${url} does not appear to be SVG`);
      }

      logger.info(
        `Successfully fetched content from URL: ${url}, length: ${content.length} characters`
      );
      return content;
    } catch (error) {
      logger.error(`Error fetching content from URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Edit an existing logo based on user modification prompt
   * Uses AI to intelligently modify the logo while preserving its core identity
   */
  async editLogo(
    userId: string,
    projectId: string,
    logoSvg: string,
    modificationPrompt: string
  ): Promise<{ logo: LogoModel }> {
    logger.info(
      `Editing logo for userId: ${userId}, projectId: ${projectId}, modification: ${modificationPrompt.substring(
        0,
        100
      )}...`
    );

    setAiUsageContext({
      userId,
      projectId,
      feature: 'branding',
      element: 'logo',
      operation: 'edit',
    });

    try {
      // Get project for context
      const project = await this.getProjectOptimized(userId, projectId);
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Lockup composé : on ne soumet que l'icône. Envoyer le wordmark vectorisé
      // coûterait des milliers de tokens et le modèle le redessinerait de travers,
      // alors qu'il suffit de recomposer après coup.
      const currentLogo = project.analysisResultModel?.branding?.logo;
      const lockup = currentLogo?.lockup;
      let svgForEdit = logoSvg;
      if (lockup && currentLogo?.iconSvg) {
        try {
          svgForEdit = await resolveSvgContent(currentLogo.iconSvg);
        } catch (error) {
          logger.warn(
            `Could not resolve icon SVG for edit, falling back to the full logo: ${(error as Error).message}`
          );
        }
      }

      // Build the edit prompt with current logo and modification request
      const editPrompt = `**CURRENT LOGO SVG:**
\`\`\`svg
${svgForEdit}
\`\`\`

**USER MODIFICATION REQUEST:**
${modificationPrompt}
${lockup ? ICON_ONLY_EDIT_SCOPE : ''}

${LOGO_EDIT_PROMPT}`;

      // Process the edit request with AI
      const steps: IPromptStep[] = [
        {
          promptConstant: editPrompt,
          stepName: 'Logo Edit',
          maxOutputTokens: 3000,
          modelParser: (content) => {
            const parsed = this.parseLogoModelResponse(content);
            if (!parsed || typeof parsed.svg !== 'string' || !parsed.svg.includes('<svg')) {
              logger.error('Error parsing edited logo JSON: no usable SVG in response');
              throw new Error('Failed to parse edited logo JSON');
            }
            return parsed;
          },
          hasDependencies: false,
        },
      ];

      const sectionResults = await this.processSteps(
        steps,
        project,
        BrandingService.LOGO_LLM_CONFIG
      );

      const editedLogoData = sectionResults[0].parsedData;

      // Le nom est reposé par le pipeline, avec la recette d'origine : une
      // édition d'icône ne peut donc plus casser l'alignement ni la typographie.
      const recomposed = lockup
        ? await logoLockupService.compose(editedLogoData.svg, lockup)
        : null;

      // Create the edited logo model
      const editedLogo: LogoModel = {
        id: `edited-${Date.now()}`,
        name: 'Edited Logo',
        concept: editedLogoData.changesSummary || 'User-modified logo',
        colors: [],
        fonts: lockup ? [lockup.fontFamily] : [],
        svg: recomposed?.svg ?? editedLogoData.svg,
        iconSvg: recomposed?.iconSvg ?? this.extractIconFromSvg(editedLogoData.svg),
        ...(recomposed ? { type: currentLogo?.type, lockup: recomposed.spec } : {}),
      };

      // Optimize the edited SVG
      const optimizedLogo = this.optimizeLogoSvgs(editedLogo);

      // Upload the edited SVG (+ icon) to MinIO and replace inline content with URLs
      try {
        const svgUrls = await this.storageService.uploadAllLogoSvgs(
          optimizedLogo,
          userId,
          projectId
        );
        optimizedLogo.svg = svgUrls.svg;
        if (svgUrls.iconSvg) optimizedLogo.iconSvg = svgUrls.iconSvg;
        if (svgUrls.variations) optimizedLogo.variations = svgUrls.variations;
        logger.info(`Edited logo SVGs uploaded to MinIO for projectId: ${projectId}`);
      } catch (uploadError: any) {
        logger.error(`Failed to upload edited logo SVGs (keeping inline): ${uploadError.message}`);
      }

      logger.info(
        `Successfully edited logo for projectId: ${projectId}, changes: ${editedLogoData.changesSummary}`
      );

      return {
        logo: optimizedLogo,
      };
    } catch (error) {
      logger.error(`Error editing logo for projectId: ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Fabrique les pages de mise en situation de la charte.
   *
   * Les N mockups sortent d'UN seul appel — l'analyseur choisit les supports
   * ensemble, pour qu'ils ne se répètent pas — donc les N étapes partagent la
   * même promesse : la première qui s'exécute la déclenche, les suivantes
   * l'attendent. Ce mémo remplace le cache posé sur `global`, qui survivait au
   * projet et resservait ses mockups à la charte suivante.
   *
   * Rend `null` quand l'image manque : une page de charte sans son visuel
   * n'est pas une page, elle ne doit pas être affichée du tout.
   */
  private createMockupPageBuilder(params: {
    project: ProjectModel;
    userId: string;
    projectId: string;
    projectDescription: string;
    pdfFormat?: string;
    artDirection?: ArtDirectionModel | null;
  }): (mockupNumber: number) => Promise<string | null> {
    const { project, userId, projectId, projectDescription, pdfFormat, artDirection } = params;
    let pending: Promise<MockupGenerationResult[]> | null = null;

    const generateAll = (): Promise<MockupGenerationResult[]> => {
      const branding = project.analysisResultModel?.branding;
      if (!branding?.logo || !branding?.colors) {
        return Promise.reject(new Error('Missing branding information (logo or colors)'));
      }

      // On préfère le PNG hébergé (plus léger pour la composition) ; le champ
      // svg reste le repli des projets anciens.
      const logoUrl = branding.logo.assetUrls?.primary || branding.logo.svg;
      const logoVariants: MockupLogoVariants = {
        light: branding.logo.assetUrls?.withText?.lightBackground,
        dark: branding.logo.assetUrls?.withText?.darkBackground,
        monochrome: branding.logo.assetUrls?.withText?.monochrome,
      };

      const brandColors = {
        primary: branding.colors.colors.primary || '#000000',
        secondary: branding.colors.colors.secondary || '#666666',
        accent: branding.colors.colors.accent || '#999999',
      };

      const industry = this.extractProjectContext(projectDescription).industry;

      logger.info('[MOCKUP] Generating every mockup for this brand book (single pass)', {
        projectId,
        industry,
        mockupCount: MOCKUP_CONFIG.MOCKUP_COUNT,
      });

      return geminiMockupService.generateProjectMockups(
        logoUrl,
        brandColors,
        industry,
        project.name,
        projectDescription,
        userId,
        projectId,
        pdfFormat,
        // Les mises en situation appartiennent au même document que les pages
        // qui précèdent : sans la direction artistique elles sortaient dans le
        // rendu « photo de stock » par défaut du modèle, étranger au reste de
        // la charte.
        artDirection,
        logoVariants
      );
    };

    return async (mockupNumber: number): Promise<string | null> => {
      const startedAt = Date.now();
      try {
        if (!pending) {
          pending = generateAll();
        }

        const mockups = await pending;
        const mockup = mockups[mockupNumber - 1];

        if (!mockup?.mockupUrl) {
          logger.warn(`[MOCKUP] No image for mockup ${mockupNumber} — page skipped`, {
            projectId,
            generated: mockups.length,
          });
          return null;
        }

        logger.info(`[MOCKUP] ✅ Mockup ${mockupNumber} ready`, {
          projectId,
          bucketUrl: mockup.mockupUrl,
          supportType: mockup.supportType,
          duration: `${Date.now() - startedAt}ms`,
        });

        // La page est l'image, plein cadre. Tout habillage ajouté ici (titre,
        // légende, dégradé) se superpose à une photographie déjà composée.
        const alt = (mockup.title || mockup.supportName || 'Mockup').replace(/"/g, '&quot;');
        return `<div style="width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;position:relative;overflow:hidden;">
  <img src="${mockup.mockupUrl}" alt="${alt}" style="width:100%;height:100%;object-fit:cover;display:block;" />
</div>`;
      } catch (error: any) {
        logger.error(`[MOCKUP] Mockup ${mockupNumber} unavailable — page skipped`, {
          error: error.message,
          projectId,
          duration: `${Date.now() - startedAt}ms`,
        });
        return null;
      }
    };
  }

  /**
   * Génère les mockups pour la charte graphique finale
   * Le nombre de mockups est configurable via MOCKUP_CONFIG
   * L'IA analyse le projet et choisit automatiquement les supports adaptés
   */
  async generateProjectMockups(userId: string, projectId: string): Promise<any[] | null> {
    try {
      logger.info('🎨 Starting mockup generation for brand identity', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });

      // Récupérer le projet pour obtenir les informations de branding
      const project = await this.getProject(projectId, userId);
      if (!project) {
        logger.error('❌ Project not found for mockup generation', { projectId, userId });
        return null;
      }

      // Extraire les informations nécessaires du projet
      const branding = project.analysisResultModel?.branding;
      if (!branding || !branding.logo || !branding.colors) {
        logger.error('❌ Missing branding information for mockup generation', {
          projectId,
          userId,
          hasLogo: !!branding?.logo,
          hasColors: !!branding?.colors,
        });
        return null;
      }

      // Préparer les données pour la génération de mockups
      const logoSvg = branding.logo.svg;
      const brandColors = {
        primary: branding.colors.colors.primary || '#000000',
        secondary: branding.colors.colors.secondary || '#666666',
        accent: branding.colors.colors.accent || '#999999',
      };

      // Extraire l'industrie réelle depuis la description du projet
      const projectDescription = this.extractProjectDescription(project);
      const projectContext = this.extractProjectContext(projectDescription);
      const industry = projectContext.industry;
      const brandName = project.name;

      logger.info('📋 Mockup generation parameters prepared', {
        projectId,
        brandName,
        industry,
        brandColors,
        hasLogoSvg: !!logoSvg,
        timestamp: new Date().toISOString(),
      });

      // PNG hébergé d'abord : c'est lui qui sera incrusté sur le support, et un
      // SVG inline oblige à une conversion supplémentaire à chaque mockup.
      const logoUrl = branding.logo.assetUrls?.primary || branding.logo.svg;
      const logoVariants: MockupLogoVariants = {
        light: branding.logo.assetUrls?.withText?.lightBackground,
        dark: branding.logo.assetUrls?.withText?.darkBackground,
        monochrome: branding.logo.assetUrls?.withText?.monochrome,
      };

      // Récupérer le format PDF depuis le projet (défaut: SLIDE_16_9)
      const pdfFormat = branding.pdfFormat || 'SLIDE_16_9';

      // Générer les mockups : le service choisit les supports, photographie
      // chacun d'eux à vide, puis y imprime le vrai logo.
      const mockups = await geminiMockupService.generateProjectMockups(
        logoUrl,
        brandColors,
        industry,
        brandName,
        projectDescription,
        userId,
        projectId,
        pdfFormat,
        null,
        logoVariants
      );

      logger.info('✅ Mockups generated successfully for brand identity', {
        projectId,
        userId,
        mockupCount: mockups.length,
        mockupUrls: mockups.map((m) => m.mockupUrl),
        supportTypes: mockups.map((m) => m.supportType),
        timestamp: new Date().toISOString(),
      });

      // Mettre à jour le projet avec les mockups générés
      const updatedProjectData = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: {
            ...branding,
            mockups: mockups.map((mockup, index) => ({
              mockupUrl: mockup.mockupUrl,
              supportType: mockup.supportType,
              supportName: mockup.supportName,
              title: mockup.title,
              description: mockup.description,
              mockupIndex: mockup.mockupIndex,
              priority: mockup.priority,
            })),
            generatedAt: new Date().toISOString(),
          },
        },
      };

      // Sauvegarder le projet mis à jour
      const updatedProject = await this.projectRepository.update(
        projectId,
        updatedProjectData,
        `users/${userId}/projects`
      );

      if (updatedProject) {
        logger.info('💾 Project updated with generated mockups', {
          projectId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      return mockups;
    } catch (error: any) {
      logger.error('❌ Error generating project mockups', {
        error: error.message,
        stack: error.stack,
        projectId,
        userId,
        timestamp: new Date().toISOString(),
      });

      return null;
    }
  }

  /**
   * Generates color palettes and typography based on colors extracted from an imported logo.
   * Primary colors come from the logo; AI proposes complementary secondary/accent/background/text.
   */
  async generateColorsAndTypographyFromLogo(
    userId: string,
    project: ProjectModel,
    logoSvg: string,
    logoColors: string[]
  ): Promise<{
    colors: ColorModel[];
    typography: TypographyModel[];
  }> {
    logger.info(
      `Generating colors and typography from imported logo for userId: ${userId}, logo colors: ${logoColors.join(', ')}`
    );

    // Logo importé déjà sauvegardé côté front (avec ses variations générées à
    // l'import). On le préserve tel quel : cet endpoint génère couleurs et
    // typographies, il ne doit pas remplacer le logo de l'utilisateur.
    const payloadLogo = project.analysisResultModel?.branding?.logo;

    // Réutiliser le projet existant (workflow complete-branding) au lieu de créer
    // un doublon : les couleurs/typographies doivent être persistées sur le projet
    // que le dashboard charge, pas sur un nouveau projet.
    const existingProject = project.id
      ? await this.projectRepository.findById(project.id, `users/${userId}/projects`)
      : null;

    let createdProject: ProjectModel;
    if (existingProject) {
      logger.info(
        `Reusing existing project for logo-based colors/typography - ProjectId: ${existingProject.id}`
      );
      createdProject = {
        ...existingProject,
        analysisResultModel: {
          ...existingProject.analysisResultModel,
          branding: existingProject.analysisResultModel?.branding || BrandIdentityBuilder.createEmpty(),
        },
      };
    } else {
      project = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: BrandIdentityBuilder.createEmpty(),
        },
      };
      createdProject = await projectService.createUserProject(userId, project);
    }

    if (!createdProject.id) {
      throw new Error(`Failed to create project`);
    }

    // Cache le projet
    try {
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, createdProject, {
        prefix: 'project',
        ttl: 3600,
      });
    } catch (error) {
      logger.error(`Error caching project for userId: ${userId}`, error);
    }

    // Contexte projet lu depuis la DB (createdProject), PAS depuis le payload :
    // le front n'envoie plus qu'un projet minimal (id + champs légers) pour éviter
    // le 413, et le projet complet est de toute façon rechargé ici via findById.
    // Ça garantit un prompt fiable même si le payload est réduit à l'id.
    const projectDescription = this.extractProjectDescription(createdProject);

    // Determine primary, secondary colors and style hint from logo colors
    const primaryColor = logoColors.length > 0 ? logoColors[0] : '#6a11cb';
    const secondaryColor = logoColors.length > 1 ? logoColors[1] : primaryColor;
    const logoColorsStr = logoColors.length > 0 ? logoColors.join(', ') : primaryColor;
    const styleHint = this.inferStyleFromColors(logoColors);

    // Build color prompt with logo colors injected (replace all occurrences)
    const colorPrompt =
      projectDescription +
      '\n\n' +
      COLORS_FROM_LOGO_PROMPT.replace(/\{\{LOGO_COLORS\}\}/g, logoColorsStr)
        .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription)
        .replace(/\{\{PRIMARY_FROM_LOGO\}\}/g, primaryColor)
        .replace(/\{\{SECONDARY_FROM_LOGO\}\}/g, secondaryColor);

    // Build typography prompt with logo context
    const typographyPrompt =
      projectDescription +
      '\n\n' +
      TYPOGRAPHY_FROM_LOGO_PROMPT.replace('{{PROJECT_DESCRIPTION}}', projectDescription)
        .replace('{{LOGO_COLORS}}', logoColorsStr)
        .replace('{{STYLE_HINT}}', styleHint);

    const startTime = Date.now();

    // Parallel generation of colors and typography
    const [colors, typography] = await Promise.all([
      this.generateColorsFromLogoPrompt(colorPrompt, createdProject),
      this.generateTypographyFromLogoPrompt(typographyPrompt, createdProject),
    ]);

    const generationTime = Date.now() - startTime;
    logger.info(`Logo-based colors and typography generation completed in ${generationTime}ms`);

    // Préserver le logo déjà persisté (workflow complete-branding) ; repli sur
    // celui du payload si l'écriture front n'a pas encore atteint la base.
    const existingLogo = createdProject.analysisResultModel?.branding?.logo ?? payloadLogo;

    // Generate logo variations (light/dark/monochrome) with the hybrid engine —
    // UNIQUEMENT si le logo n'en a pas déjà (elles sont normalement générées à
    // l'import). Les regénérer ici était redondant et ajoutait une surface
    // d'échec/latence à chaque génération de palette.
    // logo.svg may hold a MinIO URL — resolve it to inline SVG first.
    // Non-fatal: colors/typography must succeed even if variations fail.
    let optimizedVariations = existingLogo?.variations;
    if (!optimizedVariations?.withText) {
      logger.info(`Generating logo variations from imported SVG`);
      try {
        const svgContent = await resolveSvgContent(logoSvg);
        const logoVariations = await generateLogoVariations(svgContent, {
          aiRecolor: (request) => this.aiRecolorLogoVariation(request, createdProject),
        });
        optimizedVariations = {
          withText: this.optimizeVariationSet(logoVariations.withText),
          iconOnly: this.optimizeVariationSet(logoVariations.iconOnly),
        };
      } catch (error) {
        logger.error(`Logo variation generation failed, falling back to no variations:`, error);
      }
    }

    // Upload ALL SVGs (primary + icon + variations) to MinIO and replace inline
    // content with hosted URLs. The inline SVG markup is no longer stored in DB.
    // Non-fatal: the logo is still functional with inline SVG if upload fails.
    let logoSvgUrl = logoSvg; // fallback to inline/existing URL
    let iconSvgUrl = existingLogo?.iconSvg;
    let variationUrls = optimizedVariations;
    try {
      // Resolve logoSvg to inline SVG content for upload (it might already be a URL)
      const inlineSvg = /^https?:\/\//i.test(logoSvg.trim()) ? logoSvg : logoSvg;
      const svgUrls = await this.storageService.uploadAllLogoSvgs(
        { svg: inlineSvg, iconSvg: existingLogo?.iconSvg, variations: optimizedVariations },
        userId,
        createdProject.id
      );
      logoSvgUrl = svgUrls.svg;
      if (svgUrls.iconSvg) iconSvgUrl = svgUrls.iconSvg;
      if (svgUrls.variations) variationUrls = svgUrls.variations;
      logger.info(`Imported logo SVGs uploaded to MinIO`, { projectId: createdProject.id });
    } catch (error) {
      logger.error(`Logo SVG upload failed during branding generation (keeping inline):`, error);
    }

    // Rasterize SVGs to PNG and upload to bucket. PNGs are used in generation
    // contexts (pitch deck, flyers, brand book) as <img> tags.
    // resolveSvgContent() handles both MinIO URLs and inline SVG.
    let logoAssetUrls = existingLogo?.assetUrls;
    if (!logoAssetUrls) {
      try {
        logoAssetUrls = await this.storageService.uploadProjectLogoAssets(
          { svg: logoSvgUrl, iconSvg: iconSvgUrl, variations: variationUrls },
          userId,
          createdProject.id
        );
      } catch (error) {
        logger.error(`Logo PNG asset upload failed during branding generation:`, error);
      }
    }

    // Conserver le logo importé de l'utilisateur (complété des variations si
    // besoin). Ne JAMAIS écrire generatedLogos ici : ce champ est réservé aux
    // logos générés par l'IA — le polluer avec le logo importé faussait la
    // reprise du workflow et l'étape logo-selection.
    const importedLogo: LogoModel = existingLogo
      ? {
          ...existingLogo,
          svg: logoSvgUrl,
          ...(iconSvgUrl ? { iconSvg: iconSvgUrl } : {}),
          ...(variationUrls ? { variations: variationUrls } : {}),
          ...(logoAssetUrls ? { assetUrls: logoAssetUrls } : {}),
        }
      : {
          id: `imported-${Date.now()}`,
          name: 'Imported Logo',
          svg: logoSvgUrl,
          concept: 'User-imported logo',
          colors: logoColors,
          fonts: [],
          ...(iconSvgUrl ? { iconSvg: iconSvgUrl } : {}),
          ...(variationUrls ? { variations: variationUrls } : {}),
          ...(logoAssetUrls ? { assetUrls: logoAssetUrls } : {}),
        };

    const updatedProjectData = {
      ...createdProject,
      analysisResultModel: {
        ...createdProject.analysisResultModel,
        branding: {
          ...createdProject.analysisResultModel?.branding,
          generatedColors: colors,
          generatedTypography: typography,
          logo: importedLogo,
          importedLogoColors: logoColors,
          updatedAt: new Date(),
        },
      },
    };

    const updatedProject = await this.projectRepository.update(
      createdProject.id!,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with logo-based colors and typography - ProjectId: ${createdProject.id}`
      );

      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: 'project',
        ttl: 3600,
      });
    }

    // On ne renvoie QUE les couleurs et typographies. Le projet complet (avec le
    // logo et ses variations SVG inline réattachées) est déjà persisté en DB
    // ci-dessus ; le renvoyer alourdissait inutilement la réponse (sérialisation +
    // transfert + parsing) et le front ne l'exploitait pas.
    return {
      colors,
      typography,
    };
  }

  /**
   * Parse tolérant du JSON renvoyé par le LLM : supprime les fences markdown
   * (```json … ```) et le texte parasite autour de l'objet JSON.
   */
  private parseLlmJson(content: string): Record<string, unknown> {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const jsonStr = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    return JSON.parse(jsonStr);
  }

  /**
   * Generates colors using the logo-based prompt
   */
  private async generateColorsFromLogoPrompt(
    prompt: string,
    project: ProjectModel
  ): Promise<ColorModel[]> {
    logger.info(`Generating colors from logo prompt`);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: 'Colors From Logo Generation',
        modelParser: (content) => {
          try {
            const parsedColors = this.parseLlmJson(content);
            if (!Array.isArray(parsedColors.colors) || parsedColors.colors.length === 0) {
              throw new Error('Response JSON has no non-empty "colors" array');
            }
            return parsedColors.colors;
          } catch (error) {
            logger.error(`Error parsing logo-based colors:`, error);
            throw new Error(`Failed to parse logo-based colors`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.COLORS_LLM_CONFIG
    );
    return sectionResults[0].parsedData as ColorModel[];
  }

  /**
   * Generates typography using the logo-based prompt
   */
  private async generateTypographyFromLogoPrompt(
    prompt: string,
    project: ProjectModel
  ): Promise<TypographyModel[]> {
    logger.info(`Generating typography from logo prompt`);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: 'Typography From Logo Generation',
        modelParser: (content) => {
          try {
            const parsedTypography = this.parseLlmJson(content);
            if (
              !Array.isArray(parsedTypography.typography) ||
              parsedTypography.typography.length === 0
            ) {
              throw new Error('Response JSON has no non-empty "typography" array');
            }
            return parsedTypography.typography;
          } catch (error) {
            logger.error(`Error parsing logo-based typography:`, error);
            throw new Error(`Failed to parse logo-based typography`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.TYPOGRAPHY_LLM_CONFIG
    );
    return sectionResults[0].parsedData as TypographyModel[];
  }

  /**
   * AI fallback for the variation engine QA: returns a bounded color mapping
   * (hex → hex) to fix an unreadable variation. Never touches geometry.
   * Quota check is skipped — this is an internal quality repair, not a user action.
   */
  private async aiRecolorLogoVariation(
    request: AiRecolorRequest,
    project: ProjectModel
  ): Promise<Record<string, string> | null> {
    try {
      const prompt = LOGO_VARIATION_RECOLOR_PROMPT.replace(/\{\{VARIANT\}\}/g, request.variant)
        .replace(/\{\{BACKGROUND\}\}/g, request.background)
        .replace(/\{\{ISSUE\}\}/g, request.issue)
        .replace('{{SVG}}', request.svg);

      const steps: IPromptStep[] = [
        {
          promptConstant: prompt,
          stepName: 'Logo Variation Recolor',
          maxOutputTokens: 800,
          modelParser: (content) => {
            try {
              return JSON.parse(content).mapping;
            } catch (error) {
              logger.error('Error parsing recolor mapping JSON:', error);
              throw new Error('Failed to parse recolor mapping JSON');
            }
          },
          hasDependencies: false,
        },
      ];

      const sectionResults = await this.processSteps(steps, project, {
        ...BrandingService.LOGO_LLM_CONFIG,
        skipQuotaCheck: true,
      });
      const mapping = sectionResults[0].parsedData;
      return mapping && typeof mapping === 'object' ? mapping : null;
    } catch (error) {
      logger.error('AI recolor fallback failed (variation kept as-is):', error);
      return null;
    }
  }

  /**
   * Infers a style hint from logo colors for typography prompt context
   */
  /**
   * Construit le HTML A4 des mockups avec les vraies images générées par Gemini
   * Design dynamique basé sur l'industrie et le contexte du projet
   */
  private buildMockupsHtmlWithRealImages(
    mockupResults: Array<{ url: string; title: string; description: string }>,
    project: ProjectModel
  ): string {
    const branding = project.analysisResultModel?.branding;
    const primaryColor = branding?.colors?.colors?.primary || '#1a1a2e';
    const secondaryColor = branding?.colors?.colors?.secondary || '#16213e';
    const accentColor = branding?.colors?.colors?.accent || '#0f3460';
    const bgColor = branding?.colors?.colors?.background || '#ffffff';
    const textColor = branding?.colors?.colors?.text || '#1f2937';
    const brandName = project.name || 'Brand';

    // Extraire le contexte du projet pour adapter le design
    const projectDescription = this.extractProjectDescription(project);
    const projectContext = this.extractProjectContext(projectDescription);
    const industry = projectContext.industry;

    logger.info('[MOCKUP][HTML] Building dynamic mockup HTML', {
      projectId: project.id,
      industry,
      mockupCount: mockupResults.length,
      brandName,
      primaryColor,
      secondaryColor,
      accentColor,
    });

    const hexToRgba = (hex: string, alpha: number) => {
      try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      } catch {
        return `rgba(0,0,0,${alpha})`;
      }
    };

    // Déterminer si le fond est sombre ou clair pour adapter le texte
    const bgR = parseInt(bgColor.slice(1, 3), 16) || 255;
    const bgG = parseInt(bgColor.slice(3, 5), 16) || 255;
    const bgB = parseInt(bgColor.slice(5, 7), 16) || 255;
    const bgLuminance = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;
    const isDarkBg = bgLuminance < 0.5;
    const subtitleColor = isDarkBg ? 'rgba(255,255,255,0.6)' : '#6b7280';
    const ruleTextColor = isDarkBg ? 'rgba(255,255,255,0.7)' : '#4b5563';
    const ruleBgAlpha = isDarkBg ? 0.15 : 0.06;

    // Titre de section dynamique selon l'industrie
    const sectionTitles: Record<string, { tag: string; title: string; subtitle: string }> = {
      'Delivery & Logistics': {
        tag: 'Logistique',
        title: 'Applications Terrain',
        subtitle: 'Mise en situation de la marque sur les supports de livraison et logistique',
      },
      'Food & Beverage': {
        tag: 'Restauration',
        title: 'Univers Culinaire',
        subtitle: "L'identité visuelle au service de l'expérience gastronomique",
      },
      Healthcare: {
        tag: 'Santé',
        title: 'Environnement Médical',
        subtitle: "La marque au cœur de l'univers de la santé et du bien-être",
      },
      Finance: {
        tag: 'Finance',
        title: 'Image Corporate',
        subtitle: 'Une identité visuelle qui inspire confiance et professionnalisme',
      },
      Education: {
        tag: 'Éducation',
        title: 'Supports Pédagogiques',
        subtitle: "La marque au service de l'apprentissage et de la formation",
      },
      'Retail & E-commerce': {
        tag: 'Commerce',
        title: 'Expérience Client',
        subtitle: "L'identité visuelle en point de vente et en ligne",
      },
      'Sports & Fitness': {
        tag: 'Sport',
        title: 'Univers Sportif',
        subtitle: 'La marque en mouvement, sur le terrain et en salle',
      },
      'Travel & Hospitality': {
        tag: 'Voyage',
        title: 'Expérience Voyageur',
        subtitle: "La marque au service de l'évasion et de l'hospitalité",
      },
      'Beauty & Cosmetics': {
        tag: 'Beauté',
        title: 'Univers Beauté',
        subtitle: "L'élégance de la marque sur les produits et en salon",
      },
      Construction: {
        tag: 'Construction',
        title: 'Présence Chantier',
        subtitle: 'La marque visible et professionnelle sur le terrain',
      },
      'Real Estate': {
        tag: 'Immobilier',
        title: 'Visibilité Terrain',
        subtitle: 'La marque au cœur du marché immobilier',
      },
      Fashion: {
        tag: 'Mode',
        title: 'Univers Mode',
        subtitle: "L'identité visuelle au service du style et de l'élégance",
      },
      Sustainability: {
        tag: 'Durable',
        title: 'Engagement Responsable',
        subtitle: 'La marque engagée pour un avenir durable',
      },
      Technology: {
        tag: 'Tech',
        title: 'Présence Digitale',
        subtitle: "La marque dans l'écosystème numérique et technologique",
      },
    };

    const sectionInfo = sectionTitles[industry] || {
      tag: 'Marque',
      title: 'Applications de Marque',
      subtitle: "Mise en situation de l'identité visuelle dans son environnement",
    };

    // Principes d'application dynamiques selon l'industrie
    const applicationRules: Record<string, Array<{ title: string; text: string }>> = {
      'Delivery & Logistics': [
        {
          title: 'Visibilité',
          text: 'Le logo doit être visible à distance sur les véhicules et emballages, même en mouvement.',
        },
        {
          title: 'Résistance',
          text: 'Les applications doivent résister aux conditions extérieures : pluie, soleil, usure.',
        },
        {
          title: 'Reconnaissance',
          text: 'Le client doit identifier la marque instantanément à la réception du colis.',
        },
      ],
      'Food & Beverage': [
        {
          title: 'Appétence',
          text: "L'identité visuelle doit évoquer la qualité et le plaisir gustatif.",
        },
        {
          title: 'Hygiène',
          text: 'Les supports doivent refléter la propreté et le soin apporté aux produits.',
        },
        {
          title: 'Ambiance',
          text: 'La marque crée une atmosphère cohérente du menu à la décoration intérieure.',
        },
      ],
      Healthcare: [
        {
          title: 'Confiance',
          text: "L'identité visuelle doit inspirer sérénité et professionnalisme médical.",
        },
        {
          title: 'Clarté',
          text: 'Les informations doivent être lisibles et accessibles à tous les patients.',
        },
        {
          title: 'Propreté',
          text: "Le design reflète l'environnement stérile et soigné du milieu médical.",
        },
      ],
      Technology: [
        {
          title: 'Cohérence',
          text: 'Maintenir les couleurs et proportions du logo sur tous les supports numériques.',
        },
        {
          title: 'Adaptabilité',
          text: "Le logo s'adapte parfaitement du favicon à l'affichage grand écran.",
        },
        {
          title: 'Modernité',
          text: "L'interface reflète l'innovation et la fiabilité technologique.",
        },
      ],
      Finance: [
        {
          title: 'Prestige',
          text: "L'identité visuelle doit refléter la solidité et la fiabilité financière.",
        },
        {
          title: 'Sobriété',
          text: 'Un design épuré qui inspire confiance et sérieux professionnel.',
        },
        {
          title: 'Sécurité',
          text: 'Les supports véhiculent un sentiment de protection et de confidentialité.',
        },
      ],
      Education: [
        {
          title: 'Accessibilité',
          text: 'Le logo doit être accueillant et lisible pour tous les publics, jeunes et adultes.',
        },
        {
          title: 'Savoir',
          text: "L'identité visuelle évoque la connaissance, la progression et l'ouverture d'esprit.",
        },
        {
          title: 'Dynamisme',
          text: "Les supports reflètent l'énergie et la motivation liées à l'apprentissage.",
        },
      ],
      'Retail & E-commerce': [
        {
          title: 'Impact',
          text: "Le logo doit capter l'attention immédiatement en vitrine et en ligne.",
        },
        {
          title: 'Premium',
          text: 'Le packaging et les sacs reflètent la qualité et le positionnement de la marque.',
        },
        {
          title: 'Fidélisation',
          text: "L'expérience visuelle cohérente renforce la mémorisation de la marque.",
        },
      ],
      'Sports & Fitness': [
        {
          title: 'Énergie',
          text: "L'identité visuelle doit transmettre dynamisme, force et motivation.",
        },
        {
          title: 'Performance',
          text: "Les supports sportifs doivent résister à l'usage intensif et rester visibles.",
        },
        {
          title: 'Communauté',
          text: "La marque fédère et crée un sentiment d'appartenance chez les sportifs.",
        },
      ],
      'Travel & Hospitality': [
        {
          title: 'Évasion',
          text: "L'identité visuelle évoque le voyage, la découverte et le dépaysement.",
        },
        {
          title: 'Confort',
          text: "Les supports reflètent l'hospitalité, le luxe et l'attention aux détails.",
        },
        {
          title: 'Mémorabilité',
          text: 'Le voyageur garde un souvenir positif de la marque après son expérience.',
        },
      ],
      'Beauty & Cosmetics': [
        {
          title: 'Élégance',
          text: 'Le packaging et les supports doivent respirer le luxe et le raffinement.',
        },
        {
          title: 'Sensorialité',
          text: "L'identité visuelle éveille les sens et évoque la beauté et le bien-être.",
        },
        {
          title: 'Exclusivité',
          text: 'Chaque application renforce le positionnement premium de la marque.',
        },
      ],
      Construction: [
        {
          title: 'Robustesse',
          text: 'Le logo doit être visible et lisible même sur des supports de chantier.',
        },
        {
          title: 'Sécurité',
          text: 'Les applications respectent les normes de visibilité et de sécurité.',
        },
        {
          title: 'Professionnalisme',
          text: "L'identité visuelle inspire confiance et compétence technique.",
        },
      ],
      'Real Estate': [
        {
          title: 'Prestige',
          text: "L'identité visuelle reflète la valeur et la qualité des biens proposés.",
        },
        {
          title: 'Visibilité',
          text: 'Le logo doit être impactant sur les panneaux, en agence et en ligne.',
        },
        {
          title: 'Confiance',
          text: "Les supports inspirent la fiabilité et l'expertise du marché immobilier.",
        },
      ],
      Fashion: [
        {
          title: 'Style',
          text: "L'identité visuelle incarne l'esthétique et la créativité de la marque.",
        },
        {
          title: 'Tendance',
          text: "Les applications reflètent la modernité et l'avant-garde du secteur.",
        },
        {
          title: 'Distinction',
          text: 'Chaque support renforce le caractère unique et reconnaissable de la marque.',
        },
      ],
      Sustainability: [
        {
          title: 'Authenticité',
          text: "L'identité visuelle reflète l'engagement sincère pour l'environnement.",
        },
        {
          title: 'Nature',
          text: 'Les supports évoquent la connexion avec la nature et le développement durable.',
        },
        {
          title: 'Responsabilité',
          text: 'Les matériaux et applications respectent les principes éco-responsables.',
        },
      ],
    };

    const rules = applicationRules[industry] || [
      {
        title: 'Cohérence',
        text: 'Maintenir les couleurs et proportions du logo sur tous les supports.',
      },
      {
        title: 'Lisibilité',
        text: "Le logo reste lisible et impactant quelle que soit la taille d'application.",
      },
      {
        title: 'Zone de protection',
        text: 'Respecter un espace minimum autour du logo pour garantir sa visibilité.',
      },
    ];

    // Construire les cartes de mockup
    const mockupCards = mockupResults
      .map((mockup, index) => {
        const isFirst = index === 0;
        const cardHeight = mockupResults.length === 1 ? '100%' : isFirst ? '55%' : '42%';

        return `<div style="width:100%;height:${cardHeight};position:relative;overflow:hidden;border-radius:12px;box-shadow:0 8px 32px ${hexToRgba(primaryColor, 0.12)},0 2px 8px rgba(0,0,0,0.06);">
        <img src="${mockup.url}" alt="${mockup.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <div style="position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(transparent,rgba(0,0,0,0.75));">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <div style="width:6px;height:6px;border-radius:50%;background:${isFirst ? primaryColor : accentColor};"></div>
            <div style="font-size:12px;font-weight:700;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${mockup.title}</div>
          </div>
          <div style="font-size:9px;color:rgba(255,255,255,0.85);line-height:1.4;padding-left:14px;">${mockup.description}</div>
        </div>
      </div>`;
      })
      .join('\n');

    // Construire les règles
    const rulesHtml = rules
      .map((rule, index) => {
        const colors = [primaryColor, accentColor, secondaryColor];
        const color = colors[index % colors.length];
        return `<div style="flex:1;padding:10px 14px;background:${hexToRgba(color, ruleBgAlpha)};border-radius:8px;border-left:3px solid ${color};">
        <div style="font-size:9px;font-weight:700;color:${color};margin-bottom:2px;">${rule.title}</div>
        <div style="font-size:8px;color:${ruleTextColor};line-height:1.5;">${rule.text}</div>
      </div>`;
      })
      .join('\n');

    const html = `<div style="width:210mm;height:297mm;overflow:hidden;position:relative;background:${bgColor};padding:0;box-sizing:border-box;font-family:'Inter','Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;">
  <div style="position:absolute;top:0;right:0;width:45%;height:200px;background:linear-gradient(135deg,${hexToRgba(primaryColor, 0.05)},${hexToRgba(accentColor, 0.02)});border-bottom-left-radius:120px;"></div>
  <div style="position:absolute;bottom:0;left:0;width:35%;height:100px;background:linear-gradient(45deg,${hexToRgba(accentColor, 0.03)},transparent);border-top-right-radius:80px;"></div>
  <div style="position:relative;z-index:1;padding:10mm 12mm 8mm 12mm;display:flex;flex-direction:column;height:100%;gap:16px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;">
      <div>
        <div style="display:inline-block;padding:3px 10px;background:${primaryColor};color:white;border-radius:4px;font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${sectionInfo.tag}</div>
        <h2 style="margin:0;font-size:26px;font-weight:900;color:${primaryColor};letter-spacing:-0.5px;line-height:1.1;">${sectionInfo.title}</h2>
        <p style="margin:5px 0 0 0;font-size:10px;color:${subtitleColor};font-weight:400;">${sectionInfo.subtitle}</p>
      </div>
      <div style="display:flex;gap:5px;align-items:center;">
        <div style="width:20px;height:20px;border-radius:50%;background:${primaryColor};"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:${secondaryColor};"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:${accentColor};"></div>
      </div>
    </div>
    <div style="width:50px;height:3px;background:linear-gradient(90deg,${primaryColor},${accentColor});border-radius:2px;"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:12px;min-height:0;">
      ${mockupCards}
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;padding-top:8px;">
      ${rulesHtml}
    </div>
  </div>
</div>`;

    logger.info('[MOCKUP][HTML] Dynamic HTML built successfully', {
      projectId: project.id,
      industry,
      htmlLength: html.length,
      mockupCount: mockupResults.length,
      rulesCount: rules.length,
      sectionTitle: sectionInfo.title,
    });

    return html;
  }

  private inferStyleFromColors(colors: string[]): string {
    if (colors.length === 0) return 'modern and professional';

    // Simple heuristic based on color characteristics
    const primary = colors[0].toLowerCase();
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);

    if (r > 200 && g < 100 && b < 100) return 'bold and energetic';
    if (r < 100 && g < 100 && b > 200) return 'professional and trustworthy';
    if (r < 100 && g > 200 && b < 100) return 'natural and fresh';
    if (r > 200 && g > 150 && b < 100) return 'warm and creative';
    if (r > 150 && g < 100 && b > 150) return 'luxurious and innovative';
    if (r < 80 && g < 80 && b < 80) return 'minimalist and elegant';
    return 'modern and versatile';
  }
}
