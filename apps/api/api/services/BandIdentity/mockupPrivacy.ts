/**
 * Ce que Gemini reçoit pour une mise en situation — et rien de plus.
 *
 * ── LE PRINCIPE : UNE LISTE BLANCHE, PAS UN FILTRE ──────────────────────────
 *
 * Filtrer un texte libre laisse toujours passer quelque chose. La consigne
 * envoyée à Gemini est donc ASSEMBLÉE ici à partir de sources fermées, écrites
 * par nous et identiques pour tous les projets :
 *
 *   · le support            — `PHYSICAL_SUPPORT_TYPES[…].scene` (catalogue) ;
 *   · le secteur, générique  — `INDUSTRY_MOCKUP_CATEGORIES[…].context` (catalogue) ;
 *   · la palette            — trois valeurs hexadécimales ;
 *   · le rendu              — `ART_DIRECTION_STYLES[styleId]` (catalogue).
 *
 * N'en font JAMAIS partie : le nom du projet, sa description, son pays, sa
 * ville, ses clients, et la direction artistique RÉDIGÉE pour le projet
 * (`imagePromptModifier`, `imagery.*`) — un modèle l'a écrite à partir de la
 * description, et elle la raconte (« véhicules de livraison et portraits de
 * chauffeurs », « surveillance des cultures »).
 *
 * ── LA GARDE ────────────────────────────────────────────────────────────────
 *
 * Avant l'envoi, la consigne est relue : nom de marque, URL, e-mail, numéro,
 * chiffre hors couleur. Rien de tout cela ne peut venir des catalogues ; si la
 * relecture en trouve, c'est qu'un catalogue a été mal édité — la consigne est
 * alors réduite au strict minimum, et l'incident journalisé.
 *
 * ── LE LOGO ─────────────────────────────────────────────────────────────────
 *
 * Seule pièce jointe, puisque Gemini doit le reproduire. Il est ré-encodé en
 * PNG (les métadonnées — auteur, logiciel, titre SVG — tombent), et borné à
 * 1024 px : assez pour une impression fidèle, rien de plus.
 */

import sharp from 'sharp';
import logger from '../../config/logger';
import { INDUSTRY_MOCKUP_CATEGORIES } from '../../config/mockup.config';
import { resolveStyle } from '../design/artDirection.catalog';
import { MOCKUP_GENERATION_PROMPT } from './prompts/mockup-generation.prompt';
import type { SelectedMockupSupport } from './mockupAnalyzer.service';
import type { VisualBrief } from './visualBrief.service';

/** Côté le plus long du logo envoyé, en pixels. */
const LOGO_MAX_PX = 1024;

export interface GeminiMockupInput {
  support: SelectedMockupSupport;
  colors: { primary: string; secondary: string; accent: string };
  /** Identifiant du style de direction artistique : une clé de catalogue. */
  styleId?: string | null;
  pdfFormat?: string;
  /** Le logo à reproduire ; absent pour une photographie d'univers. */
  logo?: Buffer;
  /**
   * Termes qui ne doivent JAMAIS partir : nom de la marque, nom du projet.
   * Ils ne servent qu'à la relecture, jamais à la consigne.
   */
  forbidden: string[];
  /**
   * Fiche visuelle du projet, traduite par GLM et vérifiée champ par champ
   * (`visualBrief.service.ts`). C'est elle qui rend la scène PERSONNELLE sans
   * rien dire du projet. Absente : le rendu vient du seul catalogue.
   */
  visualBrief?: VisualBrief | null;
}

export interface GeminiMockupPayload {
  prompt: string;
  images: { buffer: Buffer; mimeType: string }[];
  /** Ce qui part, pour le journal : des noms de champs et des tailles. */
  audit: Record<string, string | number | boolean>;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Une couleur valide, ou un gris neutre : jamais un texte libre. */
function safeHex(value: string): string {
  const hex = (value || '').trim();
  return HEX.test(hex) ? hex.toUpperCase() : '#808080';
}

/** Le secteur, lu dans le catalogue ; « commerce » par défaut. */
function catalogSector(industryContext: string): string {
  const known = Object.values(INDUSTRY_MOCKUP_CATEGORIES).map((category) => category.context);
  return known.includes(industryContext as (typeof known)[number])
    ? industryContext
    : INDUSTRY_MOCKUP_CATEGORIES['General Business'].context;
}

/** Ce qui ne peut pas figurer dans une consigne envoyée. */
export function findLeaks(prompt: string, forbidden: string[]): string[] {
  const leaks: string[] = [];
  const lower = prompt.toLowerCase();
  for (const term of forbidden) {
    const clean = term.trim();
    if (clean.length < 3) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
    if (pattern.test(prompt)) leaks.push(`terme interdit « ${clean} »`);
  }
  if (/https?:\/\/|www\./i.test(prompt)) leaks.push('URL');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(prompt)) leaks.push('e-mail');
  if (/\+?\d[\d\s().-]{7,}\d/.test(prompt)) leaks.push('numéro');
  // Un chiffre hors couleur hexadécimale, format d'image (« 16:9 ») et
  // vocabulaire de style du catalogue (« 85mm », « 3D », « 1970s », « 16-bit »,
  // « Y2K ») : un nombre NU (« 4 200 ménages ») ne peut venir que du projet.
  const digits = lower
    .replace(/#[0-9a-f]{6}/g, '')
    .replace(/\b\d+:\d+\b/g, '')
    .replace(/\b(\d+(mm|d|k|s|-bit|-degree)|y2k|early-\d{4}s)\b/g, '');
  if (/\d/.test(digits)) leaks.push('chiffre');
  return leaks;
}

/** La consigne minimale : support et palette, sans rien du projet ni du style. */
function minimalPrompt(input: GeminiMockupInput, withLogo: boolean): string {
  return MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
    brandColors: {
      primary: safeHex(input.colors.primary),
      secondary: safeHex(input.colors.secondary),
      accent: safeHex(input.colors.accent),
    },
    selectedSupport: { ...input.support, industryContext: INDUSTRY_MOCKUP_CATEGORIES['General Business'].context },
    pdfFormat: input.pdfFormat,
    withLogo,
  });
}

export async function buildGeminiMockupPayload(input: GeminiMockupInput): Promise<GeminiMockupPayload> {
  const withLogo = Boolean(input.logo) && !input.support.skipLogo;
  const style = input.styleId ? resolveStyle(input.styleId) : null;
  const brief = input.visualBrief ?? null;

  // Seuls les champs que la consigne lit sont recopiés : le support sélectionné
  // porte aussi un contexte rédigé à partir du projet, qui ne doit pas suivre.
  const support: SelectedMockupSupport = {
    ...input.support,
    industryContext: catalogSector(input.support.industryContext),
  };

  let prompt = MOCKUP_GENERATION_PROMPT.buildDynamicPrompt({
    brandColors: {
      primary: safeHex(input.colors.primary),
      secondary: safeHex(input.colors.secondary),
      accent: safeHex(input.colors.accent),
    },
    selectedSupport: support,
    pdfFormat: input.pdfFormat,
    // Rendu : le STYLE du catalogue, affiné par la fiche visuelle vérifiée —
    // jamais la direction rédigée pour le projet.
    artDirectionModifier: [
      style?.imagePromptModifier,
      brief?.lighting,
      brief?.texture,
      brief?.camera,
      brief?.mood,
    ]
      .filter(Boolean)
      .join(', '),
    artDirectionNegative: style?.imageNegativePrompt,
    setting: brief?.setting,
    materials: brief?.materials,
    withLogo,
  });

  const leaks = findLeaks(prompt, input.forbidden);
  if (leaks.length > 0) {
    logger.error(`[PRIVACY] Consigne Gemini refusée (${leaks.join(', ')}) — repli sur la consigne minimale`);
    prompt = minimalPrompt({ ...input, support }, withLogo);
  }

  const images: GeminiMockupPayload['images'] = [];
  let logoSize = '';
  if (withLogo && input.logo) {
    const png = await sharp(input.logo)
      .resize({ width: LOGO_MAX_PX, height: LOGO_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(png).metadata();
    logoSize = `${meta.width}x${meta.height}`;
    images.push({ buffer: png, mimeType: 'image/png' });
  }

  return {
    prompt,
    images,
    audit: {
      support: support.supportType,
      sector: support.industryContext,
      style: style ? String(input.styleId) : 'aucun',
      visualBrief: brief ? Object.keys(brief).join('+') || 'vide' : 'aucune',
      colors: 3,
      logo: logoSize || 'aucun',
      promptChars: prompt.length,
      fallback: leaks.length > 0,
    },
  };
}
