/**
 * La direction artistique d'un projet, TRADUITE en une fiche purement visuelle
 * avant de quitter la plateforme.
 *
 * ── LE PROBLÈME ─────────────────────────────────────────────────────────────
 *
 * Envoyer à Gemini la direction artistique rédigée pour le projet, c'était lui
 * raconter l'entreprise (« véhicules de livraison et portraits de chauffeurs »,
 * « paysages industriels locaux »). Ne lui envoyer que le style du catalogue,
 * c'était obtenir des rendus génériques. Ni l'un ni l'autre.
 *
 * ── LA RÉPONSE : TRADUIRE CHEZ NOUS, VÉRIFIER SANS IA ───────────────────────
 *
 * 1. GLM — le fournisseur de la plateforme, qui reçoit déjà ces textes — les
 *    réécrit en qualités VISUELLES : lumière, matières, texture, cadrage,
 *    ambiance, décor. L'appel est direct (`completeTextWithGlm`), hors du
 *    routeur : aucune bascule de fournisseur ne peut l'envoyer ailleurs.
 * 2. Chaque champ est relu par le code : nom et mots distinctifs du projet,
 *    lieux (pays, villes, régions), chiffres, URL, e-mails. Un champ qui fuit
 *    est RETIRÉ, seul ; les autres restent. La relecture ne dépend d'aucun
 *    modèle : elle ne peut pas être convaincue.
 * 3. La fiche est gardée en cache par projet : un appel par charte.
 *
 * Ce qui en sort est personnel (la lumière d'un atelier, du béton brut, un
 * cadrage serré) sans rien dire de qui, de quoi, ni d'où.
 */

import crypto from 'crypto';
import logger from '../../config/logger';
import { getGlmApiKey } from '../../config/ai-providers.config';
import { ArtDirectionModel } from '../../models/art-direction.model';
import { parseLlmJson } from '../../utils/llm-json.util';
import { cacheService } from '../cache.service';
import { completeTextWithGlm } from '../glm-media.service';
import { findLeaks } from './mockupPrivacy';

export interface VisualBrief {
  /** La lumière : source, qualité, direction, ombres. */
  lighting?: string;
  /** Les matières et surfaces du décor. */
  materials?: string;
  /** Le grain, le traitement de l'image. */
  texture?: string;
  /** Le cadrage et l'optique. */
  camera?: string;
  /** L'ambiance, en qualités sensibles. */
  mood?: string;
  /** Le lieu, décrit par ses qualités — jamais nommé. */
  setting?: string;
}

const FIELDS: (keyof VisualBrief)[] = ['lighting', 'materials', 'texture', 'camera', 'mood', 'setting'];
const MAX_FIELD_CHARS = 140;
const VISUAL_BRIEF_TTL_S = 30 * 24 * 3600;

/**
 * Lieux qui ne sortent jamais : régions, pays et villes d'Afrique (en anglais
 * et en français), plus le pays déclaré du projet. Un lieu dit d'où vient le
 * projet — l'information que la souveraineté du traitement protège d'abord.
 */
const PLACES = [
  'africa', 'african', 'afrique', 'africain', 'africaine', 'sahel', 'sahara', 'saharan', 'maghreb',
  'west africa', 'east africa', 'sub-saharan', 'subsaharan',
  'cameroon', 'cameroun', 'douala', 'yaounde', 'yaoundé', 'nigeria', 'lagos', 'abuja', 'senegal', 'sénégal',
  'dakar', 'ivory coast', "côte d'ivoire", 'cote d ivoire', 'abidjan', 'ghana', 'accra', 'kenya', 'nairobi',
  'mombasa', 'rwanda', 'kigali', 'congo', 'kinshasa', 'brazzaville', 'pointe-noire', 'gabon', 'libreville',
  'benin', 'bénin', 'cotonou', 'togo', 'lome', 'lomé', 'mali', 'bamako', 'burkina', 'ouagadougou', 'niger',
  'niamey', 'chad', 'tchad', 'ndjamena', "n'djamena", 'guinea', 'guinée', 'conakry', 'sierra leone',
  'freetown', 'liberia', 'monrovia', 'ethiopia', 'éthiopie', 'addis', 'uganda', 'ouganda', 'kampala',
  'tanzania', 'tanzanie', 'dar es salaam', 'zanzibar', 'angola', 'luanda', 'mozambique', 'maputo',
  'madagascar', 'antananarivo', 'south africa', 'afrique du sud', 'johannesburg', 'cape town', 'le cap',
  'zimbabwe', 'harare', 'zambia', 'zambie', 'lusaka', 'morocco', 'maroc', 'casablanca', 'rabat',
  'marrakech', 'algeria', 'algérie', 'algiers', 'alger', 'tunisia', 'tunisie', 'tunis', 'egypt', 'égypte',
  'cairo', 'le caire', 'mauritania', 'mauritanie', 'nouakchott', 'gambia', 'gambie', 'banjul', 'bangui',
  'centrafrique', 'sudan', 'soudan', 'khartoum', 'somalia', 'somalie', 'mogadishu', 'djibouti', 'eritrea',
  'malawi', 'lilongwe', 'botswana', 'gaborone', 'namibia', 'namibie', 'windhoek', 'lesotho', 'eswatini',
];

/** Mots de projet trop communs pour être distinctifs. */
const COMMON_WORDS = new Set([
  'startup', 'entreprise', 'service', 'services', 'client', 'clients', 'produit', 'produits', 'solution',
  'solutions', 'plateforme', 'marque', 'projet', 'business', 'company', 'platform', 'product', 'products',
  'offre', 'grâce', 'aussi', 'leurs', 'notre', 'votre', 'their', 'which', 'with', 'about', 'aupres', 'auprès',
  'depuis', 'chaque', 'toute', 'toutes', 'being', 'where', 'there', 'these', 'those',
]);

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Les mots qui désignent CE projet : son nom, et les mots distinctifs de sa
 * description (sept lettres et plus). Comparés par leur racine de SIX lettres :
 * « plastiques » attrape « plastic », « industriels » attrape « industrial »,
 * sans que « collecte » n'attrape « collage » ni « transformation » « translucent ».
 */
export function projectStems(brandName: string, description: string): string[] {
  const words = normalize(`${brandName} ${description}`).match(/[a-z]{7,}/g) ?? [];
  return [...new Set(words.filter((word) => !COMMON_WORDS.has(word)).map((word) => word.slice(0, 6)))];
}

/** Pourquoi ce champ ne peut pas sortir ; vide s'il le peut. */
export function fieldLeaks(value: string, brandName: string, stems: string[], country?: string): string[] {
  const reasons = findLeaks(value, [brandName, ...brandName.split(/\s+/)]);
  const text = normalize(value);
  const places = country ? [...PLACES, normalize(country)] : PLACES;
  for (const place of places) {
    if (new RegExp(`(?<![a-z])${normalize(place).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`).test(text)) {
      reasons.push(`lieu « ${place} »`);
    }
  }
  const tokens = text.match(/[a-z]{6,}/g) ?? [];
  const hit = tokens.find((token) => stems.includes(token.slice(0, 6)));
  if (hit) reasons.push(`mot du projet « ${hit} »`);
  return reasons;
}

/** Garde les champs qui peuvent sortir ; journalise ceux qui ne le peuvent pas. */
export function validateVisualBrief(
  raw: Record<string, unknown>,
  context: { brandName: string; description: string; country?: string }
): VisualBrief {
  const stems = projectStems(context.brandName, context.description);
  const brief: VisualBrief = {};
  for (const field of FIELDS) {
    const value = typeof raw[field] === 'string' ? (raw[field] as string).replace(/\s+/g, ' ').trim() : '';
    if (!value) continue;
    const clipped = value.slice(0, MAX_FIELD_CHARS);
    const reasons = fieldLeaks(clipped, context.brandName, stems, context.country);
    if (reasons.length > 0) {
      logger.warn(`[PRIVACY] Fiche visuelle : « ${field} » retiré (${reasons.join(', ')})`);
      continue;
    }
    brief[field] = clipped;
  }
  return brief;
}

function artDirectionText(ad: ArtDirectionModel): string {
  const imagery = ad.imagery ?? ({} as ArtDirectionModel['imagery']);
  return [
    ad.imagePromptModifier && `Rendu : ${ad.imagePromptModifier}`,
    imagery.lighting && `Lumière : ${imagery.lighting}`,
    imagery.treatment && `Traitement : ${imagery.treatment}`,
    imagery.framing && `Cadrage : ${imagery.framing}`,
    imagery.subjects && `Sujets : ${imagery.subjects}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * La fiche visuelle du projet, ou `null` quand il n'y a rien à traduire ou
 * que GLM n'est pas disponible — le rendu retombe alors sur le seul catalogue.
 */
export async function buildVisualBrief(input: {
  artDirection?: ArtDirectionModel | null;
  brandName: string;
  description: string;
  country?: string;
}): Promise<VisualBrief | null> {
  const source = input.artDirection ? artDirectionText(input.artDirection) : '';
  if (!source || !getGlmApiKey()) return null;

  const hash = crypto
    .createHash('sha256')
    .update(`${input.brandName}\n${input.description}\n${input.country ?? ''}\n${source}`)
    .digest('hex')
    .slice(0, 20);
  const cacheKey = `visual-brief:${hash}`;
  const cached = await cacheService.get<VisualBrief>(cacheKey, { prefix: 'ai', ttl: VISUAL_BRIEF_TTL_S });
  if (cached) return cached;

  try {
    const raw = await completeTextWithGlm(
      `You translate a brand's art direction into a PURELY VISUAL photo brief for a photographer who must learn NOTHING about the company.
Answer with ONE JSON object and nothing else:
{"lighting":"…","materials":"…","texture":"…","camera":"…","mood":"…","setting":"…"}

Each field: English, 6 to 18 words, concrete visual qualities only.
- lighting: light source, quality, direction, shadows.
- materials: surfaces and materials of the set (wood, concrete, linen, brushed metal…).
- texture: grain, finish and image treatment.
- camera: framing, angle, lens feel, depth of field.
- mood: the sensory atmosphere, in adjectives.
- setting: the kind of place, described by its qualities (a bright tiled workshop, a quiet sunlit courtyard) — never named.

NEVER write: the company name, what it sells or does, its customers, its products, its industry, any country, city, region, continent, nationality or ethnicity, any number, date, brand or text. Translate subjects into their visual qualities (e.g. "delivery vehicles and drivers" → "clean matte surfaces, purposeful motion, orthogonal urban lines").

Art direction to translate:
${source.slice(0, 2500)}`,
      { maxTokens: 900, temperature: 0.4 }
    );
    const parsed = parseLlmJson<Record<string, unknown>>(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const brief = validateVisualBrief(parsed, input);
    if (Object.keys(brief).length === 0) return null;
    await cacheService.set(cacheKey, brief, { prefix: 'ai', ttl: VISUAL_BRIEF_TTL_S });
    logger.info(`[PRIVACY] Fiche visuelle prête (${Object.keys(brief).join(', ')})`);
    return brief;
  } catch (error: any) {
    logger.warn(`[PRIVACY] Fiche visuelle indisponible (${error?.message}) — rendu du seul catalogue`);
    return null;
  }
}
