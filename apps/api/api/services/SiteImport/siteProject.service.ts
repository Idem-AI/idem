/**
 * UN PROJET IDEM À PARTIR D'UN SITE — l'utilisateur colle le lien de son site (iVision), IDEM en fait un
 * projet complet, comme s'il l'avait créé lui-même :
 *
 *   1. le site est lu (moteur partagé `apps/ivision/core/src/site`) : couleurs par usage, polices et leurs
 *      fichiers `@font-face`, logo, textes, style relevé (typographie, formes) et lu sur la capture ;
 *   2. le PROJET : nom, description courte et détaillée, type, cible, portée — rédigés depuis les textes du
 *      site, jamais inventés ;
 *   3. l'IDENTITÉ : le logo du site vectorisé (couleurs gardées) et ses déclinaisons (texte / icône × fond
 *      clair, sombre, monochrome) ; les trois palettes ; la typographie — la police du site si un catalogue
 *      public la sert (Google, Fontshare, Fontsource), sinon SES FICHIERS recopiés dans notre stockage
 *      (`customFontService`) ; la direction artistique, qui CODIFIE le style du site ; les motifs signature ;
 *   4. le document de la charte se génère dans IDEM, quand l'utilisateur l'ouvre (parcours et prix habituels).
 *
 * Le même site relu rouvre le même projet (aucun doublon). L'avancement est tenu dans le cache partagé :
 * iVision le suit étape par étape (`siteImportJobs`).
 */
import crypto from 'crypto';
import sharp from 'sharp';
import logger from '../../config/logger';
import type { ProjectModel } from '../../models/project.model';
import type { BrandFontModel, ColorModel, TypographyModel } from '../../models/brand-identity.model';
import type { LogoModel } from '../../models/logo.model';
import { cacheService } from '../cache.service';
import { customFontService, detectFormat } from '../customFont.service';
import { fontCatalogService } from '../font-catalog.service';
import { processLogoImport } from '../logo-import.service';
import { generateLogoVariations } from '../logoVariationEngine.service';
import { projectService } from '../project.service';
import { policyAcceptanceService } from '../policyAcceptance.service';
import { PromptService } from '../prompt.service';
import { storageService } from '../storage.service';
import { BrandingService } from '../BandIdentity/branding.service';
import { parseLlmJson } from '../../utils/llm-json.util';
import { normalizeSiteUrl, scanWebsite, SiteFontFace, SiteScanResult } from '../../../../ivision/core/src/site/site-scanner';
import { safeFetch } from '../../../../ivision/core/src/render/safe-fetch';
import { crawlWebsite, SiteInventory } from '../../../../ivision/core/src/site/site-crawler';
import { BrandCheck, checkBrandColors } from './brandCheck';

/** Les modèles de l'hôte (passerelle iVision : mêmes étages, même suivi d'usage). */
export interface SiteImportPorts {
  text: (system: string, user: string, tier: 'mechanical' | 'writing') => Promise<string>;
  vision: (base64: string, mimeType: string, instruction: string) => Promise<string>;
}

export type SiteImportStep = 'open' | 'colors' | 'fonts' | 'logo' | 'content' | 'voice' | 'art' | 'done' | 'project' | 'logo-variations' | 'typography' | 'art-direction' | 'patterns' | 'pages' | 'assets';

export interface SiteImportResult {
  projectId: string;
  /** Le projet existait déjà pour ce site : rouvert, pas recréé. */
  reused: boolean;
  name: string;
  siteUrl: string;
  /** Les grandes images du site (URL d'origine) : l'hôte les recopie s'il en a l'usage. */
  images: string[];
  logo: boolean;
  /** Les polices : d'un catalogue public, ou recopiées depuis le site. */
  fonts: { display: string; body: string; copied: string[] };
  warnings: string[];
  /**
   * Ce que le site DIT et MONTRE, pour le refaire (iCode) : ses textes, son ton, son style relevé, et ses
   * photos recopiées chez nous — le nouveau site remplacera l'ancien, ses images ne doivent pas en dépendre.
   * Présent seulement quand l'import le demande (`withContent`).
   */
  content?: SiteContent;
}

export interface SiteContent {
  url: string;
  title: string;
  description?: string;
  language: string;
  headings: string[];
  paragraphs: string[];
  voice: SiteScanResult['voice'];
  styleEvidence: string;
  pages: string[];
  /** Les photos du site, hébergées chez nous (URL publiques durables), dans l'ordre du site. */
  images: string[];
  /** Le site avait-il un logo lisible ? */
  logo: boolean;
  /**
   * Le relevé complet : chaque page, chaque section (titres, textes, listes, boutons, formulaires, images), le
   * menu, le pied de page, les coordonnées. Toutes ses images (et le favicon) pointent vers NOTRE stockage.
   */
  inventory: SiteInventory;
  /** Les couleurs du site vont-elles avec son logo ? (absent quand la marque du projet est déjà choisie) */
  brandCheck?: BrandCheck;
  /** Les palettes enregistrées dans le projet : celle du site (par défaut) et celle tirée du logo. */
  palettes?: { site?: string; logo?: string };
}

/** Les options d'un import : rattacher le site à un projet existant, rendre de quoi refaire le site. */
export interface SiteImportOptions {
  /** Le projet (de l'utilisateur) auquel rattacher le site, au lieu d'en créer un. */
  into?: string;
  /**
   * Une REFONTE : le site est relevé en entier (toutes ses pages, sections et fichiers recopiés chez nous), et sa
   * marque est gardée telle quelle — ses couleurs et ses polices par défaut, la palette tirée du logo seulement
   * proposée.
   */
  withContent?: boolean;
}

const PROJECT_TYPES: ProjectModel['type'][] = ['enterprise', 'ecommerce', 'web', 'mobile', 'iot', 'desktop', 'api', 'ai', 'blockchain', 'landing', 'other'];
const TARGETS = ['business', 'students', 'general-public', 'government', 'healthcare'];
const SCOPES = ['local', 'departmental', 'regional', 'national', 'international'];

const originOf = (url: string): string => {
  try {
    return new URL(url).origin.replace(/^http:/, 'https:').replace('://www.', '://');
  } catch {
    return '';
  }
};

/** Le projet de l'utilisateur déjà né de ce site, s'il existe. */
async function projectForSite(userId: string, url: string): Promise<ProjectModel | null> {
  const origin = originOf(url);
  if (!origin) return null;
  const projects = await projectService.getAllUserProjects(userId);
  return projects.find((p) => originOf((p.analysisResultModel?.branding as { siteSource?: { url?: string } } | undefined)?.siteSource?.url || '') === origin) ?? null;
}

/** La fiche du projet, rédigée depuis les textes du site (langue du site, aucun fait inventé). */
async function describeProject(scan: SiteScanResult, ports: SiteImportPorts): Promise<Pick<ProjectModel, 'name' | 'description' | 'longDescription' | 'type' | 'targets' | 'scope'> & { city?: string; country?: string }> {
  const fallback = {
    name: scan.brandName.slice(0, 80) || 'Mon entreprise',
    description: (scan.voice.valueProposition || scan.description || scan.title).slice(0, 190),
    longDescription: [scan.voice.valueProposition, scan.description, ...scan.texts.paragraphs.slice(0, 4)].filter(Boolean).join('\n\n').slice(0, 3000),
    type: 'enterprise' as ProjectModel['type'],
    targets: 'general-public',
    scope: 'national',
  };
  const system = [
    'You turn a company website into the project sheet of a business-building platform. Answer ONLY a JSON object:',
    '{"name": "the brand name", "description": "one sentence, at most 180 characters: what the company does and for whom", "longDescription": "120 to 250 words: the activity, the offer (products or services), the clients, where it operates, what makes it different — only what the site says", "type": "enterprise|ecommerce|web|mobile|ai|other", "targets": "business|general-public|students|government|healthcare", "scope": "local|regional|national|international", "city": "city if the site states it, else null", "country": "country if the site states it, else null"}',
    `Write the texts in the language of the site (${scan.language}). Never invent a figure, a client, a date, an award or an address.`,
  ].join('\n');
  const user = [
    `SITE: ${scan.finalUrl}`,
    `NAME: ${scan.brandName}`,
    `TITLE: ${scan.title}`,
    scan.description ? `DESCRIPTION: ${scan.description}` : '',
    scan.voice.businessType ? `ACTIVITY: ${scan.voice.businessType}` : '',
    scan.voice.valueProposition ? `PROMISE: ${scan.voice.valueProposition}` : '',
    `HEADINGS: ${scan.texts.headings.join(' | ')}`,
    `TEXT: ${scan.texts.paragraphs.join(' ')}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 6000);
  try {
    const json = parseLlmJson<Record<string, unknown>>(await ports.text(system, user, 'writing'));
    if (!json) return fallback;
    const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && !/^null$/i.test(v.trim()) ? v.trim().slice(0, max) : undefined);
    return {
      name: str(json.name, 80) || fallback.name,
      description: str(json.description, 195) || fallback.description,
      longDescription: str(json.longDescription, 6000) || fallback.longDescription,
      type: PROJECT_TYPES.includes(json.type as ProjectModel['type']) ? (json.type as ProjectModel['type']) : fallback.type,
      targets: TARGETS.includes(String(json.targets)) ? String(json.targets) : fallback.targets,
      scope: SCOPES.includes(String(json.scope)) ? String(json.scope) : fallback.scope,
      ...(str(json.city, 60) ? { city: str(json.city, 60) } : {}),
      ...(str(json.country, 60) ? { country: str(json.country, 60) } : {}),
    };
  } catch (error: any) {
    logger.warn('site_import.describe_failed', { event: 'site_import.describe_failed', error: error?.message });
    return fallback;
  }
}

/** Le logo du site, vectorisé (couleurs gardées), avec ses déclinaisons hébergées. */
async function importLogo(userId: string, projectId: string, scan: SiteScanResult): Promise<LogoModel | null> {
  let buffer: Buffer | null = null;
  let name = 'logo.svg';
  if (scan.logo.svg) buffer = Buffer.from(scan.logo.svg);
  else if (scan.logo.url) {
    const file = await safeFetch(scan.logo.url, { accept: ['image/'], maxBytes: 8 * 1024 * 1024, timeoutMs: 20_000 }).catch(() => null);
    if (file) {
      buffer = file.buffer;
      name = file.mimeType === 'image/svg+xml' ? 'logo.svg' : `logo.${(file.mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
    }
  }
  if (!buffer) return null;
  const imported = await processLogoImport(buffer, name);
  const variations = await generateLogoVariations(imported.svg);
  const folder = `users/${userId}/projects/${projectId}/logos`;
  const stamp = Date.now().toString(36);
  const upload = (content: string | undefined, file: string) => (content && content.trim() ? storageService.uploadSvgFile(content, file, folder).catch(() => content) : Promise.resolve(undefined));
  const set = async (kind: 'withText' | 'iconOnly', slug: string) => {
    const v = variations[kind];
    const [lightBackground, darkBackground, monochrome] = await Promise.all([upload(v?.lightBackground, `logo-${slug}-light-${stamp}.svg`), upload(v?.darkBackground, `logo-${slug}-dark-${stamp}.svg`), upload(v?.monochrome, `logo-${slug}-mono-${stamp}.svg`)]);
    return { lightBackground, darkBackground, monochrome };
  };
  const [svg, withText, iconOnly] = await Promise.all([upload(imported.svg, `logo-site-${stamp}.svg`), set('withText', 'text'), set('iconOnly', 'icon')]);
  return {
    id: `site-${stamp}`,
    name: 'Logo du site',
    svg: svg || imported.svg,
    iconSvg: iconOnly.lightBackground || svg || imported.svg,
    concept: `Logo de la marque, repris de son site (${new URL(scan.finalUrl).hostname}).`,
    colors: imported.extractedColors.slice(0, 4),
    fonts: [],
    variations: { withText, iconOnly },
  } as unknown as LogoModel;
}

/**
 * Une police du site : celle d'un catalogue public si elle y est (Google, Fontshare, Fontsource), sinon SES
 * fichiers, recopiés dans notre stockage — la marque garde sa typographie au lieu d'une approximation.
 */
async function brandFont(userId: string, family: string, faces: SiteFontFace[], fallback: string, copied: string[]): Promise<BrandFontModel> {
  const found = family ? await fontCatalogService.resolve(family, undefined, userId).catch(() => null) : null;
  if (found) return fontCatalogService.toBrandFont(found.family, found.source, userId);
  const own = faces.filter((f) => f.family.toLowerCase() === family.toLowerCase()).slice(0, 6);
  if (own.length) {
    const files = (
      await Promise.all(
        own.map(async (face) => {
          try {
            const buffer = face.url.startsWith('data:')
              ? Buffer.from(face.url.slice(face.url.indexOf(',') + 1), 'base64')
              : (await safeFetch(face.url, { accept: ['font/', 'application/', 'binary/'], maxBytes: 4 * 1024 * 1024, timeoutMs: 20_000 })).buffer;
            const format = detectFormat(buffer);
            return format ? { originalname: `${family}-${face.weight}-${face.style}.${format}`, buffer } : null;
          } catch {
            return null;
          }
        })
      )
    ).filter((f): f is { originalname: string; buffer: Buffer } => !!f);
    if (files.length) {
      try {
        const font = await customFontService.importFont(userId, family, files);
        copied.push(font.family);
        return { family: font.family, source: 'custom', cssUrl: font.cssUrl, weights: font.weights, customFontId: font.id, files: font.files };
      } catch (error: any) {
        logger.warn('site_import.font_copy_failed', { event: 'site_import.font_copy_failed', family, error: error?.message });
      }
    }
  }
  return fontCatalogService.toBrandFont(fallback, undefined, userId);
}

async function typographyOf(userId: string, scan: SiteScanResult, copied: string[]): Promise<{ chosen: TypographyModel; proposals: TypographyModel[] }> {
  const display = scan.typography.original.display || scan.typography.display;
  const body = scan.typography.original.body || scan.typography.body;
  const [primary, secondary] = await Promise.all([brandFont(userId, display, scan.fontFaces, scan.typography.display, copied), brandFont(userId, body, scan.fontFaces, scan.typography.body, copied)]);
  const model = (id: string, name: string, p: BrandFontModel, s: BrandFontModel, description: string): TypographyModel => ({ id, name, url: p.cssUrl || '', primaryFont: p.family, secondaryFont: s.family, primary: p, secondary: s, description });
  const chosen = model('site', 'Typographie du site', primary, secondary, 'Les polices de votre site.');
  const others = await Promise.all(
    scan.typographies
      .filter((t) => t.id !== 'site')
      .map(async (t) => {
        const [p, s] = await Promise.all([fontCatalogService.toBrandFont(t.display, undefined, userId), fontCatalogService.toBrandFont(t.body, undefined, userId)]);
        return model(t.id, t.label, p, s, t.rationale);
      })
  );
  return { chosen, proposals: [chosen, ...others] };
}

/**
 * L'accord de l'utilisateur, donné dans iVision AVANT l'import de son site : politique de confidentialité,
 * conditions d'utilisation, conditions du programme bêta. Sans lui, le projet n'est pas « finalisé » et les
 * générations d'IDEM le refusent (`checkPolicyAcceptance`).
 */
export interface SiteConsent {
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;
  betaPolicyAccepted: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/** Enregistre l'accord sur le projet, s'il ne l'est pas déjà (même trace qu'à la création d'un projet dans IDEM). */
export async function recordConsent(userId: string, projectId: string, consent?: SiteConsent): Promise<boolean> {
  if (!consent?.privacyPolicyAccepted || !consent.termsOfServiceAccepted || !consent.betaPolicyAccepted) return false;
  if (await policyAcceptanceService.isPolicyAccepted(userId, projectId)) return true;
  try {
    await policyAcceptanceService.finalizeProject(
      userId,
      projectId,
      { privacyPolicyAccepted: true, termsOfServiceAccepted: true, betaPolicyAccepted: true, marketingAccepted: false },
      consent.ipAddress,
      consent.userAgent
    );
    logger.info('site_import.consent_recorded', { event: 'site_import.consent_recorded', projectId });
    return true;
  } catch (error: any) {
    if (String(error?.message || '').includes('already been finalized')) return true;
    logger.error('site_import.consent_failed', { event: 'site_import.consent_failed', projectId, error: error?.message });
    return false;
  }
}

/**
 * Les fichiers du site recopiés dans le stockage du projet : toutes les images relevées (contenu et fonds), le
 * favicon, l'icône Apple, l'image de partage. Une refonte remplace l'ancien site, souvent à la même adresse : des
 * fichiers laissés chez lui disparaîtraient avec lui. Une image illisible est retirée du relevé.
 */
async function hostInventory(userId: string, projectId: string, inventory: SiteInventory): Promise<SiteInventory> {
  const folder = `users/${userId}/projects/${projectId}/site-assets`;
  const stamp = Date.now().toString(36);
  const urls = [
    ...new Set([inventory.assets.favicon, inventory.assets.appleIcon, inventory.assets.ogImage, ...inventory.assets.images.map((i) => i.url)].filter((u): u is string => !!u)),
  ].slice(0, Number(process.env.SITE_IMPORT_MAX_ASSETS ?? 120));
  const hosted = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      const url = urls[index];
      try {
        const file = await safeFetch(url, { accept: ['image/'], maxBytes: 12 * 1024 * 1024, timeoutMs: 20_000 });
        // Prête pour le web : une photo de 1,6 Mo (PNG d'origine) ralentissait le site et dépassait ce que l'aperçu
        // de développement sait afficher. Redimensionnée (2 000 px au plus) et recompressée en WebP ; les SVG, les
        // icônes et les GIF animés restent tels quels.
        const web = await webImage(file.buffer, file.mimeType);
        const ext = web.ext ?? (file.mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace('x-icon', 'ico').replace('vnd.microsoft.icon', 'ico').replace(/[^a-z0-9]/g, '');
        const upload = await storageService.uploadFile(web.buffer, `site-${stamp}-${index + 1}.${ext}`, folder, web.mimeType ?? file.mimeType);
        hosted.set(url, upload.downloadURL);
      } catch (error: any) {
        logger.warn('site_import.asset_copy_failed', { event: 'site_import.asset_copy_failed', projectId, url, error: error?.message });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const keep = <T extends { url: string }>(list: T[]) => list.filter((i) => hosted.has(i.url)).map((i) => ({ ...i, url: hosted.get(i.url)! }));
  return {
    ...inventory,
    pages: inventory.pages.map((page) => ({ ...page, sections: page.sections.map((section) => ({ ...section, images: keep(section.images) })) })),
    assets: {
      favicon: inventory.assets.favicon ? hosted.get(inventory.assets.favicon) : undefined,
      appleIcon: inventory.assets.appleIcon ? hosted.get(inventory.assets.appleIcon) : undefined,
      ogImage: inventory.assets.ogImage ? hosted.get(inventory.assets.ogImage) : undefined,
      images: keep(inventory.assets.images),
    },
  };
}

/** Une image de contenu, prête pour le web (au plus 2 000 px, WebP qualité 82) ; le reste est rendu tel quel. */
async function webImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType?: string; ext?: string }> {
  if (!/^image\/(png|jpe?g|webp|avif|tiff)$/i.test(mimeType)) return { buffer };
  try {
    const out = await sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return out.byteLength < buffer.byteLength ? { buffer: out, mimeType: 'image/webp', ext: 'webp' } : { buffer };
  } catch {
    return { buffer };
  }
}

/**
 * Le logo du site tel qu'il est, marges vides retirées : une refonte l'affiche à l'identique. La version
 * vectorisée (déclinaisons de la charte) perd des détails sur un logo en photo, et un logo posé dans un carré
 * aux trois quarts vide devenait illisible à la hauteur d'un en-tête.
 */
async function originalLogo(userId: string, projectId: string, scan: SiteScanResult): Promise<string | null> {
  if (!scan.logo.url || scan.logo.url.startsWith('data:')) return null;
  try {
    const file = await safeFetch(scan.logo.url, { accept: ['image/'], maxBytes: 8 * 1024 * 1024, timeoutMs: 20_000 });
    if (file.mimeType === 'image/svg+xml') return (await storageService.uploadFile(file.buffer, `logo-original-${Date.now().toString(36)}.svg`, `users/${userId}/projects/${projectId}/logos`, 'image/svg+xml')).downloadURL;
    // Fond uni autour du logo retiré (blanc ou transparent), puis PNG (transparence gardée).
    const trimmed = await sharp(file.buffer, { failOn: 'none' }).trim({ threshold: 18 }).resize({ height: 400, withoutEnlargement: true }).png().toBuffer();
    return (await storageService.uploadFile(trimmed, `logo-original-${Date.now().toString(36)}.png`, `users/${userId}/projects/${projectId}/logos`, 'image/png')).downloadURL;
  } catch (error: any) {
    logger.warn('site_import.logo_original_failed', { event: 'site_import.logo_original_failed', projectId, error: error?.message });
    return null;
  }
}

/**
 * Le contenu d'une refonte, gardé dans le stockage du projet (`branding.siteSource.contentUrl`) : la génération
 * peut reprendre plus tard (après une question, après un redémarrage) sans relire le site.
 */
async function saveContent(userId: string, projectId: string, content: SiteContent): Promise<string | null> {
  try {
    const upload = await storageService.uploadFile(Buffer.from(JSON.stringify(content)), `site-content-${Date.now().toString(36)}.json`, `users/${userId}/projects/${projectId}/site-import`, 'application/json');
    return upload.downloadURL;
  } catch (error: any) {
    logger.warn('site_import.content_save_failed', { event: 'site_import.content_save_failed', projectId, error: error?.message });
    return null;
  }
}

function contentOf(scan: SiteScanResult, inventory: SiteInventory, logo: boolean, extra: Pick<SiteContent, 'brandCheck' | 'palettes'> = {}): SiteContent {
  return {
    url: scan.finalUrl,
    title: scan.title,
    description: scan.description,
    language: inventory.language || scan.language,
    headings: scan.texts.headings,
    paragraphs: scan.texts.paragraphs,
    voice: scan.voice,
    styleEvidence: scan.styleEvidence,
    pages: inventory.pages.map((p) => p.url),
    images: inventory.assets.images.map((i) => i.url),
    logo,
    inventory,
    ...extra,
  };
}

/** Le contenu d'une refonte déjà relevée (reprise après une question). */
export async function siteContentOf(userId: string, projectId: string): Promise<SiteContent | null> {
  const project = await projectService.getUserProjectById(userId, projectId).catch(() => null);
  const url = (project?.analysisResultModel?.branding as { siteSource?: { contentUrl?: string } } | undefined)?.siteSource?.contentUrl;
  if (!url) return null;
  try {
    const file = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 20_000 });
    return JSON.parse(file.buffer.toString('utf8')) as SiteContent;
  } catch (error: any) {
    logger.warn('site_import.content_read_failed', { event: 'site_import.content_read_failed', projectId, error: error?.message });
    return null;
  }
}

/** La palette retenue pour le projet : celle du site (par défaut d'une refonte) ou celle tirée du logo. */
export async function chooseSitePalette(userId: string, projectId: string, source: 'site' | 'logo'): Promise<boolean> {
  const project = await projectService.getUserProjectById(userId, projectId);
  const branding = project?.analysisResultModel?.branding as (Record<string, any> & { siteSource?: { palettes?: { site?: string; logo?: string } } }) | undefined;
  const id = branding?.siteSource?.palettes?.[source];
  const palette = id ? (branding?.generatedColors as ColorModel[] | undefined)?.find((c) => c.id === id) : undefined;
  if (!project || !branding || !palette) return false;
  await projectService.editUserProject(userId, projectId, { analysisResultModel: { ...project.analysisResultModel, branding: { ...branding, colors: palette } } as unknown as ProjectModel['analysisResultModel'] });
  logger.info('site_import.palette_chosen', { event: 'site_import.palette_chosen', projectId, source });
  return true;
}

/** Crée (ou rouvre) le projet IDEM d'un site, identité visuelle comprise. */
export async function createProjectFromSite(
  userId: string,
  rawUrl: string,
  ports: SiteImportPorts,
  onStep: (step: SiteImportStep) => void = () => undefined,
  consent?: SiteConsent,
  options: SiteImportOptions = {}
): Promise<SiteImportResult> {
  const url = normalizeSiteUrl(rawUrl);
  // Rattaché à un projet de l'utilisateur (iCode ouvert sur un projet), sinon au projet déjà né de ce site.
  const target = options.into ? await projectService.getUserProjectById(userId, options.into).catch(() => null) : null;
  const existing = target ?? (await projectForSite(userId, url));
  const branded = (p: ProjectModel | null) => {
    const b = p?.analysisResultModel?.branding;
    return !!(b?.colors?.colors?.primary && b?.typography?.primaryFont);
  };
  if (existing?.id && branded(existing)) {
    // Un projet déjà créé sans accord (iVision avant le 18/10/2026) le reçoit maintenant.
    await recordConsent(userId, existing.id, consent);
    const b = existing.analysisResultModel.branding;
    const reused: SiteImportResult = { projectId: existing.id, reused: true, name: existing.name, siteUrl: (b as { siteSource?: { url: string } }).siteSource?.url || url, images: [], logo: !!b.logo?.svg, fonts: { display: b.typography?.primaryFont || '', body: b.typography?.secondaryFont || '', copied: [] }, warnings: [] };
    if (!options.withContent) {
      onStep('done');
      return reused;
    }
    // Une refonte a besoin de tout ce que le site dit aujourd'hui : il est relevé en entier, la marque du projet
    // (choisie dans IDEM) reste la sienne.
    const [scan, crawled] = await Promise.all([
      scanWebsite({ url, maxPages: 2, timeoutMs: 25_000, textModel: (s, u) => ports.text(s, u, 'mechanical'), vision: ports.vision, onProgress: (step) => onStep(step) }),
      crawlWebsite({ url, onProgress: () => onStep('pages') }),
    ]);
    onStep('assets');
    const inventory = await hostInventory(userId, existing.id, crawled);
    const content = contentOf(scan, inventory, !!scan.logo.svg || !!scan.logo.url);
    const contentUrl = await saveContent(userId, existing.id, content);
    if (contentUrl) {
      await projectService.editUserProject(userId, existing.id, {
        analysisResultModel: { ...existing.analysisResultModel, branding: { ...b, siteSource: { ...((b as { siteSource?: object }).siteSource ?? {}), url: scan.finalUrl, evidence: scan.styleEvidence, contentUrl, importedAt: new Date() } } } as unknown as ProjectModel['analysisResultModel'],
      });
    }
    onStep('done');
    return { ...reused, images: content.images, warnings: scan.warnings, content };
  }

  // Une refonte relève aussi le site en entier, pendant que la marque est lue.
  const [scan, crawled] = await Promise.all([
    scanWebsite({ url, maxPages: 2, timeoutMs: 25_000, textModel: (s, u) => ports.text(s, u, 'mechanical'), vision: ports.vision, onProgress: (step) => onStep(step) }),
    options.withContent ? crawlWebsite({ url, onProgress: () => onStep('pages') }) : Promise.resolve(null),
  ]);
  const warnings = [...scan.warnings];

  onStep('project');
  // Un projet ouvert sans marque reçoit celle du site (sa fiche reste la sienne) ; sinon, un projet est créé.
  const sheet = existing?.id ? null : await describeProject(scan, ports);
  const created = existing?.id || !sheet ? existing! : await projectService.createUserProject(userId, {
    name: sheet.name,
    description: sheet.description,
    longDescription: sheet.longDescription,
    type: sheet.type,
    targets: sheet.targets,
    scope: sheet.scope,
    teamSize: '',
    constraints: [],
    selectedPhases: [],
    analysisResultModel: {} as ProjectModel['analysisResultModel'],
    deployments: [],
    activeChatMessages: [],
    additionalInfos: { email: '', phone: '', address: '', city: sheet.city || '', country: sheet.country || '', zipCode: '', teamMembers: [] },
    project: undefined,
  });
  const projectId = created.id as string;
  // L'accord d'abord : le projet est utilisable dans IDEM dès sa création.
  await recordConsent(userId, projectId, consent);

  const brandingService = new BrandingService(new PromptService());

  onStep('logo-variations');
  // Un logo déjà choisi dans le projet reste le sien ; sinon, celui du site.
  const ownLogo = (created.analysisResultModel?.branding?.logo?.svg ? created.analysisResultModel.branding.logo : null) as LogoModel | null;
  const logo = ownLogo ?? await importLogo(userId, projectId, scan).catch((error: any) => {
    logger.warn('site_import.logo_failed', { event: 'site_import.logo_failed', projectId, error: error?.message });
    return null;
  });
  if (!logo) warnings.push('Logo introuvable ou illisible sur le site : ajoutez-le dans IDEM.');
  // Une refonte affiche le logo du site tel quel (rogné), pas sa version vectorisée.
  if (logo && !ownLogo && options.withContent) {
    const original = await originalLogo(userId, projectId, scan);
    if (original) (logo as LogoModel & { originalUrl?: string }).originalUrl = original;
  }

  onStep('typography');
  const copied: string[] = [];
  const typography = await typographyOf(userId, scan, copied);
  // 'harmony' (teintes calculées autour de la couleur principale) d'abord : une palette brute de site
  // n'a souvent qu'une seule teinte posée sur du gris, 'site' reste disponible dans les propositions.
  const sitePalettes = [...scan.palettes].sort((a, b) => (a.id === 'harmony' ? -1 : b.id === 'harmony' ? 1 : 0));
  const siteColors: ColorModel[] = sitePalettes.map((p) => ({ id: p.id, name: p.label, url: '', colors: { ...p.colors } }));

  // La palette et la typo BRUTES du site (couleurs CSS en vrac, polices système) sont rarement la
  // marque la plus flatteuse pour ses propres visuels. Quand un logo a été trouvé, on en tire une
  // palette et une typographie travaillées — le même moteur qu'« importer son propre logo » — et on
  // les retient par défaut ; les versions brutes du site restent proposées comme alternative fidèle.
  const curated = logo
    ? await brandingService
        .generateColorsAndTypographyFromLogo(userId, created, logo.svg, logo.colors || [])
        .catch((error: any) => {
          logger.warn('site_import.palette_failed', { event: 'site_import.palette_failed', projectId, error: error?.message });
          return null;
        })
    : null;

  const colors = curated?.colors.length ? [...curated.colors, ...siteColors] : siteColors;
  const typographyProposals = curated?.typography.length ? [...curated.typography, ...typography.proposals] : typography.proposals;
  // Sans palette/typo travaillées (pas de logo détecté), le même principe que ci-dessus : l'accord
  // de polices pensé pour la police de titre du site plutôt que sa paire brute telle que relevée.
  let chosenTypography = curated?.typography[0] || typography.proposals.find((t) => t.id === 'pairing') || typography.chosen;
  let chosenColors = colors[0];
  // Une REFONTE garde la marque telle que le site la montre : ses couleurs relevées et SES polices (fichiers
  // recopiés si aucun catalogue ne les sert). La palette tirée du logo n'est que proposée (`brandCheck`).
  const sitePalette = siteColors.find((c) => c.id === 'site') ?? siteColors[0];
  const palettes = options.withContent ? { site: sitePalette?.id, logo: curated?.colors[0]?.id } : undefined;
  if (options.withContent) {
    if (sitePalette) chosenColors = sitePalette;
    chosenTypography = typography.chosen;
  }
  const brandCheck = options.withContent && logo && sitePalette ? checkBrandColors(String(sitePalette.colors.primary || ''), logo.colors || []) : undefined;

  const branding = {
    ...(created.analysisResultModel?.branding || {}),
    ...(logo ? { logo, generatedLogos: [logo] } : { generatedLogos: [] }),
    colors: chosenColors,
    generatedColors: colors,
    typography: chosenTypography,
    generatedTypography: typographyProposals,
    sections: [],
    siteSource: { url: scan.finalUrl, evidence: scan.styleEvidence, importedAt: new Date(), ...(palettes ? { palettes } : {}) },
  };
  await projectService.editUserProject(userId, projectId, { analysisResultModel: { ...(created.analysisResultModel || {}), branding } as unknown as ProjectModel['analysisResultModel'] });

  // La direction artistique CODIFIE le site (relevés + capture), puis les motifs sont dessinés d'après le logo.
  onStep('art-direction');
  const project = await projectService.getUserProjectById(userId, projectId);
  if (project) await brandingService.ensureArtDirection(userId, projectId, project, { siteEvidence: scan.styleEvidence });
  if (logo) {
    onStep('patterns');
    await brandingService.getBrandPatterns(userId, projectId).catch((error: any) => logger.warn('site_import.patterns_failed', { event: 'site_import.patterns_failed', projectId, error: error?.message }));
  }
  let content: SiteContent | undefined;
  if (options.withContent && crawled) {
    onStep('assets');
    const inventory = await hostInventory(userId, projectId, crawled);
    content = contentOf(scan, inventory, !!scan.logo.svg || !!scan.logo.url, { brandCheck, palettes });
    const contentUrl = await saveContent(userId, projectId, content);
    if (contentUrl) {
      const saved = await projectService.getUserProjectById(userId, projectId);
      const savedBranding = (saved?.analysisResultModel?.branding ?? branding) as Record<string, any>;
      await projectService.editUserProject(userId, projectId, {
        analysisResultModel: { ...(saved?.analysisResultModel || {}), branding: { ...savedBranding, siteSource: { ...(savedBranding.siteSource ?? {}), contentUrl } } } as unknown as ProjectModel['analysisResultModel'],
      });
    }
  }
  onStep('done');
  logger.info('site_import.project_created', { event: 'site_import.project_created', projectId, into: !!existing?.id, host: new URL(scan.finalUrl).hostname, logo: !!logo, fontsCopied: copied, display: typography.chosen.primaryFont, body: typography.chosen.secondaryFont });
  return { projectId, reused: !!existing?.id, name: sheet?.name ?? created.name, siteUrl: scan.finalUrl, images: content?.images ?? scan.images, logo: !!logo, fonts: { display: typography.chosen.primaryFont, body: typography.chosen.secondaryFont, copied }, warnings, ...(content ? { content } : {}) };
}

// ─── Le suivi (iVision interroge l'avancement) ─────────────────────────────────

export interface SiteImportJob {
  id: string;
  userId: string;
  status: 'running' | 'done' | 'failed';
  step: SiteImportStep;
  result?: SiteImportResult;
  error?: { code: string; message: string };
}

const JOB_TTL = 3600;
const save = (job: SiteImportJob) => cacheService.set(`site-import:${job.id}`, job, { prefix: 'jobs', ttl: JOB_TTL }).catch(() => false);

export const siteImportJobs = {
  /** Lance l'import en tâche de fond ; l'avancement est relu par `get`. */
  async start(userId: string, url: string, ports: SiteImportPorts, consent?: SiteConsent, options: SiteImportOptions = {}): Promise<SiteImportJob> {
    const job: SiteImportJob = { id: crypto.randomUUID(), userId, status: 'running', step: 'open' };
    await save(job);
    void createProjectFromSite(
      userId,
      url,
      ports,
      (step) => {
        job.step = step;
        void save(job);
      },
      consent,
      options
    )
      .then(async (result) => {
        await save({ ...job, status: 'done', step: 'done', result });
      })
      .catch(async (error: any) => {
        logger.error('site_import.failed', { event: 'site_import.failed', userId, error });
        await save({ ...job, status: 'failed', error: { code: error?.code || 'import_failed', message: String(error?.message || 'import_failed').slice(0, 300) } });
      });
    return job;
  },
  async get(userId: string, id: string): Promise<SiteImportJob | null> {
    const job = await cacheService.get<SiteImportJob>(`site-import:${id}`, { prefix: 'jobs' });
    return job && job.userId === userId ? job : null;
  },
};
