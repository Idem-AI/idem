/**
 * MÉTHODE ÉDITORIALE : ce que le code décide, pour que le modèle n'ait que l'écriture à faire.
 *
 * Tiré de la doctrine « mémoire de marque » : une idée forte par publication, des rendez-vous
 * récurrents reconnaissables (franchises), un arc qui fait avancer la compréhension de semaine
 * en semaine, une répartition équilibrée des piliers, un ancrage de marque dans chaque post,
 * et des garde-fous éthiques. Tout ce qui est arithmétique (quotas, jours, arc, contrôle) est
 * calculé ICI — jamais demandé à un prompt.
 */
import type { ContentIdea } from '../../../models/communication.model';

// ─── Piliers ────────────────────────────────────────────────────────────────

/** Six piliers génériques, valables pour tout projet ; la boussole de la marque leur donne son contenu. */
export const PILLARS = ['reality-education', 'demonstration', 'proof', 'culture', 'vision', 'activation'] as const;
export type EditorialPillar = (typeof PILLARS)[number];

/** Répartition de départ (à ajuster avec les performances) : 30 / 25 / 15 / 15 / 10 / 5. */
const PILLAR_SHARE: Record<EditorialPillar, number> = {
  'reality-education': 0.3,
  demonstration: 0.25,
  proof: 0.15,
  culture: 0.15,
  vision: 0.1,
  activation: 0.05,
};

/** Combien de contenus par pilier pour `count` contenus (plus fort reste, un seul total exact). */
export function pillarQuota(count: number): Record<EditorialPillar, number> {
  const raw = PILLARS.map((p) => ({ p, exact: PILLAR_SHARE[p] * count }));
  const quota = Object.fromEntries(raw.map(({ p, exact }) => [p, Math.floor(exact)])) as Record<EditorialPillar, number>;
  let left = count - Object.values(quota).reduce((a, b) => a + b, 0);
  for (const { p } of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left <= 0) break;
    quota[p]++;
    left--;
  }
  return quota;
}

export const quotaLine = (quota: Record<EditorialPillar, number>): string =>
  PILLARS.filter((p) => quota[p] > 0)
    .map((p) => `${quota[p]} × ${p}`)
    .join(', ');

export const toPillar = (value: unknown): EditorialPillar | undefined => (PILLARS.includes(value as EditorialPillar) ? (value as EditorialPillar) : undefined);

// ─── Arc de la période ──────────────────────────────────────────────────────

export type ArcRole = 'problem' | 'method' | 'product' | 'proof';

const ARC_TEXT: Record<ArcRole, string> = {
  problem: 'make the problem visible and recognisable (a real situation of the audience)',
  method: 'bring a useful method or piece of information the audience can use even without the brand',
  product: 'show the brand in action: what it concretely does, with a demonstration',
  proof: 'bring proof, answer an objection, and trigger one clear action',
};

/** Rôle d'un point de la période (0 → 1) : problème, méthode, produit en action, preuve + action. */
export function arcRoleAt(position: number): ArcRole {
  if (position < 0.25) return 'problem';
  if (position < 0.5) return 'method';
  if (position < 0.75) return 'product';
  return 'proof';
}

/** Les rôles que traverse une tranche de la période, dans l'ordre, dits en une phrase. Période courte : pas d'arc forcé. */
export function arcLine(sliceFrom: number, sliceTo: number, periodDays: number): string {
  if (periodDays < 21) return 'Short period: no forced arc — every content moves the audience one step closer to the brand promise.';
  const roles: ArcRole[] = [];
  for (const point of [sliceFrom, (sliceFrom + sliceTo) / 2, sliceTo]) {
    const role = arcRoleAt(Math.min(0.999, Math.max(0, point)));
    if (!roles.includes(role)) roles.push(role);
  }
  return roles.map((r) => `${r}: ${ARC_TEXT[r]}`).join(' → ');
}

// ─── Franchises (rendez-vous récurrents) ────────────────────────────────────

export interface Franchise {
  /** Nom du rendez-vous, court et mémorable. */
  name: string;
  /** `participation` (jeu, défi, énigme, sondage) · `identification` (humour de situation) · `teaching` · `behind` (coulisses). */
  role: 'participation' | 'identification' | 'teaching' | 'behind';
  /** Jour fixe : 1 = lundi … 7 = dimanche. */
  weekday: number;
  /** Mécanismes à faire tourner (jamais deux fois de suite le même). */
  mechanisms: string[];
}

const ROLES: Franchise['role'][] = ['participation', 'identification', 'teaching', 'behind'];

/** Franchises proposées par le modèle, ramenées à leur forme : 0 à 3, jours distincts, mécanismes bornés. */
export function normaliseFranchises(raw: unknown): Franchise[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<number>();
  const out: Franchise[] = [];
  for (const entry of raw) {
    const name = typeof entry?.name === 'string' ? entry.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const weekday = Math.round(Number(entry?.weekday));
    if (!name || !(weekday >= 1 && weekday <= 7) || used.has(weekday)) continue;
    used.add(weekday);
    out.push({
      name,
      role: ROLES.includes(entry.role) ? entry.role : 'participation',
      weekday,
      mechanisms: (Array.isArray(entry.mechanisms) ? entry.mechanisms : [])
        .map((m: unknown) => (typeof m === 'string' ? m.replace(/\s+/g, ' ').trim().slice(0, 60) : ''))
        .filter(Boolean)
        .slice(0, 6),
    });
    if (out.length === 3) break;
  }
  return out;
}

/** Jour de la semaine d'une date ISO : 1 = lundi … 7 = dimanche. */
export const weekdayOf = (iso: string): number => ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Ramène une date au jour de la franchise le plus proche, sans sortir de [start, end]. Sans jour possible : inchangée. */
export function snapToWeekday(iso: string, weekday: number, range: { start: string; end: string }): string {
  for (let delta = 0; delta <= 3; delta++) {
    for (const sign of delta === 0 ? [1] : [-1, 1]) {
      const day = addDays(iso, delta * sign);
      if (day >= range.start && day <= range.end && weekdayOf(day) === weekday) return day;
    }
  }
  return iso;
}

export const franchisesLine = (franchises: Franchise[]): string =>
  franchises.length
    ? franchises.map((f) => `"${f.name}" (${f.role}, every ${WEEKDAYS[f.weekday - 1]}; mechanisms to rotate: ${f.mechanisms.join(' | ') || 'free'})`).join(' ; ')
    : '(none)';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Contrôle qualité déterministe ──────────────────────────────────────────

/** Promesses de gain, d'urgence ou de honte : refusées quelle que soit la note (doctrine éthique). */
const BLOCKING: { rule: string; pattern: RegExp }[] = [
  { rule: 'guaranteed-result', pattern: /garanti|guarantee|100\s?%\s?(sûr|rentable|succès|success)|sans risque|risk[- ]free|get rich|devenez riche|gains? assur[ée]s?/i },
  { rule: 'fake-urgency', pattern: /dernière chance|last chance|plus que \d+ places?|only \d+ (left|spots)|offre expire (dans|in)/i },
  { rule: 'shame-or-fear', pattern: /\bhonte\b|ashamed|tu vas échouer|you will fail|loser|ratés?\b/i },
  { rule: 'absolute-claim', pattern: /\ble meilleur outil\b|the best tool|personne d'autre ne|nobody else|\bsolution ultime\b|ultimate solution/i },
];

export interface QualityReport {
  issues: string[];
  /** Un défaut qui interdit la publication telle quelle (promesse, urgence factice, honte). */
  blocking: boolean;
}

/**
 * Les règles d'une publication, vérifiées par le code : ancrage de marque, une seule action,
 * hashtags bornés, aucune promesse de gain ni urgence factice. Ne note pas la créativité —
 * cela, aucun contrôle de code ne peut le faire.
 */
export function checkItem(item: Partial<ContentIdea>, brandName: string): QualityReport {
  const issues: string[] = [];
  let blocking = false;
  const text = [item.title, item.hook, item.description, item.caption, item.callToAction, item.anchor].filter(Boolean).join(' ');

  for (const { rule, pattern } of BLOCKING) {
    if (pattern.test(text)) {
      issues.push(rule);
      blocking = true;
    }
  }
  const brand = (brandName || '').trim().toLowerCase();
  if (brand.length > 1 && !text.toLowerCase().includes(brand)) issues.push('no-brand-anchor');
  if (!item.anchor) issues.push('no-anchor-sentence');
  if (!item.callToAction) issues.push('no-call-to-action');
  if ((item.hashtags?.length ?? 0) > 5) issues.push('too-many-hashtags');
  if (/^(découvrez|discover)\b/i.test((item.title || '').trim()) && (item.title || '').split(/\s+/).length < 5) issues.push('generic-title');
  return { issues, blocking };
}

/** Deux titres disent-ils la même chose reformulée ? (recouvrement de mots porteurs de sens) */
export function sameAngle(a: string, b: string): boolean {
  const words = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const A = words(a);
  const B = words(b);
  if (A.size < 3 || B.size < 3) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.7;
}

// ─── Tendances ──────────────────────────────────────────────────────────────

/** Seuil de la grille de sélection (5 critères × 0-2 points) : en dessous, la tendance n'est pas retenue. */
export const TREND_MIN_SCORE = 7;

export interface PlanTrend {
  label: string;
  description?: string;
  /** Pourquoi les gens réagissent : le MÉCANISME à réécrire, pas le contenu à copier. */
  mechanism?: string;
  /** Note /10 : pertinence, lien avec la marque, culture locale, faisabilité, potentiel de mémorisation. */
  score?: number;
  source?: string;
  /** Date d'observation (YYYY-MM-DD) : une tendance se périme. */
  observedAt?: string;
}

/** Garde les tendances qui passent le seuil ; une note absente est jugée à 7 (le modèle n'a pas noté, la source existe). */
export function keepTrends(raw: unknown, observedAt: string, source?: string): PlanTrend[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t.label === 'string' && t.label.trim())
    .map((t) => {
      const score = Number.isFinite(Number(t.score)) ? Math.max(0, Math.min(10, Math.round(Number(t.score)))) : TREND_MIN_SCORE;
      return {
        label: String(t.label).replace(/\s+/g, ' ').trim().slice(0, 80),
        description: t.description ? String(t.description).slice(0, 220) : undefined,
        mechanism: t.mechanism ? String(t.mechanism).slice(0, 200) : undefined,
        score,
        source,
        observedAt,
      } as PlanTrend;
    })
    .filter((t) => (t.score ?? 0) >= TREND_MIN_SCORE)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);
}

// ─── Principes (injectés dans les prompts) ──────────────────────────────────

/** Les règles de fond, courtes : une seule source pour le brief, les contenus et les plans vidéo. */
export const EDITORIAL_PRINCIPLES = `<principles>
- ONE strong idea per content, a concrete proof or explanation, an explicit link with the brand. Priority: understanding > relevance > memorability > creativity > quantity.
- BRAND ANCHOR in every content: the brand name, what it is (its category), its concrete role in this content, and the benefit for the audience. Never the name of a product alone — explain its role the first time.
- A person who sees ONE content only must understand what the brand is and who it is for. Humour, games and trends never make the brand mysterious.
- Be useful: the content teaches, entertains, reassures, proves or triggers an action. One main action per content, never several.
- Ethics: no guaranteed result or promised profit (profitability is a goal, never a promise), no fake urgency, no fake statistic, testimonial, partnership or price, no shame, no pressure on people with few means. A situation presented as a story is illustrative, never a "real customer" unless the context says so.
- Facts: use ONLY what the context and the brief state. A number, a date, a price or a result that is not given is left out, never estimated.
- Trends are raw material, not strategy: reuse the creative MECHANISM of a trend with the brand's subject, never copy a sound, a meme or a format as is.
</principles>`;
