/**
 * Les MARQUES d'iVision : d'où vient la charte que les vidéos et les visuels lisent.
 *
 *   scan     l'utilisateur colle le lien de son site : couleurs, polices, logo, ton, ébauche de
 *            direction artistique en sont tirés (`core/src/site`), puis TROIS palettes et TROIS
 *            appariements typographiques sont proposés ; il choisit, la marque est prête ;
 *   idem     un projet IDEM de l'utilisateur : sa charte, telle quelle (la même forme) ;
 *   manual   un nom, des couleurs, des polices saisis à la main.
 *
 * Tout ce qui vient d'un site (logo, photos) est recopié dans notre stockage par un
 * téléchargement sûr : les rendus ne dépendent jamais d'un site tiers.
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { BrandKit, BrandVoice, isHex6, normalizeHex, PALETTE_ROLES } from '../../../core/src/brand/brand-kit';
import { safeFetch } from '../../../core/src/render/safe-fetch';
import { brandKitFromScan, scanWebsite, SiteScanResult, SiteScanStep } from '../../../core/src/site/site-scanner';
import { collection } from '../config/db';
import logger from '../config/logger';
import { storage } from '../config/storage';
import { HttpError } from '../middleware/error';
import type { IvisionBrand } from '../models';
import { idem } from './idem.client';

const brands = () => collection<IvisionBrand>('brands');
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;

export async function listBrands(userId: string): Promise<IvisionBrand[]> {
  return brands().find({ userId }).sort({ updatedAt: -1 }).limit(100).toArray();
}

export async function getBrand(userId: string, brandId: string): Promise<IvisionBrand> {
  const brand = await brands().findOne({ _id: brandId, userId });
  if (!brand) throw new HttpError(404, 'brand_not_found', 'Marque introuvable.');
  return brand;
}

/** Une image de tiers, recopiée (JPEG ≤ 2000 px ; un SVG reste un SVG, nettoyé au rendu). */
async function hostImage(userId: string, url: string, name: string): Promise<string | null> {
  try {
    const file = await safeFetch(url, { accept: ['image/'], maxBytes: 12 * 1024 * 1024 });
    const folder = `users/${userId}/brands`;
    if (file.mimeType === 'image/svg+xml') return (await storage.uploadFile(file.buffer, `${name}.svg`, folder, 'image/svg+xml')).downloadURL;
    const png = file.mimeType === 'image/png' || file.mimeType === 'image/webp';
    const out = png
      ? await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
      : await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    return (await storage.uploadFile(out, `${name}.${png ? 'png' : 'jpg'}`, folder, png ? 'image/png' : 'image/jpeg')).downloadURL;
  } catch (error) {
    logger.warn('brand.image_copy_failed', { event: 'brand.image_copy_failed', url, error });
    return null;
  }
}

/**
 * Scanne un site et crée la marque en BROUILLON : la palette et la typographie du site sont
 * présélectionnées, l'utilisateur confirme ou choisit une autre proposition (`chooseProposals`).
 */
export async function scanBrand(userId: string, rawUrl: string, onProgress: (step: SiteScanStep | 'copy', data?: Record<string, unknown>) => void): Promise<IvisionBrand> {
  const scan: SiteScanResult = await scanWebsite({
    url: rawUrl,
    maxPages: 2,
    timeoutMs: 25_000,
    textModel: (system, user) => idem.ai.text({ userId, system, user, tier: 'mechanical', kind: 'copy' }),
    vision: (base64, mimeType, instruction) => idem.ai.vision({ base64, mimeType, instruction, options: { maxOutputTokens: 1200, temperature: 0.2, purpose: 'site' } }),
    onProgress,
  });
  onProgress('copy', { images: scan.images.length });
  // Le même site relu : la même marque, rafraîchie (ses choix sont redemandés), pas un doublon.
  const origin = new URL(scan.finalUrl).origin;
  const existing = await brands().findOne({ userId, source: 'site', siteUrl: { $regex: `^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)` } } as never);
  const id = existing?._id || newId('brand');
  const [logoUrl, iconUrl, screenshot, ...photos] = await Promise.all([
    scan.logo.url ? hostImage(userId, scan.logo.url, `${id}-logo`) : Promise.resolve(null),
    scan.logo.iconUrl ? hostImage(userId, scan.logo.iconUrl, `${id}-icon`) : Promise.resolve(null),
    scan.screenshot ? storage.uploadFile(scan.screenshot, `${id}-site.jpg`, `users/${userId}/brands`, 'image/jpeg').then((f) => f.downloadURL).catch(() => null) : Promise.resolve(null),
    ...scan.images.slice(0, 8).map((url, i) => hostImage(userId, url, `${id}-photo-${i}`)),
  ]);
  const hostedLogo = { ...(scan.logo.svg ? { svg: scan.logo.svg } : {}), ...(logoUrl ? { url: logoUrl } : {}), ...(iconUrl ? { iconUrl } : {}) };
  const palette = scan.palettes[0]?.id || 'site';
  const typography = scan.typographies[0]?.id || 'site';
  const brand: IvisionBrand = {
    _id: id,
    userId,
    name: scan.brandName,
    source: 'site',
    siteUrl: scan.finalUrl,
    status: 'draft',
    kit: brandKitFromScan(scan, { palette, typography }, hostedLogo),
    voice: { ...scan.voice, brandName: scan.brandName, language: scan.voice.language || scan.language },
    photos: [...new Set([...photos.filter((u): u is string => !!u), ...(existing?.photos || [])])].slice(0, 40),
    proposals: { palettes: scan.palettes, typographies: scan.typographies, chosen: { palette, typography }, ...(screenshot ? { screenshot } : {}), pages: scan.pages, warnings: scan.warnings },
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  };
  if (existing) await brands().replaceOne({ _id: id, userId }, brand);
  else await brands().insertOne(brand);
  logger.info('brand.scanned', { event: 'brand.scanned', brandId: id, host: new URL(scan.finalUrl).hostname, photos: brand.photos.length, logo: scan.logo.source });
  return brand;
}

/** Le choix de l'utilisateur parmi les propositions du scan ; la marque devient prête. */
export async function chooseProposals(userId: string, brandId: string, choice: { palette?: string; typography?: string; name?: string }): Promise<IvisionBrand> {
  const brand = await getBrand(userId, brandId);
  if (!brand.proposals) throw new HttpError(400, 'no_proposals', 'Cette marque ne vient pas d’un site scanné.');
  const palette = brand.proposals.palettes.find((p) => p.id === choice.palette) || brand.proposals.palettes.find((p) => p.id === brand.proposals!.chosen.palette) || brand.proposals.palettes[0];
  const typo = brand.proposals.typographies.find((t) => t.id === choice.typography) || brand.proposals.typographies.find((t) => t.id === brand.proposals!.chosen.typography) || brand.proposals.typographies[0];
  const kit: BrandKit = {
    ...brand.kit,
    colors: { colors: { ...palette.colors } },
    typography: { primary: { family: typo.display, cssUrl: typo.displayCss }, secondary: { family: typo.body, cssUrl: typo.bodyCss } },
  };
  const name = (choice.name || '').trim().slice(0, 80) || brand.name;
  await brands().updateOne({ _id: brandId, userId }, { $set: { kit, name, status: 'ready', 'proposals.chosen': { palette: palette.id, typography: typo.id }, updatedAt: now() } });
  return getBrand(userId, brandId);
}

/** Importe la charte d'un projet IDEM (une copie : l'utilisateur peut la retoucher dans iVision). */
export async function importIdemProject(userId: string, projectId: string): Promise<IvisionBrand> {
  const existing = await brands().findOne({ userId, idemProjectId: projectId });
  const brand = await idem.projects.brand(userId, projectId);
  const doc = {
    name: brand.name,
    kit: (brand.branding || {}) as BrandKit,
    voice: brand.voice as BrandVoice,
    photos: brand.photos || [],
    status: 'ready' as const,
    updatedAt: now(),
  };
  if (existing) {
    // Réimporter rafraîchit la charte (le projet IDEM a pu évoluer) sans dupliquer la marque.
    await brands().updateOne({ _id: existing._id }, { $set: doc });
    return getBrand(userId, existing._id);
  }
  const created: IvisionBrand = { _id: newId('brand'), userId, source: 'idem', idemProjectId: projectId, createdAt: now(), ...doc };
  await brands().insertOne(created);
  logger.info('brand.imported', { event: 'brand.imported', brandId: created._id, projectId });
  return created;
}

/** Une marque saisie à la main : un nom, une palette, deux polices (le reste a ses défauts). */
export async function createManualBrand(userId: string, input: { name: string; colors?: Record<string, string>; display?: string; body?: string; tone?: string; businessType?: string; language?: string }): Promise<IvisionBrand> {
  const colors = Object.fromEntries(PALETTE_ROLES.map((role) => [role, normalizeHex(input.colors?.[role])]).filter(([, v]) => v && isHex6(v)));
  const brand: IvisionBrand = {
    _id: newId('brand'),
    userId,
    name: input.name.trim().slice(0, 80),
    source: 'manual',
    status: 'ready',
    kit: {
      colors: { colors },
      typography: { primary: { family: input.display || 'Archivo' }, secondary: { family: input.body || 'Inter' } },
      logo: null,
      artDirection: null,
    },
    voice: { brandName: input.name, tone: input.tone, businessType: input.businessType, language: input.language || 'fr' },
    photos: [],
    createdAt: now(),
    updatedAt: now(),
  };
  await brands().insertOne(brand);
  return brand;
}

/** Retouche : nom, couleurs, polices, ton (la charte reste la source de vérité des rendus). */
export async function updateBrand(userId: string, brandId: string, patch: { name?: string; colors?: Record<string, string>; display?: string; body?: string; tone?: string; businessType?: string; valueProposition?: string }): Promise<IvisionBrand> {
  const brand = await getBrand(userId, brandId);
  const kit: BrandKit = { ...brand.kit };
  if (patch.colors) {
    const current = { ...(brand.kit.colors?.colors || {}) };
    for (const role of PALETTE_ROLES) {
      const hex = normalizeHex(patch.colors[role]);
      if (hex && isHex6(hex)) current[role] = hex;
    }
    kit.colors = { colors: current };
  }
  if (patch.display || patch.body) {
    const t = brand.kit.typography || {};
    kit.typography = {
      primary: patch.display ? { family: patch.display } : t.primary || { family: t.primaryFont },
      secondary: patch.body ? { family: patch.body } : t.secondary || { family: t.secondaryFont },
    };
  }
  const voice: BrandVoice = { ...brand.voice, ...(patch.tone !== undefined ? { tone: patch.tone } : {}), ...(patch.businessType !== undefined ? { businessType: patch.businessType } : {}), ...(patch.valueProposition !== undefined ? { valueProposition: patch.valueProposition } : {}) };
  await brands().updateOne({ _id: brandId, userId }, { $set: { kit, voice, name: (patch.name || '').trim().slice(0, 80) || brand.name, updatedAt: now() } });
  return getBrand(userId, brandId);
}

export async function addBrandPhotos(userId: string, brandId: string, urls: string[]): Promise<IvisionBrand> {
  await getBrand(userId, brandId);
  await brands().updateOne({ _id: brandId, userId }, { $push: { photos: { $each: urls, $position: 0 } } as never, $set: { updatedAt: now() } });
  return getBrand(userId, brandId);
}

export async function deleteBrand(userId: string, brandId: string): Promise<void> {
  const res = await brands().deleteOne({ _id: brandId, userId });
  if (!res.deletedCount) throw new HttpError(404, 'brand_not_found', 'Marque introuvable.');
}

/** Ce que l'interface affiche d'une marque (sans le SVG en ligne du logo, lourd). */
export function brandView(brand: IvisionBrand) {
  const logo = brand.kit.logo as { svg?: string; assetUrls?: { primary?: string; icon?: string } } | null | undefined;
  const logoUrl = logo?.assetUrls?.primary || (logo?.svg ? `data:image/svg+xml;base64,${Buffer.from(logo.svg).toString('base64')}` : undefined);
  return {
    id: brand._id,
    name: brand.name,
    source: brand.source,
    siteUrl: brand.siteUrl,
    idemProjectId: brand.idemProjectId,
    status: brand.status,
    palette: brand.kit.colors?.colors || {},
    fonts: { display: brand.kit.typography?.primary?.family || brand.kit.typography?.primaryFont, body: brand.kit.typography?.secondary?.family || brand.kit.typography?.secondaryFont, displayCss: brand.kit.typography?.primary?.cssUrl, bodyCss: brand.kit.typography?.secondary?.cssUrl },
    logoUrl,
    voice: brand.voice,
    photos: brand.photos,
    artDirection: brand.kit.artDirection ? { styleId: (brand.kit.artDirection as { styleId?: string }).styleId, summary: (brand.kit.artDirection as { summary?: string }).summary } : null,
    proposals: brand.proposals,
    updatedAt: brand.updatedAt,
  };
}
