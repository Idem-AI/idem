/**
 * Changer l'identité visuelle d'un projet — logo, couleurs, polices — et la
 * voir appliquée PARTOUT, sans IA.
 *
 *   1. La nouvelle identité est construite et vérifiée en code : palette
 *      harmonisée (`paletteHarmony`), déclinaisons du logo produites par le
 *      moteur déterministe, PNG hébergés, feuille de polices résolue.
 *   2. Deux tables de jetons, avant et après, donnent la traduction de chaque
 *      rôle (`brandRewrite`).
 *   3. Chaque support enregistré est traduit : charte, business plans, pitch
 *      decks, cartes de visite, visuels de communication, documents
 *      juridiques — puis le code du site.
 *   4. Les caches qui en dépendent tombent d'eux-mêmes (clés adressées par le
 *      contenu) ou sont invalidés ici (PNG des visuels).
 *
 * Chaque support modifié donne une révision dans l'historique du projet : un
 * changement d'identité s'annule comme n'importe quelle modification. L'audit
 * de cohérence — qui, lui, appelle un modèle — n'est PAS déclenché : une
 * traduction de jetons ne change pas le fond d'un document.
 */

import logger from '../../config/logger';
import minioConnection from '../../config/minio.config';
import { BrandFontModel, BrandIdentityModel, ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { LogoModel, LogoVariations } from '../../models/logo.model';
import { ProjectModel } from '../../models/project.model';
import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { brandFontsHref } from '../../utils/google-fonts.util';
import { setRevisionNote, suppressCoherenceTrigger } from '../../utils/revision-context.util';
import { resolveSvgContent } from '../logo-import.service';
import { invalidateVisualImage } from '../Communication/visualImageCache';
import { generateLogoVariations } from '../logoVariationEngine.service';
import { customFontService } from '../customFont.service';
import { storageService } from '../storage.service';
import {
  addStats,
  buildBrandRewriteMap,
  describeRewrite,
  emptyStats,
  isEmptyRewrite,
  rewriteBrandDeep,
  RewriteStats,
} from './brandRewrite';
import { BrandPalette, computeBrandTokens, normalizeHex, PaletteRole, readPalette } from './brandTokens';
import { harmonizePalette, HarmonizeResult, paletteFromLogoColors } from './paletteHarmony';
import { SiteSyncResult, syncSiteBrand } from './siteBrandSync';

// ─── Contrat ────────────────────────────────────────────────────────────────

export interface IdentityLogoInput {
  /** Reprendre un logo déjà proposé au projet (`generatedLogos[].id`). */
  generatedLogoId?: string;
  /** Ou un nouveau logo : URL hébergée (import) ou SVG en ligne. */
  svg?: string;
  iconSvg?: string;
  variations?: LogoVariations;
  name?: string;
  concept?: string;
  /** Couleurs extraites du logo (réponse de `/logo-import/import`). */
  colors?: string[];
}

export interface IdentityTypographyInput {
  primary?: Pick<BrandFontModel, 'family'> & Partial<BrandFontModel>;
  secondary?: Pick<BrandFontModel, 'family'> & Partial<BrandFontModel>;
}

export interface IdentityUpdateRequest {
  logo?: IdentityLogoInput;
  colors?: Partial<BrandPalette>;
  /** Rôles à conserver tels quels pendant l'harmonisation. */
  keepColors?: PaletteRole[];
  /** Reconstruire la palette à partir des couleurs du nouveau logo. */
  colorsFromLogo?: boolean;
  typography?: IdentityTypographyInput;
  /** Calculer sans rien écrire : l'aperçu de ce qui va changer. */
  dryRun?: boolean;
}

export interface SupportReport {
  key: string;
  label: string;
  /** Pages, visuels ou documents examinés. */
  items: number;
  /** Ceux qui portaient l'ancienne identité et ont été mis à jour. */
  updated: number;
}

export interface IdentityUpdateReport {
  dryRun: boolean;
  changed: { logo: boolean; colors: boolean; typography: boolean };
  fingerprint: { before: string; after: string };
  palette?: HarmonizeResult;
  branding: Pick<BrandIdentityModel, 'logo' | 'colors' | 'typography'>;
  supports: SupportReport[];
  site?: SiteSyncResult & { error?: string };
  stats: RewriteStats;
}

export class IdentityInputError extends Error {}

// ─── Supports ───────────────────────────────────────────────────────────────

type AnalysisResult = NonNullable<ProjectModel['analysisResultModel']>;

interface SupportDefinition {
  key: string;
  label: string;
  /** Chemin d'écriture en base (sous le projet). */
  path: string;
  read: (analysis: AnalysisResult) => unknown;
  /** Nombre d'éléments affichables, pour le rapport. */
  count: (value: any) => number;
}

const sectionCount = (value: any) => (Array.isArray(value?.sections) ? value.sections.length : 0);
const documentsCount = (value: any) =>
  Array.isArray(value) ? value.reduce((sum, doc) => sum + sectionCount(doc), 0) : 0;

/**
 * Tous les supports qui figent l'identité dans leur contenu.
 *
 * Absents volontairement : la finance et les bannières sociales, rendues à la
 * demande depuis la marque courante (leur clé change avec elle), et la marque
 * elle-même, qui est la source.
 */
const SUPPORTS: SupportDefinition[] = [
  {
    key: 'charter',
    label: 'Charte graphique',
    path: 'analysisResultModel.branding.sections',
    read: (a) => a.branding?.sections,
    count: (v) => (Array.isArray(v) ? v.length : 0),
  },
  {
    key: 'businessPlan',
    label: 'Business plan',
    path: 'analysisResultModel.businessPlan',
    read: (a) => a.businessPlan,
    count: sectionCount,
  },
  {
    key: 'businessPlans',
    label: 'Business plans',
    path: 'analysisResultModel.businessPlans',
    read: (a) => a.businessPlans,
    count: documentsCount,
  },
  {
    key: 'pitchDeck',
    label: 'Pitch deck',
    path: 'analysisResultModel.pitchDeck',
    read: (a) => a.pitchDeck,
    count: sectionCount,
  },
  {
    key: 'pitchDecks',
    label: 'Pitch decks',
    path: 'analysisResultModel.pitchDecks',
    read: (a) => a.pitchDecks,
    count: documentsCount,
  },
  {
    key: 'businessCard',
    label: 'Cartes de visite',
    path: 'analysisResultModel.businessCard',
    read: (a) => (a as any).businessCard,
    count: sectionCount,
  },
  {
    key: 'visuals',
    label: 'Visuels de communication',
    path: 'analysisResultModel.communication.visuals',
    read: (a) => a.communication?.visuals,
    count: (v) => (Array.isArray(v) ? v.length : 0),
  },
  {
    key: 'flyers',
    label: 'Visuels (ancien format)',
    path: 'analysisResultModel.communication.flyers',
    read: (a) => a.communication?.flyers,
    count: (v) => (Array.isArray(v) ? v.length : 0),
  },
  {
    key: 'legalDocs',
    label: 'Documents juridiques',
    path: 'analysisResultModel.legalDocs',
    read: (a) => a.legalDocs,
    count: sectionCount,
  },
];

/** Éléments d'un support qui ont réellement changé (par identité d'objet). */
function countUpdated(before: unknown, after: unknown): number {
  if (before === after) return 0;
  const children = (value: any): unknown[] => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => (Array.isArray(item?.sections) ? item.sections : [item]));
    }
    return Array.isArray(value?.sections) ? value.sections : [value];
  };
  const a = children(before);
  const b = children(after);
  return b.filter((item, index) => item !== a[index]).length;
}

// ─── Construction de la nouvelle identité ──────────────────────────────────

const VARIANTS = ['lightBackground', 'darkBackground', 'monochrome'] as const;

function hasAllVariations(variations?: LogoVariations): boolean {
  return !!variations?.withText && VARIANTS.every((variant) => !!variations.withText?.[variant]);
}

/** L'URL désigne-t-elle un fichier du dossier de CET utilisateur ? */
function isOwnStorageUrl(value: string, userId: string): boolean {
  if (!/^https?:\/\//.test(value) || value.includes('..')) return false;
  return value.startsWith(minioConnection.getPublicUrl(`users/${userId}/`));
}

/** Ne garde que les déclinaisons hébergées chez l'utilisateur. */
function keepOwnVariations(variations: LogoVariations | undefined, userId: string): LogoVariations | undefined {
  if (!variations) return undefined;
  const kept: LogoVariations = {};
  for (const category of ['withText', 'iconOnly'] as const) {
    const set = variations[category];
    if (!set) continue;
    const own = Object.fromEntries(
      VARIANTS.filter((variant) => typeof set[variant] === 'string' && isOwnStorageUrl(set[variant]!, userId)).map(
        (variant) => [variant, set[variant]]
      )
    );
    if (Object.keys(own).length) kept[category] = own as LogoVariations['withText'];
  }
  return Object.keys(kept).length ? kept : undefined;
}

export class BrandSyncService {
  private readonly projectRepository: IRepository<ProjectModel>;

  constructor() {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  /**
   * Déclinaisons claires, sombres et monochromes, produites et hébergées.
   * Le moteur est déterministe : aucun rappel au modèle n'est branché ici.
   */
  private async ensureVariations(
    logo: LogoModel,
    userId: string,
    projectId: string
  ): Promise<LogoModel> {
    if (hasAllVariations(logo.variations)) return logo;

    const svgContent = await resolveSvgContent(logo.svg);
    if (!svgContent?.includes('<svg')) return logo;

    const generated = await generateLogoVariations(svgContent);
    const folderPath = `users/${userId}/projects/${projectId}/logos`;
    const stamp = Date.now();
    const upload = async (category: 'withText' | 'iconOnly', variant: (typeof VARIANTS)[number]) => {
      const content = generated[category]?.[variant];
      if (!content?.trim()) return undefined;
      const slug = category === 'withText' ? 'with-text' : 'icon-only';
      return storageService.uploadSvgFile(content, `logo-${slug}-${variant}-${stamp}.svg`, folderPath);
    };

    const variations: LogoVariations = { withText: {} as any, iconOnly: {} as any };
    await Promise.all(
      (['withText', 'iconOnly'] as const).flatMap((category) =>
        VARIANTS.map(async (variant) => {
          const url = await upload(category, variant);
          if (url) (variations[category] as Record<string, string>)[variant] = url;
        })
      )
    );

    return {
      ...logo,
      variations: {
        withText: { ...variations.withText, ...logo.variations?.withText },
        iconOnly: { ...variations.iconOnly, ...logo.variations?.iconOnly },
      } as LogoVariations,
    };
  }

  private async buildLogo(
    input: IdentityLogoInput,
    branding: Partial<BrandIdentityModel>,
    userId: string,
    projectId: string,
    dryRun: boolean
  ): Promise<LogoModel> {
    let logo: LogoModel;
    if (input.generatedLogoId) {
      const found = branding.generatedLogos?.find((candidate) => candidate.id === input.generatedLogoId);
      if (!found) throw new IdentityInputError(`Logo ${input.generatedLogoId} introuvable dans ce projet.`);
      logo = { ...found };
    } else {
      // Un nouveau logo passe OBLIGATOIREMENT par `/logo-import/import`, qui
      // nettoie le SVG (scripts, références externes) et le dépose dans le
      // dossier de l'utilisateur. Un SVG brut ou une URL tierce finirait tel
      // quel dans chaque page de chaque document.
      const svg = input.svg?.trim() ?? '';
      if (!isOwnStorageUrl(svg, userId)) {
        throw new IdentityInputError('Le nouveau logo doit d’abord être importé (URL de votre espace de stockage).');
      }
      const variations = keepOwnVariations(input.variations, userId);
      const iconSvg = input.iconSvg && isOwnStorageUrl(input.iconSvg, userId) ? input.iconSvg : undefined;
      logo = {
        id: `logo-${Date.now()}`,
        name: input.name?.trim().slice(0, 120) || branding.logo?.name || 'Logo',
        svg,
        ...(iconSvg ? { iconSvg } : {}),
        concept: input.concept?.trim().slice(0, 2000) || '',
        colors: (input.colors ?? []).map(normalizeHex).filter(Boolean).slice(0, 12),
        fonts: [],
        ...(variations ? { variations } : {}),
      };
    }

    if (dryRun) return logo;

    // Un concept proposé par la génération est souvent encore en SVG EN LIGNE :
    // il est déposé dans le stockage avant d'être propagé, sinon chaque page de
    // chaque document recevrait sa copie du SVG au lieu d'une URL.
    if (logo.svg.includes('<svg') || logo.iconSvg?.includes('<svg')) {
      const hosted = await storageService.uploadAllLogoSvgs(logo, userId, projectId);
      logo = {
        ...logo,
        svg: hosted.svg,
        ...(hosted.iconSvg ? { iconSvg: hosted.iconSvg } : {}),
        ...(hosted.variations ? { variations: hosted.variations } : {}),
      };
    }

    logo = await this.ensureVariations(logo, userId, projectId);
    // Les PNG sont ce que lisent les rendus (PDF, visuels, bannières) : un
    // logo sans eux retomberait sur le SVG et perdrait ses déclinaisons.
    logo.assetUrls = await storageService.uploadProjectLogoAssets(logo, userId, projectId);
    return logo;
  }

  /**
   * Police choisie dans le panneau. Pour une police IMPORTÉE, la famille, la
   * feuille et les fichiers sont relus depuis la police enregistrée de
   * l'utilisateur : ce sont eux qui chargent la police dans les rendus et
   * remplissent le ZIP d'assets, ils ne viennent donc jamais du navigateur.
   */
  private async resolveFont(
    font: IdentityTypographyInput['primary'],
    userId: string
  ): Promise<BrandFontModel | undefined> {
    const family = font?.family?.trim();
    if (!family) return undefined;

    if (font?.source === 'custom') {
      // Un identifiant mal formé fait échouer la requête : c'est une police
      // introuvable, pas une erreur serveur.
      const stored = font.customFontId
        ? await customFontService.getFont(userId, font.customFontId).catch(() => null)
        : null;
      if (!stored) throw new IdentityInputError(`La police importée « ${family} » est introuvable.`);
      return {
        family: stored.family,
        source: 'custom',
        cssUrl: stored.cssUrl,
        category: stored.category,
        weights: stored.weights,
        customFontId: stored.id,
        files: stored.files,
      };
    }

    return {
      family,
      source: font?.source ?? 'google',
      cssUrl: font?.cssUrl,
      category: font?.category,
      weights: font?.weights,
    };
  }

  private async buildTypography(
    input: IdentityTypographyInput,
    current: TypographyModel | undefined,
    userId: string
  ): Promise<TypographyModel> {
    const [chosenPrimary, chosenSecondary] = await Promise.all([
      this.resolveFont(input.primary, userId),
      this.resolveFont(input.secondary, userId),
    ]);

    const primary = chosenPrimary ?? current?.primary ?? undefined;
    const secondary = chosenSecondary ?? current?.secondary ?? undefined;
    const primaryFont = primary?.family ?? current?.primaryFont ?? '';
    const secondaryFont = secondary?.family ?? current?.secondaryFont ?? primaryFont;
    if (!primaryFont) throw new IdentityInputError('Une police de titre est requise.');

    const next: TypographyModel = {
      id: current?.id || `typography-${Date.now()}`,
      name: current?.name || 'Typographie de la marque',
      url: '',
      primaryFont,
      secondaryFont,
      description: current?.description,
      primary: primary ?? { family: primaryFont, source: 'google' },
      secondary: secondary ?? { family: secondaryFont, source: 'google' },
    };
    next.url = brandFontsHref(next);
    // La justification de l'ancien appariement ne décrit plus celui-ci.
    if (primaryFont !== current?.primaryFont || secondaryFont !== current?.secondaryFont) {
      delete next.rationale;
      next.name = 'Typographie personnalisée';
    }
    return next;
  }

  // ─── Point d'entrée ────────────────────────────────────────────────────

  /** Harmonise une palette sans rien écrire — l'aperçu du sélecteur. */
  previewPalette(
    current: Partial<BrandPalette>,
    changes: Partial<BrandPalette>,
    keep?: PaletteRole[]
  ): HarmonizeResult {
    return harmonizePalette({ current, changes, keep });
  }

  async updateIdentity(
    userId: string,
    projectId: string,
    request: IdentityUpdateRequest
  ): Promise<IdentityUpdateReport | null> {
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`, {
      bypassCache: true,
    });
    if (!project) return null;

    const analysis = (project.analysisResultModel ?? {}) as AnalysisResult;
    const before: Partial<BrandIdentityModel> = analysis.branding ?? {};
    const dryRun = request.dryRun === true;

    if (!request.logo && !request.colors && !request.typography && !request.colorsFromLogo) {
      throw new IdentityInputError('Rien à modifier : fournir un logo, des couleurs ou des polices.');
    }

    // ── 1. La nouvelle identité ────────────────────────────────────────
    const next: Partial<BrandIdentityModel> = { ...before };

    if (request.logo) {
      next.logo = await this.buildLogo(request.logo, before, userId, projectId, dryRun);
      // L'ancien logo reste proposé : revenir en arrière ne doit rien coûter.
      if (before.logo?.svg && !before.generatedLogos?.some((logo) => logo.id === before.logo!.id)) {
        next.generatedLogos = [...(before.generatedLogos ?? []), before.logo];
      }
    }

    let palette: HarmonizeResult | undefined;
    const currentPalette = readPalette(before);
    if (request.colorsFromLogo) {
      const logoColors = next.logo?.colors?.length ? next.logo.colors : before.logo?.colors ?? [];
      if (!logoColors.length) throw new IdentityInputError("Le logo ne porte aucune couleur exploitable.");
      palette = paletteFromLogoColors(logoColors, currentPalette);
    } else if (request.colors) {
      palette = harmonizePalette({ current: currentPalette, changes: request.colors, keep: request.keepColors });
    }

    if (palette) {
      const previous: Partial<ColorModel> = before.colors ?? {};
      const primaryChanged = palette.palette.primary !== currentPalette.primary;
      next.colors = {
        id: previous.id || `palette-${Date.now()}`,
        name: primaryChanged ? 'Palette personnalisée' : previous.name || 'Palette de la marque',
        url: previous.url || '',
        colors: { ...palette.palette },
      };
    }

    if (request.typography) {
      next.typography = await this.buildTypography(request.typography, before.typography, userId);
    }

    const tokensBefore = computeBrandTokens(before);
    const tokensAfter = computeBrandTokens(next);
    const changed = {
      logo: JSON.stringify(tokensBefore.logos) !== JSON.stringify(tokensAfter.logos),
      colors: JSON.stringify(tokensBefore.palette) !== JSON.stringify(tokensAfter.palette),
      typography: JSON.stringify(tokensBefore.fonts) !== JSON.stringify(tokensAfter.fonts),
    };

    // ── 2. La traduction ───────────────────────────────────────────────
    const map = buildBrandRewriteMap(before, next);
    logger.info(`Identité ${projectId} : ${describeRewrite(map)}`, { dryRun, changed });

    // ── 3. Les supports ────────────────────────────────────────────────
    const stats = emptyStats();
    const supports: SupportReport[] = [];
    const writes: Record<string, unknown> = {};

    for (const support of SUPPORTS) {
      const value = support.read(analysis);
      if (value === undefined || value === null) continue;
      const supportStats = emptyStats();
      const rewritten = isEmptyRewrite(map) ? value : rewriteBrandDeep(value, map, supportStats);
      addStats(stats, supportStats);
      const updated = countUpdated(value, rewritten);
      supports.push({ key: support.key, label: support.label, items: support.count(value), updated });
      if (rewritten !== value) writes[support.path] = rewritten;
    }

    const report: IdentityUpdateReport = {
      dryRun,
      changed,
      fingerprint: { before: tokensBefore.fingerprint, after: tokensAfter.fingerprint },
      palette,
      branding: { logo: next.logo!, colors: next.colors!, typography: next.typography! },
      supports,
      stats,
    };

    if (dryRun) return report;

    // ── 4. L'écriture — une seule, pour une révision cohérente ──────────
    const note = [
      changed.logo && 'logo',
      changed.colors && 'couleurs',
      changed.typography && 'polices',
    ]
      .filter(Boolean)
      .join(', ');
    setRevisionNote(`Identité visuelle mise à jour (${note || 'aucun changement'}) et propagée à tous les supports`);
    suppressCoherenceTrigger();

    const brandingWrites: Record<string, unknown> = {};
    if (request.logo) {
      brandingWrites['analysisResultModel.branding.logo'] = next.logo;
      if (next.generatedLogos !== before.generatedLogos) {
        brandingWrites['analysisResultModel.branding.generatedLogos'] = next.generatedLogos;
      }
    }
    if (palette) brandingWrites['analysisResultModel.branding.colors'] = next.colors;
    if (request.typography) brandingWrites['analysisResultModel.branding.typography'] = next.typography;

    await this.projectRepository.update(
      projectId,
      { ...brandingWrites, ...writes } as any,
      `users/${userId}/projects`
    );

    // ── 5. Ce qui vit hors du document projet ──────────────────────────
    await this.invalidateVisualImages(projectId, analysis, writes);

    try {
      report.site = await syncSiteBrand(userId, project, before, next);
      addStats(stats, report.site.stats);
    } catch (error: any) {
      // Le site est un support parmi d'autres : son échec est rapporté, il
      // n'annule pas ce qui a déjà été propagé.
      logger.error(`Propagation au site échouée pour ${projectId} : ${error.message}`, { stack: error.stack });
      report.site = { hasSite: true, filesChanged: 0, forged: false, stats: emptyStats(), error: error.message };
    }

    return report;
  }

  /**
   * Les PNG des visuels sont mis en cache 24 h sous une URL qui ne change
   * jamais : sans invalidation, l'ancienne marque resterait affichée.
   */
  private async invalidateVisualImages(
    projectId: string,
    analysis: AnalysisResult,
    writes: Record<string, unknown>
  ): Promise<void> {
    const ids = new Set<string>();
    for (const path of ['analysisResultModel.communication.visuals', 'analysisResultModel.communication.flyers']) {
      const after = writes[path] as Array<{ id?: string }> | undefined;
      if (!after) continue;
      const before = (path.endsWith('visuals') ? analysis.communication?.visuals : analysis.communication?.flyers) ?? [];
      after.forEach((visual, index) => {
        if (visual?.id && visual !== before[index]) ids.add(visual.id);
      });
    }
    if (ids.size === 0) return;

    await Promise.all([...ids].map((id) => invalidateVisualImage(projectId, id)));
  }
}

export const brandSyncService = new BrandSyncService();
