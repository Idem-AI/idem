/**
 * LA BIBLIOTHÈQUE D'EXEMPLES (plan qualité créative, phase 5) — des pages de qualité, fabriquées UNE fois hors ligne
 * par un gros modèle et triées par la mesure, montrées à l'auteur comme des PRINCIPES, jamais comme des gabarits.
 *
 * Méthode inspirée de LayoutPrompter (Microsoft, MIT ; réécrite ici) : pour une page, on retient deux exemples PROCHES
 * par l'intention (même nature de toile, même rôle, intention voisine) mais ÉLOIGNÉS entre eux (deux partis pris
 * différents), pour que l'auteur prenne une idée de construction sans recopier une composition. Les mots des exemples
 * sont retirés (seule la structure reste) ; la garde anti-copie (`isCopy`) écarte une page trop proche d'un exemple.
 *
 * La bibliothèque est un fichier JSON (`IDEM_EXAMPLES_FILE`, construit par `scripts/build-examples.ts`). Sans fichier,
 * rien ne change. `IDEM_QUALITY_EXAMPLES=0` la coupe.
 */
import fs from 'fs';
import { cosine, decodeVector, textEmbedding } from '@idem/design-tools';
import type { FormatDef } from '../design-system/formats';

export interface PageExample {
  id: string;
  /** La nature de la toile (`slide`, `document`, `card`, `visual`, `cover`). */
  nature: string;
  /** Le rôle de la page (couverture, spécimen, chiffres…), s'il est connu. */
  role?: string;
  /** Ce que la page fait (une phrase) : la clé de la recherche. */
  intent: string;
  /** Le HTML Tailwind de la page, ses textes remplacés par des clés neutres. */
  html: string;
  /** L'empreinte CLIP de son rendu (base64, 512 flottants) : pour la garde anti-copie. */
  vector?: string;
  /** Les mesures qui l'ont fait entrer (score du code). */
  score?: number;
}

interface Loaded {
  examples: PageExample[];
  intents: Float32Array[];
  vectors: (Float32Array | null)[];
}

let cache: { file: string; loaded: Loaded } | null = null;

function load(): Loaded | null {
  if (process.env.IDEM_QUALITY_EXAMPLES === '0') return null;
  const file = process.env.IDEM_EXAMPLES_FILE?.trim();
  if (!file || !fs.existsSync(file)) return null;
  if (cache?.file === file) return cache.loaded;
  try {
    const examples = (JSON.parse(fs.readFileSync(file, 'utf8')) as { examples?: PageExample[] }).examples ?? [];
    const loaded: Loaded = {
      examples,
      intents: examples.map((e) => textEmbedding(`${e.nature} ${e.role ?? ''} ${e.intent}`)),
      vectors: examples.map((e) => {
        try {
          return e.vector ? decodeVector(e.vector) : null;
        } catch {
          return null;
        }
      }),
    };
    cache = { file, loaded };
    return loaded;
  } catch {
    return null;
  }
}

export function natureOf(format: FormatDef, role?: string): string {
  if (role === 'cover') return 'cover';
  return format.family === 'card' ? 'card' : format.family === 'visual' || format.family === 'cover' ? 'visual' : format.kind === 'flow' ? 'document' : 'slide';
}

/** Les deux exemples à montrer : proches de l'intention, éloignés entre eux. */
export function pickExamples(query: { nature: string; role?: string; intent: string }, count = 2): PageExample[] {
  const lib = load();
  if (!lib || !lib.examples.length) return [];
  const q = textEmbedding(`${query.nature} ${query.role ?? ''} ${query.intent}`);
  const ranked = lib.examples
    .map((e, i) => ({ e, i, sim: cosine(q, lib.intents[i]) + (e.nature === query.nature ? 0.3 : 0) + (query.role && e.role === query.role ? 0.15 : 0) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 12);
  if (!ranked.length) return [];
  const chosen = [ranked[0]];
  while (chosen.length < count && chosen.length < ranked.length) {
    // Le suivant : pertinent ET le plus différent de ceux déjà retenus (diversité maximale).
    const next = ranked.filter((r) => !chosen.includes(r)).map((r) => ({ r, gain: r.sim - Math.max(...chosen.map((c) => cosine(lib.intents[c.i], lib.intents[r.i]))) })).sort((a, b) => b.gain - a.gain)[0];
    if (!next) break;
    chosen.push(next.r);
  }
  return chosen.map((c) => c.e);
}

/** Le bloc donné à l'auteur : la structure de chaque exemple, et la consigne de ne pas la recopier. */
export function examplesLines(examples: PageExample[]): string {
  if (!examples.length) return '';
  return [
    'EXAMPLES OF PRINCIPLE (well-built pages for other brands — take ONE construction idea from them; never reproduce their layout, never reuse their structure as a template):',
    ...examples.map((e, i) => `EXAMPLE ${i + 1} — ${e.intent}\n\`\`\`html\n${e.html.slice(0, 2400)}\n\`\`\``),
  ].join('\n\n');
}

/** La garde anti-copie : la page rendue ressemble-t-elle trop à l'un des exemples montrés ? */
export function isCopy(vector: Float32Array | undefined, shown: PageExample[], threshold = Number(process.env.IDEM_EXAMPLES_COPY_THRESHOLD) || 0.93): boolean {
  if (!vector || !shown.length) return false;
  const lib = load();
  if (!lib) return false;
  return shown.some((e) => {
    const v = lib.vectors[lib.examples.indexOf(e)];
    return !!v && cosine(vector, v) >= threshold;
  });
}
