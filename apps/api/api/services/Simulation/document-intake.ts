/**
 * Admission d'un business plan importé — sans IA.
 *
 * Un document importé arrive brut : il peut faire deux cents pages, ne pas
 * être un business plan du tout, ou n'être qu'un scan illisible. Envoyer cela
 * tel quel au modèle coûte cher et, pour un document hors sujet, coûte cher
 * pour rien.
 *
 * Ce module fait donc trois choses, toutes déterministes :
 *   1. il extrait le texte et refuse ce qui n'est pas lisible ;
 *   2. il juge, par simple comptage de signaux, si le document ressemble à un
 *      business plan — un refus ici ne consomme aucun jeton ;
 *   3. il condense le document en ne gardant que les passages porteurs
 *      d'information, dans un budget fixe.
 *
 * Le modèle ne voit donc jamais le document entier, mais un extrait
 * représentatif d'une dizaine de milliers de caractères. Le verdict final lui
 * revient malgré tout : un document bien écrit mais hors sujet passe les
 * comptages, pas la lecture.
 */

import * as crypto from 'crypto';

/** Formats acceptés. Au-delà, il faudrait un extracteur (PDF, DOCX). */
export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.json'] as const;
export const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
] as const;

/** En deçà, il n'y a pas de quoi décrire une activité. */
const MIN_READABLE_CHARS = 400;

/** Ce qui part au modèle. Un business plan tient largement là-dedans. */
const CONDENSED_BUDGET_CHARS = 14_000;

/** Taille d'un passage. Assez pour un paragraphe complet, pas pour une page. */
const CHUNK_TARGET_CHARS = 900;

/**
 * Familles de signaux d'un business plan. Un document doit toucher plusieurs
 * familles : un contrat parle d'argent, un CV parle d'expérience, seul un plan
 * parle à la fois d'offre, de marché, d'argent et d'exécution.
 */
const SIGNAL_FAMILIES: Record<string, RegExp[]> = {
  offre: [
    /\bproduits?\b/i, /\bservices?\b/i, /\boffres?\b/i, /\bsolutions?\b/i,
    /\bproposition de valeur\b/i, /\bvalue proposition\b/i, /\bcatalogue\b/i,
  ],
  marche: [
    /\bmarch[ée]s?\b/i, /\bclients?\b/i, /\bclient[èe]le\b/i, /\bcibles?\b/i,
    /\bconcurren\w+/i, /\bsegments?\b/i, /\bdemande\b/i, /\bcustomers?\b/i,
  ],
  argent: [
    /\bchiffre d'affaires\b/i, /\brevenus?\b/i, /\bco[ûu]ts?\b/i, /\bcharges?\b/i,
    /\bmarges?\b/i, /\bprix\b/i, /\btarif\w*/i, /\brentabilit[ée]\b/i,
    /\binvestissement\b/i, /\bfinancement\b/i, /\btr[ée]sorerie\b/i, /\bbudget\b/i,
    /\brevenue\b/i, /\bpricing\b/i, /\bcash ?flow\b/i,
  ],
  execution: [
    /\bstrat[ée]gie\b/i, /\b[ée]quipe\b/i, /\bplan\b/i, /\bobjectifs?\b/i,
    /\bcroissance\b/i, /\bd[ée]veloppement\b/i, /\blancement\b/i, /\bpr[ée]visions?\b/i,
    /\broadmap\b/i, /\bmilestones?\b/i,
  ],
};

/** Deux familles touchées : en dessous, ce n'est pas un plan d'entreprise. */
const MIN_FAMILIES = 2;
/** Et il faut une densité minimale, pour écarter la mention isolée. */
const MIN_SIGNALS = 6;

/** Titres qui ouvrent les passages les plus utiles à une simulation. */
const HIGH_VALUE_HEADINGS =
  /(r[ée]sum[ée]|synth[èe]se|executive summary|activit[ée]|offre|produit|service|march[ée]|client|concurrence|business model|mod[èe]le [ée]conomique|prix|tarif|financ|pr[ée]vision|budget|co[ûu]t|charge|revenu|chiffre d'affaires|[ée]quipe|strat[ée]gie|risque)/i;

export interface DocumentBrief {
  /** L'extrait envoyé au modèle. */
  text: string;
  /** Taille du document d'origine, en caractères lisibles. */
  originalChars: number;
  /** Taille de l'extrait. */
  briefChars: number;
  /** Empreinte du document nettoyé, pour le cache. */
  digest: string;
  /** Familles de signaux touchées, pour la journalisation. */
  families: string[];
}

/** Refus argumenté, remonté tel quel à l'utilisateur. */
export class UnusableDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnusableDocumentError';
  }
}

/** Vrai si le fichier est d'un format que l'on sait lire. */
export function isAcceptedDocument(fileName: string, mimeType?: string): boolean {
  const lower = (fileName || '').toLowerCase();
  const byExtension = ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
  const byMime = !!mimeType && (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
  // Les navigateurs déclarent le Markdown de façon peu fiable : l'extension
  // fait foi dès qu'elle est reconnue.
  return byExtension || byMime;
}

/**
 * Nettoie le texte brut : espaces, numéros de page, en-têtes répétés d'un
 * export PDF, lignes de séparation. Purement mécanique.
 */
export function normalizeDocument(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  // Une ligne courte qui revient à l'identique plus de trois fois est un
  // en-tête ou un pied de page, pas du contenu.
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line && line.length < 80) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }

  const kept = lines.filter((line) => {
    if (!line) return true;
    if (/^[-=_*·•.\s]+$/.test(line)) return false;
    if (/^(page\s*)?\d+(\s*\/\s*\d+)?$/i.test(line)) return false;
    return (counts.get(line) ?? 0) <= 3;
  });

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Compte les signaux par famille. Aucun appel externe. */
export function scoreDocument(text: string): { families: string[]; signals: number } {
  const sample = text.slice(0, 60_000);
  const families: string[] = [];
  let signals = 0;

  for (const [family, patterns] of Object.entries(SIGNAL_FAMILIES)) {
    let hits = 0;
    for (const pattern of patterns) {
      const matches = sample.match(new RegExp(pattern.source, 'gi'));
      if (matches) hits += matches.length;
    }
    if (hits > 0) {
      families.push(family);
      signals += hits;
    }
  }

  return { families, signals };
}

/**
 * Ne garde que les passages porteurs d'information, dans le budget imparti.
 *
 * L'ouverture est toujours conservée — un business plan y met son résumé —
 * puis les passages sont classés par densité de signaux et de chiffres, et
 * repris dans l'ordre du document pour que le modèle lise un texte cohérent.
 */
export function condenseDocument(text: string, budget = CONDENSED_BUDGET_CHARS): string {
  if (text.length <= budget) {
    return text;
  }

  const chunks = splitIntoChunks(text);
  const opening: number[] = [];
  let openingChars = 0;
  for (let i = 0; i < chunks.length && openingChars < budget * 0.25; i++) {
    opening.push(i);
    openingChars += chunks[i].length;
  }

  const scored = chunks
    .map((chunk, index) => ({ index, chunk, score: chunkScore(chunk) }))
    .filter((entry) => !opening.includes(entry.index))
    .sort((a, b) => b.score - a.score);

  const selected = new Set(opening);
  let total = openingChars;
  for (const entry of scored) {
    if (total + entry.chunk.length > budget) continue;
    selected.add(entry.index);
    total += entry.chunk.length;
    if (total >= budget * 0.98) break;
  }

  const ordered = [...selected].sort((a, b) => a - b);
  const parts: string[] = [];
  let previous = -1;
  for (const index of ordered) {
    // On signale les coupes : le modèle doit savoir qu'il lit un extrait.
    if (previous !== -1 && index !== previous + 1) {
      parts.push('[…]');
    }
    parts.push(chunks[index]);
    previous = index;
  }

  return parts.join('\n\n');
}

/**
 * Prépare le document pour le modèle, ou refuse.
 *
 * @throws UnusableDocumentError quand le document est illisible ou n'a
 * manifestement rien d'un business plan — sans qu'aucun jeton n'ait été
 * dépensé.
 */
export function prepareDocument(raw: string, documentName: string): DocumentBrief {
  // « Vide » se juge sur le fichier reçu, avant tout nettoyage : sinon un
  // document fait de répétitions serait déclaré illisible, ce qu'il n'est pas.
  if (raw.replace(/\s+/g, ' ').trim().length < MIN_READABLE_CHARS) {
    throw new UnusableDocumentError(
      "Ce fichier est vide ou illisible. Exportez votre business plan en texte, Markdown ou JSON, puis réessayez.",
    );
  }

  const cleaned = normalizeDocument(raw);
  // Si le nettoyage a presque tout emporté, le document n'était qu'en-têtes et
  // répétitions : on le juge alors sur son texte d'origine.
  const normalized =
    cleaned.replace(/\s+/g, ' ').trim().length >= MIN_READABLE_CHARS ? cleaned : raw;

  const { families, signals } = scoreDocument(normalized);
  if (families.length < MIN_FAMILIES || signals < MIN_SIGNALS) {
    throw new UnusableDocumentError(
      `« ${documentName} » ne ressemble pas à un business plan : on n'y trouve ni offre, ni marché, ni éléments financiers. Importez le document qui décrit votre projet d'entreprise.`,
    );
  }

  const text = condenseDocument(normalized);

  return {
    text,
    originalChars: normalized.length,
    briefChars: text.length,
    digest: crypto.createHash('sha256').update(normalized).digest('hex'),
    families,
  };
}

// ---------------------------------------------------------------------------

/** Découpe au paragraphe, en regroupant jusqu'à la taille visée. */
function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > CHUNK_TARGET_CHARS) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + paragraph;
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

/**
 * Densité d'information d'un passage : signaux métier, chiffres, et titres
 * annonçant une section utile. Les longs passages sans chiffre ni signal
 * — l'histoire du fondateur, les remerciements — tombent d'eux-mêmes.
 */
function chunkScore(chunk: string): number {
  const { signals, families } = scoreDocument(chunk);
  const numbers = (chunk.match(/\d[\d\s.,]*/g) ?? []).length;
  const heading = HIGH_VALUE_HEADINGS.test(chunk.slice(0, 120)) ? 6 : 0;
  // Rapporté à la longueur : un passage dense vaut mieux qu'un passage long.
  return (signals * 2 + families.length * 3 + numbers + heading) / Math.sqrt(chunk.length);
}
