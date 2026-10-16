/**
 * SCÉNARIO CIBLE — le coût des générations une fois les leviers du plan d'action appliqués.
 *
 * `generation-budgets.ts` décrit ce que les générations coûtent AUJOURD'HUI, avec les modèles et les
 * réglages en production. Ce fichier rejoue les mêmes enveloppes avec les leviers de la phase 1 du
 * plan d'action (`PLAN-ACTION-MODELE-ECONOMIQUE.md`), pour répondre à une seule question : après
 * optimisation, quel est le PRIX MINIMUM de chaque action qui tient R1 (jamais à perte) et R2
 * (marge typique ≥ 75 %) ? Le prix recommandé est le plus bas des deux : le prix actuel s'il suffit,
 * sinon ce minimum arrondi.
 *
 * Aucun code de production ne lit ce fichier : il sert `npm run quotas:matrix`. Quand un levier est
 * livré, il passe dans la configuration réelle et sort d'ici.
 */
import { BillingEngine } from '../models/billing.model';
import { CREATIVITY_MULTIPLIER, CreativityLevel, creativityCost } from '../models/creativity.model';
import { getXafPerUsd } from '../models/billing.model';
import {
  CREDIT_VALUE_XAF,
  GENERATION_ENVELOPES,
  GenerationEnvelope,
  MEDIA_UNIT_USD,
  TARGET_TYPICAL_MARGIN,
  creditPriceOf,
  resolveEnvelopeModel,
} from './generation-budgets';
import { getModelPricing } from './ai-pricing.config';

export interface CostLever {
  id: string;
  label: string;
  /** Ce qui change dans le code, en une phrase. */
  change: string;
}

/** Les leviers de la phase 1, dans l'ordre où ils pèsent sur le coût. */
export const COST_LEVERS: CostLever[] = [
  {
    id: 'L1',
    label: 'Rédacteurs sur DeepSeek V4 Flash',
    change: 'Les étapes de rédaction servies par Gemini 3.8 Flash passent sur DeepSeek V4 Flash (poids ouverts, licence MIT, sortie ~20× moins chère), après test A/B par `npm run ai:models`.',
  },
  {
    id: 'L2',
    label: 'Recherche web bornée',
    change: '6 résultats par recherche au lieu de 12, 2 recherches par section au plus au lieu de 3 (`SEARCH_RESULTS_PER_QUERY`, `MAX_SEARCH_QUERIES`).',
  },
  {
    id: 'L3',
    label: 'Cache du contexte iCode',
    change: 'Le préfixe stable du contexte (système, fichiers du projet) est envoyé en premier pour être lu depuis le cache d’OpenRouter : 60 % des jetons d’entrée au tarif « cache ».',
  },
  {
    id: 'L4',
    label: 'Visuel IA sur FLUX.2',
    change: 'Le visuel IA quitte Gemini Image (0,077 $) pour FLUX.2 klein (0,0034 $), déjà utilisé partout ailleurs ; Gemini reste réservé aux mises en situation de la charte.',
  },
  {
    id: 'L5',
    label: 'Retouche scindée',
    change: '« Révision » (1 cr) ne couvre plus que la retouche de texte ; la page réécrite par l’auteur devient « retouche de page » et l’import de document « analyse de document ».',
  },
];

/** Remplacements de modèle du levier L1. */
const MODEL_SWAP: Record<string, string> = {
  'google/gemini-3.8-flash': 'deepseek/deepseek-v4-flash',
};

/** Part des jetons d'entrée servie par le cache, par préfixe d'enveloppe (levier L3). */
const CACHED_INPUT_SHARE: Record<string, number> = { 'appgen.': 0.6 };

/** Actions nouvelles créées par une scission (levier L5), avec leur prix proposé. */
interface VirtualEnvelope {
  key: string;
  envelope: GenerationEnvelope;
  price: number;
}

const VIRTUAL: VirtualEnvelope[] = [
  {
    key: 'business.page_revision',
    price: 3,
    envelope: {
      label: 'Retouche de page (page réécrite par l’auteur)',
      engine: 'business',
      action: 'page_revision',
      group: 'edit',
      creativity: false,
      entrypoints: ['POST …/sections/:sectionId/ai-edit quand la forme change'],
      calls: [
        { step: 'Retouche du texte', model: 'cfg:businessPlan', calls: [1, 1], input: [8000, 16000], output: [1200, 3000] },
        { step: 'Page réécrite par l’auteur', model: 'ladder:code', calls: [1, 1], input: [14000, 16000], output: [5000, 8000] },
      ],
    },
  },
  {
    key: 'business.document_import',
    price: 5,
    envelope: {
      label: 'Analyse de document importé (relevé, plan existant)',
      engine: 'business',
      action: 'document_import',
      group: 'edit',
      creativity: false,
      entrypoints: ['POST /project/finance/:projectId/import/analyze', 'POST /project/communication/:projectId/extract-context'],
      calls: [{ step: 'Lecture du document', model: 'cfg:businessPlan', calls: [1, 2], input: [20000, 40000], output: [2000, 6000] }],
    },
  },
];

/** L'enveloppe après application des leviers. */
function transform(key: string, envelope: GenerationEnvelope): GenerationEnvelope {
  const clone: GenerationEnvelope = JSON.parse(JSON.stringify(envelope));

  // L2 : moitié moins de résultats par recherche, un tiers de recherches en moins au plafond.
  for (const line of clone.calls) {
    if (/Recherche sourcée/.test(line.step)) line.calls = [line.calls[0], Math.ceil((line.calls[1] * 2) / 3)];
  }
  for (const media of clone.media ?? []) {
    if (media.unit === 'web_result') media.count = [media.count[0] * 0.5, Math.ceil(media.count[1] / 3)];
  }

  // L4 : le visuel IA sur FLUX.2.
  if (key === 'business.ai_visual') {
    for (const media of clone.media ?? []) if (media.unit === 'image_gemini') media.unit = 'image';
  }

  // L5 : la révision ne réécrit plus de page (scindée en « retouche de page »).
  if (key === 'business.revision') {
    clone.calls = clone.calls.filter((line) => !/Page réécrite/.test(line.step));
  }
  return clone;
}

export interface ScenarioCost {
  usd: number;
  xaf: number;
}

function cost(key: string, envelope: GenerationEnvelope, level: CreativityLevel, which: 'typical' | 'max', levers: boolean): ScenarioCost {
  const pick = (range: readonly [number, number]) => (which === 'typical' ? range[0] : range[1]);
  const cachedShare = levers ? (Object.entries(CACHED_INPUT_SHARE).find(([prefix]) => key.startsWith(prefix))?.[1] ?? 0) : 0;
  let usd = 0;
  for (const line of envelope.calls) {
    const resolved = resolveEnvelopeModel(line.model, envelope.creativity ? level : 'medium');
    const model = levers ? (MODEL_SWAP[resolved] ?? resolved) : resolved;
    const pricing = getModelPricing(model);
    const calls = pick(line.calls);
    const input = calls * pick(line.input);
    const output = calls * pick(line.output);
    const cachedRate = pricing.cachedInput ?? pricing.input;
    usd += ((input * (1 - cachedShare)) / 1e6) * pricing.input + ((input * cachedShare) / 1e6) * cachedRate + (output / 1e6) * pricing.output;
  }
  for (const media of envelope.media ?? []) usd += pick(media.count) * MEDIA_UNIT_USD[media.unit];
  return { usd, xaf: usd * getXafPerUsd() };
}

/** Arrondi commercial vers le haut : 1 à 10 à l'unité, puis par 5, puis par 10. */
function nicePrice(credits: number): number {
  if (credits <= 10) return Math.ceil(credits);
  if (credits <= 60) return Math.ceil(credits / 5) * 5;
  return Math.ceil(credits / 10) * 10;
}

export interface ScenarioRow {
  key: string;
  label: string;
  engine: BillingEngine | 'free';
  level: CreativityLevel;
  creativity: boolean;
  currentCredits: number;
  current: { typical: ScenarioCost; max: ScenarioCost };
  target: { typical: ScenarioCost; max: ScenarioCost };
  minimumCredits: number;
  recommendedCredits: number;
  /** Marge typique au prix recommandé, au prix net de référence. */
  typicalMargin: number | null;
  /** Marge au plafond, au prix net plancher. */
  floorMargin: number | null;
  virtual: boolean;
}

function row(key: string, envelope: GenerationEnvelope, level: CreativityLevel, currentCredits: number, virtual: boolean): ScenarioRow {
  const after = transform(key, envelope);
  const target = { typical: cost(key, after, level, 'typical', true), max: cost(key, after, level, 'max', true) };
  const current = virtual ? target : { typical: cost(key, envelope, level, 'typical', false), max: cost(key, envelope, level, 'max', false) };
  const minimumCredits = Math.max(
    Math.ceil(target.max.xaf / CREDIT_VALUE_XAF.floor),
    Math.ceil(target.typical.xaf / (CREDIT_VALUE_XAF.reference * (1 - TARGET_TYPICAL_MARGIN)))
  );
  // Gratuit par choix (la génération initiale d'iCode) : reste gratuit, borné par son quota.
  const recommendedCredits = envelope.engine === 'free' || (currentCredits === 0 && !virtual) ? 0 : Math.max(currentCredits, nicePrice(minimumCredits));
  return withPrice({
    key,
    label: envelope.label,
    engine: envelope.engine,
    level,
    creativity: envelope.creativity,
    currentCredits,
    current,
    target,
    minimumCredits,
    recommendedCredits,
    typicalMargin: null,
    floorMargin: null,
    virtual,
  }, recommendedCredits);
}

/** Fixe le prix recommandé d'une ligne et recalcule ses deux marges. */
function withPrice(entry: ScenarioRow, credits: number): ScenarioRow {
  const reference = credits * CREDIT_VALUE_XAF.reference;
  const floor = credits * CREDIT_VALUE_XAF.floor;
  return {
    ...entry,
    recommendedCredits: credits,
    typicalMargin: reference > 0 ? 1 - entry.target.typical.xaf / reference : null,
    floorMargin: floor > 0 ? 1 - entry.target.max.xaf / floor : null,
  };
}

/** Le scénario cible, action par action et cran par cran (une ligne par cran si l'action suit la jauge). */
export function targetScenario(levels: readonly CreativityLevel[]): ScenarioRow[] {
  const rows: ScenarioRow[] = [];
  for (const [key, envelope] of Object.entries(GENERATION_ENVELOPES)) {
    if (envelope.engine === 'free') continue;
    if (!envelope.creativity) {
      rows.push(row(key, envelope, 'medium', creditPriceOf(key, 'medium'), false));
      continue;
    }
    // Une action qui suit la jauge garde UN prix de base, multiplié par cran : la base retenue est
    // la plus petite qui couvre le minimum de chaque cran.
    const perLevel = levels.map((level) => row(key, envelope, level, creditPriceOf(key, level), false));
    const currentBase = creditPriceOf(key, 'medium');
    const neededBase = Math.max(...perLevel.map((entry) => entry.minimumCredits / CREATIVITY_MULTIPLIER[entry.level]));
    const base = Math.max(currentBase, nicePrice(neededBase));
    for (const entry of perLevel) rows.push(withPrice(entry, creativityCost(base, entry.level)));
  }
  for (const virtual of VIRTUAL) rows.push(row(virtual.key, virtual.envelope, 'medium', virtual.price, true));
  return rows;
}
