/**
 * Propagation d'un changement d'identité dans le code du site généré.
 *
 * Le site est écrit par iCode à partir d'un design system CALCULÉ par la forge
 * d'appgen (`we-dev-next/src/design/tokenForge.ts`) : rampes, surfaces, encres
 * et feuilles de polices y sont posées en valeurs, dans `tailwind.config.js`,
 * `index.html` et les feuilles CSS. Ces valeurs ne sont pas celles du design
 * system des documents — la forge a sa propre direction artistique — il faut
 * donc demander à la forge elle-même l'avant et l'après.
 *
 * La forge est du calcul pur, exposé sans modèle ni authentification
 * (`POST /api/design/forge`). Si elle ne répond pas, la propagation se fait
 * quand même avec les jetons communs (palette, rampe de marque, polices,
 * logos) : le site est moins finement repeint, mais jamais laissé à
 * l'ancienne marque.
 */

import logger from '../../config/logger';
import { BrandIdentityModel } from '../../models/brand-identity.model';
import { ProjectModel } from '../../models/project.model';
import { resolveSvgContent } from '../logo-import.service';
import { storageService } from '../storage.service';
import {
  BrandRewriteMap,
  buildBrandRewriteMap,
  emptyStats,
  isEmptyRewrite,
  RewriteMapExtras,
  rewriteBrandString,
  RewriteStats,
} from './brandRewrite';
import { resolveLogoSlot } from './brandTokens';
import { traceHeaders } from '../../utils/trace.util';

const FORGE_TIMEOUT_MS = 5_000;

/** Fichiers dont le contenu peut porter une couleur, une police ou un logo. */
const TEXT_FILE = /\.(html?|css|scss|sass|less|js|jsx|ts|tsx|mjs|cjs|json|svg|vue|svelte|astro|md|mdx)$/i;

/**
 * Empreinte cyrb53 — IDENTIQUE à `hashContent` du client iCode
 * (`we-dev-client/src/utils/codeSync.ts`). Le manifeste sert au client à ne
 * renvoyer que les fichiers modifiés : une autre fonction de hachage lui ferait
 * croire que tout a changé.
 */
export function hashContent(content: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

interface ForgedSystem {
  colors?: {
    brand?: Record<string, string>;
    neutral?: Record<string, string>;
    accent?: string;
    secondary?: string;
    surface?: string;
    surfaceRaised?: string;
    ink?: string;
    inkMuted?: string;
  };
  fontsHrefs?: string[];
}

function appgenBaseUrl(): string {
  return (process.env.APPGEN_INTERNAL_URL || 'http://appgen:3003').replace(/\/+$/, '');
}

async function forge(projectData: Partial<ProjectModel>): Promise<ForgedSystem | null> {
  try {
    const response = await fetch(`${appgenBaseUrl()}/api/design/forge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...traceHeaders() },
      body: JSON.stringify({ projectData }),
      signal: AbortSignal.timeout(FORGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { system?: ForgedSystem };
    return payload.system ?? null;
  } catch (error: any) {
    logger.warn(`Forge du site injoignable, propagation sur les jetons communs : ${error.message}`);
    return null;
  }
}

function forgedColorTokens(system: ForgedSystem): Array<[string, string]> {
  const c = system.colors ?? {};
  const tokens: Array<[string, string]> = [];
  const push = (name: string, value?: string) => {
    if (value) tokens.push([name, value]);
  };
  push('site.accent', c.accent);
  push('site.secondary', c.secondary);
  push('site.surface', c.surface);
  push('site.surfaceRaised', c.surfaceRaised);
  push('site.ink', c.ink);
  push('site.inkMuted', c.inkMuted);
  for (const [stop, hex] of Object.entries(c.brand ?? {})) push(`site.brand.${stop}`, hex);
  for (const [stop, hex] of Object.entries(c.neutral ?? {})) push(`site.neutral.${stop}`, hex);
  return tokens;
}

/** Les deux projets tels que la forge les lit : seule la marque diffère. */
function withBranding(project: ProjectModel, branding: Partial<BrandIdentityModel>): Partial<ProjectModel> {
  return {
    id: project.id,
    name: project.name,
    analysisResultModel: {
      ...project.analysisResultModel,
      branding,
    } as ProjectModel['analysisResultModel'],
  };
}

/**
 * Le SVG d'un logo, recopié tel quel dans le site (`public/logo.svg`), ne porte
 * pas l'URL du logo : il faut comparer les CONTENUS.
 */
async function logoContentLiterals(
  before: Partial<BrandIdentityModel>,
  after: Partial<BrandIdentityModel>
): Promise<Array<[string, string]>> {
  const literals: Array<[string, string]> = [];
  for (const slot of ['svg', 'iconSvg'] as const) {
    const from = resolveLogoSlot(before.logo, slot);
    const to = resolveLogoSlot(after.logo, slot);
    if (!from || !to || from === to) continue;
    try {
      const [fromSvg, toSvg] = await Promise.all([resolveSvgContent(from), resolveSvgContent(to)]);
      if (fromSvg?.includes('<svg') && toSvg?.includes('<svg') && fromSvg !== toSvg) {
        literals.push([fromSvg.trim(), toSvg.trim()]);
      }
    } catch (error: any) {
      logger.warn(`Contenu du logo illisible pour la propagation au site (${slot}) : ${error.message}`);
    }
  }
  return literals;
}

export async function buildSiteRewriteMap(
  project: ProjectModel,
  before: Partial<BrandIdentityModel>,
  after: Partial<BrandIdentityModel>
): Promise<{ map: BrandRewriteMap; forged: boolean }> {
  const [forgedBefore, forgedAfter, contentLiterals] = await Promise.all([
    forge(withBranding(project, before)),
    forge(withBranding(project, after)),
    logoContentLiterals(before, after),
  ]);

  const extras: RewriteMapExtras = { literals: contentLiterals };
  const forged = !!(forgedBefore && forgedAfter);
  if (forged) {
    extras.colors = { before: forgedColorTokens(forgedBefore!), after: forgedColorTokens(forgedAfter!) };
    const hrefsBefore = forgedBefore!.fontsHrefs ?? [];
    const hrefsAfter = forgedAfter!.fontsHrefs ?? [];
    hrefsBefore.forEach((href, index) => {
      if (hrefsAfter[index] && hrefsAfter[index] !== href) extras.literals!.push([href, hrefsAfter[index]]);
    });
  }

  return { map: buildBrandRewriteMap(before, after, extras), forged };
}

export interface SiteSyncResult {
  /** Le projet a-t-il un site enregistré ? */
  hasSite: boolean;
  filesChanged: number;
  forged: boolean;
  stats: RewriteStats;
}

/**
 * Réécrit les fichiers du site dans le stockage. iCode recharge le code depuis
 * le stockage à l'ouverture : la nouvelle marque y est donc dès la prochaine
 * visite, sans régénération.
 */
export async function syncSiteBrand(
  userId: string,
  project: ProjectModel,
  before: Partial<BrandIdentityModel>,
  after: Partial<BrandIdentityModel>
): Promise<SiteSyncResult> {
  const stats = emptyStats();
  const projectId = project.id!;

  const manifest = await storageService.getProjectCodeManifest(projectId, userId);
  if (!manifest || Object.keys(manifest.files).length === 0) {
    return { hasSite: false, filesChanged: 0, forged: false, stats };
  }

  const { map, forged } = await buildSiteRewriteMap(project, before, after);
  if (isEmptyRewrite(map)) return { hasSite: true, filesChanged: 0, forged, stats };

  const files = (await storageService.downloadProjectCodeFiles(projectId, userId)) ?? {};
  const upserts: Record<string, string> = {};

  for (const [path, content] of Object.entries(files)) {
    if (!TEXT_FILE.test(path) || typeof content !== 'string') continue;
    // Les dépendances figées ne portent jamais la marque ; les réécrire ne
    // ferait que risquer d'altérer une empreinte d'intégrité.
    if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(path)) continue;
    const next = rewriteBrandString(content, map, stats);
    if (next !== content) upserts[path] = next;
  }

  const changed = Object.keys(upserts).length;
  if (changed === 0) return { hasSite: true, filesChanged: 0, forged, stats };

  const nextManifest = { ...manifest.files };
  for (const [path, content] of Object.entries(upserts)) nextManifest[path] = hashContent(content);

  await storageService.syncProjectCodeFiles(projectId, userId, upserts, [], nextManifest);
  logger.info(`Site du projet ${projectId} aligné sur la nouvelle marque : ${changed} fichier(s)`, {
    forged,
    ...stats,
  });

  return { hasSite: true, filesChanged: changed, forged, stats };
}
