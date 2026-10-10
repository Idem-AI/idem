/**
 * LA MÉMOIRE D'EXPÉRIENCE — le graphe apprend ce qui marche (mémoire GLOBALE, tous projets).
 *
 * Les poids du graphe et des motifs sont des a priori écrits à la main. Chaque vidéo produite
 * laisse des compteurs : par motif, par motif × direction, par combinaison (motif + coupe +
 * direction), par nœud du graphe (animation de logo, fond, caméra…) et par cran :
 *
 *   n         vidéos (ou plans) où il a servi
 *   kept      retenu jusqu'au bout (mise en page gardée, plan codé validé)
 *   repaired  réparé par le code (règles, contrôle créatif, critique du film)
 *   fallback  plan Ultra replié sur la composition éprouvée
 *   criticOk / criticRevise   verdict final de la critique visuelle (Ultra)
 *   exported  la vidéo a été exportée par l'utilisateur (le signal le plus fiable)
 *   tokensIn / tokensOut / ms (par cran)
 *
 * Le planificateur en tire une QUALITÉ OBSERVÉE, lissée (bayésienne : il faut des preuves pour
 * s'écarter de l'a priori) et bornée (±0,25) : le graphe passe de « poids écrits à la main » à
 * « a priori + performance observée + nouveauté + retour de l'utilisateur », sans jamais pouvoir
 * s'emballer. Les compteurs ne contiennent aucune donnée de projet : des identifiants de motifs.
 *
 * L'observabilité ne casse jamais une génération : lecture bornée à 1,5 s, écritures sans attente,
 * erreurs avalées, base absente = a priori seuls.
 */
import mongoose from 'mongoose';
import logger from '../runtime/logger';

export type ExperienceCounts = Record<string, number>;

export interface PatternOutcome {
  pattern: string;
  direction?: string;
  transitionIn?: string;
  experimental: boolean;
  kept: boolean;
  repaired?: boolean;
  fallback?: boolean;
  critic?: 'ok' | 'revise';
}

export interface VideoOutcome {
  level: string;
  direction?: string;
  patterns: PatternOutcome[];
  /** Nœuds du graphe retenus (logo, fond, caméra…). */
  nodes: string[];
  novelty?: number | null;
  tokens: { input: number; output: number };
  ms?: number;
}

export interface ExperienceBackend {
  load(): Promise<Record<string, ExperienceCounts>>;
  increment(rows: { key: string; inc: ExperienceCounts }[]): Promise<void>;
}

/** En mémoire : contrôles, et repli quand la base n'est pas là. */
export class MemoryExperienceBackend implements ExperienceBackend {
  readonly rows: Record<string, ExperienceCounts> = {};
  async load() {
    return JSON.parse(JSON.stringify(this.rows));
  }
  async increment(rows: { key: string; inc: ExperienceCounts }[]) {
    for (const { key, inc } of rows) {
      const row = (this.rows[key] ||= {});
      for (const [k, v] of Object.entries(inc)) row[k] = (row[k] || 0) + v;
    }
  }
}

/** MongoDB, collection `video_experience` : `$inc` + upsert, jamais lecture-puis-écriture. */
export class MongoExperienceBackend implements ExperienceBackend {
  private readonly name = 'video_experience';
  private connected() {
    return mongoose.connection?.readyState === 1;
  }
  async load() {
    if (!this.connected()) return {};
    const docs = await mongoose.connection.collection(this.name).find({}, { projection: { _id: 0 } }).limit(5000).toArray();
    const out: Record<string, ExperienceCounts> = {};
    for (const d of docs as any[]) if (typeof d.key === 'string') out[d.key] = Object.fromEntries(Object.entries(d).filter(([k, v]) => k !== 'key' && typeof v === 'number')) as ExperienceCounts;
    return out;
  }
  async increment(rows: { key: string; inc: ExperienceCounts }[]) {
    if (!this.connected() || !rows.length) return;
    const now = new Date();
    await mongoose.connection.collection(this.name).bulkWrite(
      rows.map(({ key, inc }) => ({ updateOne: { filter: { key }, update: { $inc: inc, $set: { updatedAt: now }, $setOnInsert: { key, createdAt: now } }, upsert: true } })),
      { ordered: false }
    );
  }
}

/** Force du lissage : il faut ~8 observations pour que la qualité observée pèse autant que l'a priori. */
const PRIOR_STRENGTH = 8;
const MAX_DELTA = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class ExperienceMemory {
  private cache: Record<string, ExperienceCounts> = {};
  private loadedAt = 0;
  private loading?: Promise<void>;

  constructor(
    private readonly backend: ExperienceBackend,
    private readonly ttlMs = 10 * 60_000
  ) {}

  /** Recharge les compteurs (au plus toutes les 10 min) ; jamais d'erreur, jamais plus de `timeoutMs`. */
  async refresh(timeoutMs = 1500): Promise<void> {
    if (Date.now() - this.loadedAt < this.ttlMs) return;
    this.loading ??= this.backend
      .load()
      .then((rows) => {
        this.cache = rows;
        this.loadedAt = Date.now();
      })
      .catch((error: any) => {
        logger.warn('video.experience_load_failed', { error: error?.message });
      })
      .finally(() => (this.loading = undefined));
    await Promise.race([this.loading, new Promise((r) => setTimeout(r, timeoutMs))]);
  }

  counts(key: string): ExperienceCounts {
    return this.cache[key] || {};
  }

  /** Taux de réussite observé d'une clé, de 0 à 1 (null sans observation). */
  private rate(c: ExperienceCounts): number | null {
    const n = c.n || 0;
    if (!n) return null;
    const success = (c.kept || 0) - (c.fallback || 0) - 0.6 * (c.criticRevise || 0) - 0.4 * (c.repaired || 0) + 0.3 * (c.exported || 0);
    return clamp(success / n, 0, 1);
  }

  /**
   * Qualité d'un motif : a priori lissé par ce qui a été observé (toutes directions, puis dans cette
   * direction), bornée à ±0,25 de l'a priori.
   */
  quality(pattern: string, direction: string | undefined, prior: number): { value: number; n: number } {
    const smooth = (c: ExperienceCounts) => {
      const n = c.n || 0;
      const r = this.rate(c);
      return r == null ? prior : (r * n + prior * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
    };
    const all = this.counts(`p:${pattern}`);
    const here = direction ? this.counts(`p:${pattern}|d:${direction}`) : {};
    const q = (here.n || 0) >= 3 ? 0.5 * smooth(all) + 0.5 * smooth(here) : smooth(all);
    return { value: clamp(q, prior - MAX_DELTA, prior + MAX_DELTA), n: all.n || 0 };
  }

  /** Qualité observée d'une combinaison motif + coupe + direction (null tant qu'elle est trop rare). */
  comboQuality(pattern: string, transition: string, direction: string): number | null {
    const c = this.counts(`x:${pattern}|${transition}|${direction}`);
    if ((c.n || 0) < 3) return null;
    return this.rate(c);
  }

  /**
   * Écart d'un nœud du graphe (logo:morph, bg:flow-field…) au taux d'export moyen : les vidéos que
   * les utilisateurs exportent plus souvent font monter leurs choix. Borné à ±0,4, nul sans preuves.
   */
  nodeDelta(id: string): number {
    const c = this.counts(`n:${id}`);
    const all = this.counts('v:all');
    const n = c.n || 0;
    if (n < 5 || !(all.n || 0)) return 0;
    const base = (all.exported || 0) / all.n;
    const rate = (c.exported || 0) / n;
    const confidence = n / (n + PRIOR_STRENGTH);
    return clamp((rate - base) * confidence, -0.4, 0.4);
  }

  /** Inscrit ce qu'une vidéo a produit (sans attendre l'écriture). */
  async record(outcome: VideoOutcome): Promise<void> {
    const rows: { key: string; inc: ExperienceCounts }[] = [];
    for (const p of outcome.patterns) {
      const inc: ExperienceCounts = { n: 1, kept: p.kept ? 1 : 0, repaired: p.repaired ? 1 : 0, fallback: p.fallback ? 1 : 0, experimental: p.experimental ? 1 : 0 };
      if (p.critic === 'ok') inc.criticOk = 1;
      if (p.critic === 'revise') inc.criticRevise = 1;
      rows.push({ key: `p:${p.pattern}`, inc });
      if (p.direction) rows.push({ key: `p:${p.pattern}|d:${p.direction}`, inc: { ...inc } });
      if (p.direction && p.transitionIn) rows.push({ key: `x:${p.pattern}|${p.transitionIn}|${p.direction}`, inc: { ...inc } });
    }
    for (const id of new Set(outcome.nodes)) rows.push({ key: `n:${id}`, inc: { n: 1 } });
    const video: ExperienceCounts = { n: 1, tokensIn: outcome.tokens.input, tokensOut: outcome.tokens.output, ms: outcome.ms || 0 };
    if (outcome.novelty != null) video.novelty = outcome.novelty;
    rows.push({ key: `v:${outcome.level}`, inc: video }, { key: 'v:all', inc: { n: 1 } });
    this.apply(rows);
    await this.backend.increment(rows).catch((error: any) => logger.warn('video.experience_write_failed', { error: error?.message }));
  }

  /** L'utilisateur a exporté la vidéo : ses motifs et ses nœuds ont fait leurs preuves. */
  async recordExport(patterns: string[], nodes: string[], direction?: string): Promise<void> {
    const rows: { key: string; inc: ExperienceCounts }[] = [
      ...[...new Set(patterns)].flatMap((p) => [{ key: `p:${p}`, inc: { exported: 1 } }, ...(direction ? [{ key: `p:${p}|d:${direction}`, inc: { exported: 1 } }] : [])]),
      ...[...new Set(nodes)].map((id) => ({ key: `n:${id}`, inc: { exported: 1 } })),
      { key: 'v:all', inc: { exported: 1 } },
    ];
    this.apply(rows);
    await this.backend.increment(rows).catch((error: any) => logger.warn('video.experience_write_failed', { error: error?.message }));
  }

  /** Les compteurs locaux suivent sans attendre la base (la prochaine vidéo en profite). */
  private apply(rows: { key: string; inc: ExperienceCounts }[]) {
    for (const { key, inc } of rows) {
      const row = (this.cache[key] ||= {});
      for (const [k, v] of Object.entries(inc)) row[k] = (row[k] || 0) + v;
    }
  }
}

/** La mémoire globale du moteur (MongoDB si la base est connectée, a priori seuls sinon). */
export const videoExperience = new ExperienceMemory(new MongoExperienceBackend());
