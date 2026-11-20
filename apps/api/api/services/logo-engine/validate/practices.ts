/**
 * LES BONNES PRATIQUES PAR TYPE DE LOGO — un référentiel unique, lu par les agents ET mesuré par le code.
 *
 * Chaque type de logo a ses règles de métier : un logotype n'a pas de symbole, un monogramme ne
 * porte que les initiales de la marque, un logo « espace négatif » doit réellement avoir une forme
 * dans le vide, un emblème enferme son nom, etc. Ces règles servent deux fois :
 *
 *   1. dans les consignes (`practiceBrief`) : une ligne courte par type, donnée à l'agent qui
 *      dessine — il sait ce qu'on attend AVANT d'écrire (quelques dizaines de tokens) ;
 *   2. dans la mesure (`checkPractices`) : le code vérifie le rendu, sans modèle. Un manquement
 *      devient un défaut du rapport qualité (`assessLogo`), donc pèse sur l'acceptation, sur le
 *      choix entre brouillons et sur la correction ciblée.
 *
 * Aucune règle ne juge la beauté : chacune est un fait vérifiable sur le document ou les pixels.
 * Les règles universelles (lisible à 16–24 px, contraste, 2 polices au plus, budget de nœuds et de
 * couleurs) sont déjà mesurées par `visual.ts` ; elles sont rappelées ici dans la consigne.
 */
import type { ConceptType, LogoDocument } from '../ir/logo.schema';
import { walkLayers } from '../ir/logo.schema';
import type { LogoSession, RenderedLogo } from '../render/build';
import { solidRatio } from '../raster/measure';
import type { Rasterizer, RasterImage } from '../raster/rasterizer';
import type { Defect } from './technical';

export interface PracticeRule {
  /** Code du défaut quand la règle n'est pas tenue. */
  code: string;
  /** La règle, en français (documentation, message du défaut). */
  rule: string;
}

/** Le référentiel, par type. L'ordre des règles est celui de la documentation. */
export const PRACTICES: Record<ConceptType, PracticeRule[]> = {
  wordmark: [
    { code: 'practice_wordmark_symbol', rule: 'Le nom seul fait le logo : aucun symbole séparé, la personnalité vient de la lettre.' },
    { code: 'practice_wordmark_effects', rule: 'Un seul geste typographique au plus (un point, une coupe, une ligature) : deux effets se disputent.' },
    { code: 'practice_wordmark_tracking', rule: 'Un interlettrage large (> 0,3 em) ne se lit qu’en capitales.' },
  ],
  lettermark: [
    { code: 'practice_lettermark_letters', rule: 'Une à trois lettres, toutes prises dans le nom de la marque.' },
  ],
  letterform: [
    { code: 'practice_letterform_single', rule: 'Une seule lettre, prise dans le nom (l’initiale le plus souvent), travaillée comme un symbole.' },
  ],
  pictorial: [
    { code: 'practice_symbol_text', rule: 'Le pictogramme se reconnaît sans texte : aucune lettre dans le symbole.' },
    { code: 'practice_symbol_aspect', rule: 'Le symbole tient dans un carré (avatar, icône d’application) : proportions entre 1:2 et 2:1.' },
  ],
  abstract: [
    { code: 'practice_symbol_text', rule: 'La forme abstraite porte seule le sens : aucune lettre dans le symbole.' },
    { code: 'practice_symbol_aspect', rule: 'Le symbole tient dans un carré : proportions entre 1:2 et 2:1.' },
  ],
  mascot: [
    { code: 'practice_symbol_aspect', rule: 'Le personnage tient dans un carré (avatar) : proportions entre 1:2 et 2:1.' },
    { code: 'practice_mascot_small', rule: 'Le visage se lit à 32 px : formes pleines, pas de détails fins.' },
  ],
  combination: [
    { code: 'practice_combination_name', rule: 'Le symbole ET le nom : les deux doivent exister et pouvoir vivre séparément.' },
    { code: 'practice_combination_hierarchy', rule: 'Le symbole domine : le nom fait 20 à 95 % de sa hauteur.' },
    { code: 'practice_symbol_aspect', rule: 'Le symbole seul tient dans un carré : proportions entre 1:2 et 2:1.' },
  ],
  emblem: [
    { code: 'practice_emblem_enclosed', rule: 'L’emblème enferme son texte dans le cadre : pas de nom posé à côté.' },
    { code: 'practice_emblem_text_length', rule: 'Le texte du sceau reste court (24 caractères au plus) pour rester lisible.' },
  ],
  dynamic: [
    { code: 'practice_dynamic_variants', rule: 'Un logo dynamique est un système : au moins deux variantes liées au symbole de base.' },
    { code: 'practice_symbol_aspect', rule: 'Le symbole tient dans un carré : proportions entre 1:2 et 2:1.' },
  ],
  minimal: [
    { code: 'practice_minimal_layers', rule: 'Une seule idée : quatre couches au plus, deux couleurs au plus.' },
    { code: 'practice_symbol_text', rule: 'Aucune lettre dans le symbole minimal.' },
  ],
  'negative-space': [
    { code: 'practice_negative_space', rule: 'La seconde lecture est DANS le vide : une forme réellement découpée et entourée d’encre (≥ 5 % de l’encre).' },
  ],
};

/** La consigne d'un type pour un agent (anglais, une ligne, tokens comptés). */
const PROMPT: Record<ConceptType, string> = {
  wordmark: 'the name alone IS the logo: no separate symbol; at most ONE typographic gesture (a dot, a cut, a ligature); wide tracking only in capitals.',
  lettermark: '1 to 3 letters, all taken from the brand name; the letters fill at least half of the container.',
  letterform: 'ONE letter only, taken from the brand name (usually the initial), reshaped into a symbol (cut, swap, notch) while staying readable.',
  pictorial: 'one recognisable object as a solid silhouette, no letters inside, fits a square (between 1:2 and 2:1), reads at 16 px.',
  abstract: 'one geometric construction that carries a value of the brand (not its product), no letters inside, fits a square.',
  mascot: 'a character reduced to solid shapes, the face reads at 32 px, fits a square avatar.',
  combination: 'a symbol AND the name, each usable alone; the symbol leads (name height 20–95 % of the symbol height).',
  emblem: 'a seal: the text lives INSIDE the frame (curved or centred), at most 24 characters, no name placed beside it.',
  dynamic: 'one base symbol plus at least two linked variants (calm / rich / accent) that keep the same construction.',
  minimal: 'one idea, at most 4 layers and 2 colours, no letters inside the symbol.',
  'negative-space': 'the second reading lives in the EMPTY space: a real cut-out ("paper") fully surrounded by ink.',
};

/** Les règles que tout logo respecte (rappelées dans la consigne ; mesurées par `visual.ts`). */
export const UNIVERSAL_PROMPT = 'Every logo: reads at 16–24 px, works in one colour, 3:1 contrast on white, one font family (two weights at most), no gradient, no shadow, no tiny details.';

export const practiceBrief = (type: ConceptType): string => `BEST PRACTICES (${type}): ${PROMPT[type]} ${UNIVERSAL_PROMPT}`;

// ─── Mesures ────────────────────────────────────────────────────────────────

const rule = (type: ConceptType, code: string) => PRACTICES[type].find((r) => r.code === code);

/** Lettres de la marque (sans accents, en capitales) : ce qu'un monogramme a le droit de porter. */
function brandLetters(name: string): Set<string> {
  const plain = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return new Set(plain.replace(/[^A-Z0-9]/g, '').split(''));
}

/**
 * Part du vide ENFERMÉ dans l'encre : les pixels transparents qu'on n'atteint pas depuis le bord
 * (remplissage par diffusion), rapportés aux pixels d'encre. 0 = aucune contre-forme.
 */
export function enclosedVoidRatio(image: RasterImage): number {
  const { width: w, height: h, rgba } = image;
  const ink = (i: number) => rgba[i * 4 + 3] >= 128;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i] || ink(i)) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  let inkCount = 0;
  let holes = 0;
  for (let i = 0; i < w * h; i++) {
    if (ink(i)) inkCount++;
    else if (!seen[i]) holes++;
  }
  return inkCount ? holes / inkCount : 0;
}

export interface PracticeReport {
  defects: Defect[];
  metrics: Record<string, number>;
}

/**
 * Vérifie les règles du type du logo sur le document et sur les pixels. Toutes les règles sont des
 * `warn` : un manquement fait baisser la note (et peut faire refuser le logo sous le seuil), il ne
 * casse jamais une génération.
 */
export async function checkPractices(session: LogoSession, rendered: RenderedLogo, raster: Rasterizer): Promise<PracticeReport> {
  const doc: LogoDocument = session.doc;
  const type = doc.concept.type;
  const defects: Defect[] = [];
  const metrics: Record<string, number> = {};
  const fail = (code: string, detail: string) => {
    const r = rule(type, code);
    if (r) defects.push({ code, severity: 'warn', message: `${r.rule} ${detail}`.trim() });
  };

  const symbolLetters: string[] = [];
  let effects = 0;
  let maxTracking = 0;
  let upperOnly = true;
  let sealText = 0;
  let layers = 0;
  walkLayers(doc.layers, (layer) => {
    if (layer.hidden) return;
    layers++;
    if (layer.kind !== 'text') return;
    if (layer.role === 'symbol' || layer.role === 'frame') {
      symbolLetters.push(layer.content.replace(/\s+/g, ''));
      if (layer.curve || layer.role === 'frame') sealText = Math.max(sealText, layer.content.length);
    }
    if (layer.role === 'wordmark') {
      effects += layer.effects?.length ?? 0;
      maxTracking = Math.max(maxTracking, layer.tracking);
      if (layer.case !== 'upper') upperOnly = false;
    }
  });
  const { groups, boxes } = rendered.scene;
  const hasSymbol = groups.symbol.length > 0;
  const hasWord = groups.wordmark.length > 0;

  // ── Proportions du symbole seul (avatar, icône d'application, favicon) ──
  if (hasSymbol && boxes.symbol && boxes.symbol.h > 0) {
    const aspect = boxes.symbol.w / boxes.symbol.h;
    metrics.symbolAspect = Math.round(aspect * 100) / 100;
    if (aspect > 2 || aspect < 0.5) fail('practice_symbol_aspect', `Ici ${metrics.symbolAspect}:1.`);
  }

  switch (type) {
    case 'wordmark':
      if (hasSymbol) fail('practice_wordmark_symbol', 'Un symbole a été ajouté au nom.');
      if (effects > 1) fail('practice_wordmark_effects', `${effects} effets sur le nom.`);
      if (maxTracking > 0.3 && !upperOnly) fail('practice_wordmark_tracking', `Interlettrage ${maxTracking} em en minuscules.`);
      break;
    case 'lettermark': {
      const letters = symbolLetters.join('');
      const allowed = brandLetters(doc.brief.brandName);
      const foreign = [...letters.toUpperCase()].filter((c) => /[A-Z0-9]/.test(c) && !allowed.has(c));
      metrics.monogramLetters = letters.length;
      if (letters.length < 1 || letters.length > 3 || foreign.length) fail('practice_lettermark_letters', letters ? `Lettres « ${letters} ».` : 'Aucune lettre dans le monogramme.');
      break;
    }
    case 'letterform': {
      const letters = symbolLetters.join('');
      const allowed = brandLetters(doc.brief.brandName);
      if (letters.length !== 1 || !allowed.has(letters.toUpperCase())) fail('practice_letterform_single', letters ? `Lettre(s) « ${letters} ».` : 'Aucune lettre.');
      break;
    }
    case 'pictorial':
    case 'abstract':
    case 'minimal':
      if (symbolLetters.length) fail('practice_symbol_text', `Lettres dans le symbole : « ${symbolLetters.join(' ')} ».`);
      if (type === 'minimal' && layers > 4) fail('practice_minimal_layers', `${layers} couches.`);
      break;
    case 'mascot': {
      const symbol = session.render({ layout: 'symbol-only' });
      if (symbol) {
        metrics.mascotSolid32 = Math.round(solidRatio(await raster.render(symbol.svg, 32, null)) * 1000) / 1000;
        if (metrics.mascotSolid32 < 0.7) fail('practice_mascot_small', `À 32 px, ${Math.round(metrics.mascotSolid32 * 100)} % de l’encre reste solide.`);
      }
      break;
    }
    case 'combination': {
      if (!hasSymbol || !hasWord) fail('practice_combination_name', hasSymbol ? 'Le nom manque.' : 'Le symbole manque.');
      const ratio = boxes.symbol && boxes.wordmark && boxes.symbol.h ? boxes.wordmark.h / boxes.symbol.h : 0;
      if (ratio && rendered.layout === 'horizontal' && (ratio < 0.2 || ratio > 0.95)) fail('practice_combination_hierarchy', `Le nom fait ${Math.round(ratio * 100)} % de la hauteur du symbole.`);
      break;
    }
    case 'emblem':
      if (hasWord && rendered.layout === 'horizontal') fail('practice_emblem_enclosed', 'Le nom est posé à côté du sceau.');
      if (sealText > 24) fail('practice_emblem_text_length', `${sealText} caractères dans le sceau.`);
      break;
    case 'dynamic': {
      const dynamic = doc.variants.filter((v) => v.kind === 'dynamic').length;
      metrics.dynamicVariants = dynamic;
      if (dynamic < 2) fail('practice_dynamic_variants', `${dynamic} variante(s) dynamique(s).`);
      break;
    }
    case 'negative-space': {
      const symbol = session.render({ layout: 'symbol-only' });
      if (symbol) {
        const image = await raster.render(symbol.svg, 128, null);
        metrics.enclosedVoid = Math.round(enclosedVoidRatio(image) * 1000) / 1000;
        if (metrics.enclosedVoid < 0.05) fail('practice_negative_space', `Vide enfermé : ${Math.round(metrics.enclosedVoid * 100)} % de l’encre.`);
      }
      break;
    }
  }
  return { defects, metrics };
}

/** Le résumé des règles d'un type, pour la documentation et la console. */
export const practiceRules = (type: ConceptType): string[] => PRACTICES[type].map((r) => r.rule);
