/**
 * Lecture d'un brief : ce que le planificateur (et l'agent) comprennent de la marque.
 *
 * Tout est lexical et déterministe : le secteur, la description et la personnalité sont
 * découpés en mots-clés normalisés (sans accents, singuliers) puis confrontés aux étiquettes
 * des générateurs. Aucun modèle n'est nécessaire pour qu'une marque d'agriculture se voie
 * proposer des feuilles et des pousses plutôt que des engrenages.
 */
import type { ConceptType } from '../ir/logo.schema';
import { contrast, isHex } from '../util/colors';
import type { LogoPalette } from '../ir/logo.schema';

export interface PlanBrief {
  brandName: string;
  tagline?: string;
  industry?: string;
  description?: string;
  audience?: string;
  personality?: string[];
  values?: string[];
}

export type LogoKind = 'icon' | 'name' | 'initial';

export interface CharterPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  text?: string;
  background?: string;
}

const STOP = new Set(['les', 'des', 'une', 'pour', 'avec', 'dans', 'and', 'the', 'for', 'with', 'that', 'des', 'aux', 'sur', 'par', 'qui', 'que', 'est', 'sont', 'ces', 'son', 'ses', 'leur', 'plus', 'tout', 'tous', 'notre', 'nos', 'vos', 'votre']);

/** Minuscules, sans accents, sans ponctuation. */
export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');
}

/** Un mot ramené à sa racine grossière (pluriel, féminin) pour comparer « agricoles » à « agricole ». */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5) w = w.replace(/(ment|tion|ique|iques|ale|ales|aux|eux|euse|ies|ie)$/, '');
  if (w.length > 3) w = w.replace(/(s|x|e)$/, '');
  // Six lettres : « logistique » et « logistics », « agriculture » et « agriculteur » se rejoignent.
  return w.slice(0, 6);
}

export function keywords(texts: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const raw of normalize(text ?? '').split(/[\s-]+/)) {
      if (raw.length < 3 || STOP.has(raw)) continue;
      out.push(stem(raw));
    }
  }
  return out;
}

/** Les poids des mots du brief : secteur ×2, nom de marque ×1,5, personnalité et valeurs ×1,2, description ×1. */
export function briefWeights(brief: PlanBrief): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (words: string[], weight: number) => {
    for (const w of words) weights.set(w, Math.max(weights.get(w) ?? 0, weight));
  };
  add(keywords([brief.description, brief.audience, brief.tagline]), 1);
  add(keywords([...(brief.personality ?? []), ...(brief.values ?? [])]), 1.2);
  add(keywords([brief.brandName]), 1.5);
  add(keywords([brief.industry]), 2);
  return weights;
}

/** Affinité d'un jeu d'étiquettes avec le brief (somme des poids des mots en commun). */
export function affinity(tags: string[], weights: Map<string, number>): number {
  let score = 0;
  const seen = new Set<string>();
  for (const tag of tags) {
    for (const word of keywords([tag])) {
      if (seen.has(word)) continue;
      seen.add(word);
      score += weights.get(word) ?? 0;
    }
  }
  return score;
}

export interface Traits {
  luxury: boolean;
  playful: boolean;
  tech: boolean;
  natural: boolean;
  bold: boolean;
  calm: boolean;
  classic: boolean;
  young: boolean;
}

const TRAIT_WORDS: Record<keyof Traits, string[]> = {
  luxury: ['luxe', 'luxury', 'premium', 'elegant', 'prestige', 'haut de gamme', 'raffine', 'exclusif', 'sophistique', 'bijou', 'joaillerie', 'haute couture'],
  playful: ['ludique', 'fun', 'joyeux', 'enfant', 'kids', 'jeu', 'game', 'dynamique', 'creatif', 'colore', 'sympa', 'amical', 'friendly', 'jeune'],
  tech: ['tech', 'technologie', 'digital', 'numerique', 'logiciel', 'software', 'saas', 'ia', 'data', 'startup', 'cloud', 'fintech', 'innovation', 'application', 'app', 'mobile money'],
  natural: ['nature', 'naturel', 'bio', 'organique', 'ecologie', 'agriculture', 'durable', 'vert', 'eco', 'plante', 'terroir', 'artisanal'],
  bold: ['audace', 'fort', 'puissant', 'bold', 'energie', 'sport', 'performance', 'robuste', 'solide', 'courage', 'leader'],
  calm: ['calme', 'serein', 'douceur', 'bien-etre', 'wellness', 'spa', 'zen', 'minimal', 'simple', 'pur', 'sante', 'soin'],
  classic: ['classique', 'tradition', 'heritage', 'patrimoine', 'institution', 'confiance', 'fiable', 'serieux', 'banque', 'assurance', 'juridique', 'cabinet'],
  young: ['jeune', 'etudiant', 'startup', 'gen z', 'millennial', 'tendance', 'urbain', 'streetwear', 'musique'],
};

export function traitsOf(brief: PlanBrief): Traits {
  const text = ` ${normalize([brief.industry, brief.description, brief.audience, ...(brief.personality ?? []), ...(brief.values ?? [])].join(' '))} `;
  const out = {} as Traits;
  for (const [trait, words] of Object.entries(TRAIT_WORDS) as [keyof Traits, string[]][]) out[trait] = words.some((w) => text.includes(` ${normalize(w).trim()}`));
  return out;
}

/** Les types de concept admis pour une préférence (IDEM : icône / nom / initiales), avec leur poids de départ. */
export function conceptMenu(kind: LogoKind | ConceptType | undefined, traits: Traits, nameLength: number): Partial<Record<ConceptType, number>> {
  if (kind === 'name' || kind === 'wordmark') return { wordmark: 1 };
  if (kind === 'initial') return { lettermark: 3, letterform: 2, 'negative-space': 1, emblem: 0.6 };
  if (kind && kind !== 'icon') return { [kind]: 1 } as Partial<Record<ConceptType, number>>;
  return {
    combination: 3,
    pictorial: 2,
    abstract: 2,
    emblem: nameLength <= 20 ? 1 : 0.4,
    mascot: traits.playful || traits.young ? 2 : 0.8,
    'negative-space': 1,
    minimal: traits.calm || traits.luxury || traits.tech ? 1.8 : 1,
    dynamic: traits.tech || traits.young ? 1 : 0.4,
  };
}

/**
 * La palette du logo : les encres de la charte, lisibles sur fond clair, distinctes entre elles.
 * L'encre principale est la première couleur de la charte qui atteint 3:1 sur blanc.
 */
export function inkPalette(charter: CharterPalette): LogoPalette {
  const ok = (v?: string) => (isHex(v) ? v!.toLowerCase() : undefined);
  const candidates = [ok(charter.primary), ok(charter.secondary), ok(charter.accent), ok(charter.text)].filter(Boolean) as string[];
  const ink = candidates.find((c) => contrast(c, '#ffffff') >= 3) ?? '#111827';
  const distinct = (c?: string, floor = 1.5) => (c && c !== ink && contrast(c, '#ffffff') >= floor && contrast(c, ink) >= 1.25 ? c : undefined);
  const ink2 = [ok(charter.secondary), ok(charter.primary), ok(charter.accent)].map((c) => distinct(c, 2)).find(Boolean);
  const accent = [ok(charter.accent), ok(charter.secondary), ok(charter.primary)].map((c) => distinct(c, 1.6)).find((c) => c && c !== ink2) ?? ink2;
  return { ink, ...(ink2 ? { ink2 } : {}), ...(accent ? { accent } : {}) };
}

/** Initiales (1 à 3 lettres) : « Kora Bank » → KB, « Verda » → V. */
export function initialsOf(name: string, max = 2): string {
  const words = normalize(name).split(/[\s-]+/).filter((w) => w.length);
  if (!words.length) return 'B';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return words.slice(0, max).map((w) => w[0].toUpperCase()).join('');
}
