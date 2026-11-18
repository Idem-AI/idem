/**
 * LE CONTRÔLE DES CITATIONS PAR LE CODE (diagnostic RS1/RS2, 18/11/2026) — 0 jeton, 0 ms.
 *
 * La règle est lexicale : une phrase qui avance une donnée chiffrée (montant, part, taux, taille de marché, effectif)
 * doit porter un marqueur `[sN]` dont l'identifiant existe dans les sources de la section. Un modèle n'apportait rien
 * à cette vérification ; la « révision » qui suivait réécrivait toute la section en HTML alors qu'elle est un objet
 * JSON (contrat du catalogue), perdant tableaux et séries de graphiques.
 *
 * Désormais :
 *   - `checkCitations` compte les phrases chiffrées citées et non citées ;
 *   - `stripUncited` RETIRE des textes rédigés (prose) les phrases chiffrées sans citation valide, sans toucher aux
 *     blocs de données (valeurs courtes des `metrics`, cellules de tableau, séries) qui viennent du plan financier.
 */

export interface CitationIssue {
  claim: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CitationVerdict {
  passed: boolean;
  citedClaims: number;
  uncitedClaims: number;
  issues: CitationIssue[];
}

const MARKER = /\[s(\d+)\]/gi;
/** Une donnée chiffrée : nombre suivi d'une unité, d'un pourcentage ou d'une devise, ou grand nombre. */
const QUANTIFIED = /\d[\d\s.,  ]*\s?(%|‰|pts?\b|points?\b|k\b|K\b|M\b|Md\b|Mds\b|bn\b|millions?\b|milliards?\b|billions?\b|thousands?\b|milliers?\b|FCFA|F\s?CFA|XAF|XOF|€|\$|USD|EUR|GBP|NGN|KES|GHS|MAD|ZAR|habitants|inhabitants|users|utilisateurs|clients|customers)|\b\d{1,3}(?:[\s  .,]\d{3})+\b|\b\d+[.,]\d+\b|\b\d{3,}\b/;
/** Ce qui n'est pas une donnée à sourcer : années, marqueurs, numéros de page ou d'étape. */
const NOT_DATA = [/\[s\d+\]/gi, /\b(19|20)\d{2}\b(?:\s?[-–]\s?(19|20)?\d{2,4})?/g, /\b(?:p\.|page|étape|step|phase|année|year|an|Q|T)\s?\d+\b/gi];

/** Une phrase avance-t-elle une donnée chiffrée à sourcer ? */
export function isQuantified(sentence: string): boolean {
  let s = sentence;
  for (const re of NOT_DATA) s = s.replace(re, ' ');
  return QUANTIFIED.test(s);
}

/** Les marqueurs `[sN]` d'une phrase qui pointent vers une source existante. */
function validMarkers(sentence: string, allowed: Set<string>): number {
  let n = 0;
  for (const m of sentence.matchAll(MARKER)) if (allowed.has(`s${m[1]}`)) n += 1;
  return n;
}

const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Le verdict sur le TEXTE VISIBLE d'une section (valeurs de chaînes du contenu structuré). */
export function checkCitations(visibleText: string, sourceIds: string[]): CitationVerdict {
  const allowed = new Set(sourceIds.map((id) => id.toLowerCase()));
  let cited = 0;
  const issues: CitationIssue[] = [];
  for (const sentence of sentencesOf(visibleText)) {
    if (!isQuantified(sentence)) continue;
    if (validMarkers(sentence, allowed)) cited += 1;
    else if (issues.length < 20) issues.push({ claim: sentence.slice(0, 400), reason: [...sentence.matchAll(MARKER)].length ? 'marqueur [sN] inconnu' : 'donnée chiffrée sans citation', severity: 'critical' });
  }
  const uncited = issues.length;
  return { passed: uncited === 0, citedClaims: cited, uncitedClaims: uncited, issues };
}

/** Une chaîne rédigée (prose), par opposition à une valeur de bloc de données (« 2,3 Md », « 18 % »). */
const isProse = (s: string): boolean => s.length >= 60 && /\s/.test(s) && /[a-zA-ZÀ-ÿ]{4,}/.test(s);

/**
 * Retire de la section (JSON) les phrases chiffrées de la PROSE sans citation valide. Les valeurs courtes des blocs de
 * données (le plan financier, les tableaux) ne sont jamais touchées. Une chaîne qui perd toutes ses phrases garde une
 * mention neutre plutôt que de laisser un trou dans la page. Contenu non JSON : rendu tel quel.
 */
export function stripUncited(content: string, sourceIds: string[], language = 'fr'): { content: string; removed: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { content, removed: [] };
  }
  const allowed = new Set(sourceIds.map((id) => id.toLowerCase()));
  const removed: string[] = [];
  const placeholder = language.startsWith('en') ? 'Figure to be sourced.' : 'Donnée à sourcer.';
  const clean = (s: string): string => {
    if (!isProse(s)) return s;
    const kept: string[] = [];
    for (const sentence of s.split(/(?<=[.!?…])\s+/)) {
      if (isQuantified(sentence) && !validMarkers(sentence, allowed)) removed.push(sentence.trim().slice(0, 400));
      else kept.push(sentence);
    }
    if (kept.length === s.split(/(?<=[.!?…])\s+/).length) return s;
    return kept.join(' ').trim() || placeholder;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return clean(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(parsed);
  return { content: removed.length ? JSON.stringify(out) : content, removed };
}
