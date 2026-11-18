/**
 * LE RÉDACTEUR — un seul appel JSON par page : les textes de chaque section, champ par champ, dans le schéma de sa
 * composition (`kind`). Le modèle n'écrit plus de code : ~10 fois moins de jetons qu'un composant TSX par section,
 * et un contenu que le code vérifie entièrement (types, longueurs, nombre d'éléments, faits) avant de l'assembler.
 */
import type { FactCheck } from '../factGuard.js';
import { stripSentences } from '../factGuard.js';
import type { ManifestPage, ManifestSection, SiteManifest } from '../manifest.js';
import { layoutBrief } from '../manifest.js';
import type { ModelCaller, Verdict } from '../modelCaller.js';
import { SHAPE_REMINDER } from '../modelCaller.js';
import { ChatLogger } from '../../utils/logger.js';
import type { FieldDef, KindNode } from './types.js';

export type SectionContent = Record<string, unknown>;

export interface CopyTask {
  section: ManifestSection;
  kind: KindNode;
  /** Le nombre de visuels prêts (une galerie ne légende que ce qu'elle montre). */
  visuals: number;
  /** Refonte : le contenu de l'ancien site que la section reprend intégralement. */
  source?: string;
}

export interface CopyInput {
  caller: ModelCaller;
  label: string;
  language: string;
  manifest: SiteManifest;
  page: ManifestPage;
  tasks: CopyTask[];
  /** Les faits du projet, en clair, et la demande. */
  factsText: string;
  request: string;
  check: FactCheck;
  /** Les destinations permises des actions. */
  targets: string[];
}

/** Le schéma d'une composition, lisible par le modèle. */
export function describeFields(fields: Record<string, FieldDef>, indent = '  '): string {
  return Object.entries(fields)
    .map(([name, def]) => {
      if (def.type === 'text') return `${indent}"${name}": texte, ${def.max} signes au plus${def.required ? ', OBLIGATOIRE' : ''}`;
      if (def.type === 'action') return `${indent}"${name}": { "label": verbe + objet, 40 signes au plus, "target": une destination permise } (facultatif)`;
      const of = def.of === 'text' ? 'des textes' : `des objets {\n${describeFields(def.of, `${indent}    `)}\n${indent}  }`;
      return `${indent}"${name}": liste de ${def.min} à ${def.max} ${of}`;
    })
    .join('\n');
}

export function copySystemPrompt(language: string): string {
  const fr = language === 'fr';
  return `Tu es le rédacteur d'un site vitrine. Tu écris les TEXTES de chaque section d'une page, champ par champ, dans le schéma imposé ; la mise en page, le code et les visuels sont faits par ailleurs. Tu réponds UNIQUEMENT par un objet JSON, sans texte autour ni bloc de code.

# Règles d'écriture
- ${fr ? 'Tout est en français.' : 'Everything is in English.'} Tu écris pour la clientèle de ce projet, avec ses mots : chaque phrase est propre à ce projet, concrète, utile.
- Un titre dit quelque chose de précis (pas « Nos services », « Bienvenue »). Pas d'étiquette au-dessus d'un titre, pas de titre qui répète le précédent, pas d'introduction qui redit le titre.
- Des sections généreuses : chaque champ rempli avec substance, jusqu'à la longueur permise quand le contenu le justifie, jamais de remplissage.
- Interdit : émojis, tiret cadratin, superlatifs creux, mots de marketing vides (révolutionnaire, ultime, incontournable, solution innovante), lorem ipsum, Markdown, balises HTML.
- N'invente AUCUN prix, chiffre, délai, horaire, jour, quartier, nom de client, avis, témoignage, récompense, partenaire, certification ni garantie absents des informations du projet. Pas de « gratuit », « express », « en X minutes » si les faits ne le disent pas.
- Une statistique (« stats ») n'existe que si les faits donnent le chiffre ; sinon, la valeur est un mot court et vrai (une ville, une langue, un savoir-faire), jamais un nombre inventé.
- Une citation (« quote ») ne cite que ce que les faits attribuent à une personne réelle du projet ; sinon, c'est la conviction du projet signée de son nom.
- Les prix, l'équipe et les coordonnées sont affichés par le site lui-même : n'en recopie aucun dans un texte.
- Le site n'a ni compte ni paiement en ligne : une action mène à une page, à une section ou au contact.
- Un champ facultatif sans contenu vrai reste absent (ou liste vide) : c'est mieux qu'une phrase creuse.`;
}

function taskBlock(task: CopyTask, fr: boolean): string {
  const s = task.section;
  return `## Section « ${s.id} »
Ce qu'elle montre et dit : ${s.brief}
Composition : ${s.layout ? layoutBrief(s.layout, fr) : task.kind.doc.summary}${task.kind.doc.use ? ` (${task.kind.doc.use})` : ''}
Visuels prêts : ${task.visuals}${s.layout === 'gallery' && task.visuals ? ` (au plus ${task.visuals} légendes)` : ''}
Champs :
{
${describeFields(task.kind.fields)}
}${task.source ? `\nContenu de l'ancien site à reprendre INTÉGRALEMENT (réorganisé, resserré, réécrit pour la cible ; rien retiré, aucun fait ajouté) :\n${task.source}` : ''}`;
}

export function copyPrompt(input: CopyInput): string {
  const fr = input.language === 'fr';
  const brief = input.request.trim();
  return `# Le projet
${input.factsText}${brief ? `\n\n# La demande de l'utilisateur\n${brief.slice(0, 800)}` : ''}

# Le site
Pages : ${input.manifest.pages.map((p) => `${p.label} (${p.path})`).join(', ')}.

# La page
${input.page.label} (${input.page.path})${input.page.purpose ? ` : ${input.page.purpose}` : ''}

# Destinations permises d'une action (« target »)
${input.targets.map((t) => `- ${t}`).join('\n')}

# Les sections, dans l'ordre (chacune dit autre chose que les autres)
${input.tasks.map((t) => taskBlock(t, fr)).join('\n\n')}

# Réponse
{ "sections": { ${input.tasks.map((t) => `"${t.section.id}": { … }`).join(', ')} } }`;
}

const clean = (value: string): string =>
  value
    .replace(/\s+—\s+/g, ', ')
    .replace(/—/g, ', ')
    .replace(/[*_`#]+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Une prose ramenée sous la limite en retirant ses DERNIÈRES phrases entières — jamais un mot coupé. `null` quand ce
 * n'est pas possible proprement : une seule phrase (un titre), ou ce qui resterait serait trop maigre (moins de la
 * moitié de la place), et le modèle réécrit alors.
 */
export function fitProse(text: string, limit: number): string | null {
  const sentences = text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý«"“0-9])/u);
  if (sentences.length < 2) return null;
  while (sentences.length > 1 && sentences.join(' ').length > limit) sentences.pop();
  const kept = sentences.join(' ').trim();
  return kept.length <= limit && kept.length >= limit * 0.5 && /[.!?…»"”]$/u.test(kept) ? kept : null;
}

/** Un champ selon son schéma : la valeur retenue, et ce qui ne va pas. */
function readField(def: FieldDef, raw: unknown, where: string, problems: string[], targets: Set<string>): unknown {
  if (def.type === 'text') {
    const text = typeof raw === 'string' || typeof raw === 'number' ? clean(String(raw)) : '';
    if (!text) {
      if (def.required) problems.push(`${where} : obligatoire`);
      return undefined;
    }
    // Une marge de 15 % : au-delà, le texte casserait la composition.
    const limit = Math.round(def.max * 1.15);
    if (text.length <= limit) return text;
    // Une prose trop longue (chapeau, paragraphe) perd ses dernières phrases, par le code : c'était la cause de
    // presque tous les renvois au modèle (300 signes pour 240), quinze secondes et un appel payé chacun.
    const fitted = fitProse(text, limit);
    if (fitted) return fitted;
    problems.push(`${where} : ${text.length} signes pour ${def.max} au plus`);
    return text;
  }
  if (def.type === 'action') {
    if (raw == null || raw === '') return undefined;
    const action = raw as { label?: unknown; target?: unknown };
    const label = typeof action.label === 'string' ? clean(action.label) : '';
    const target = typeof action.target === 'string' ? action.target.trim() : '';
    if (!label) return undefined;
    if (label.length > 46) problems.push(`${where}.label : ${label.length} signes pour 40 au plus`);
    return { label, ...(targets.has(target) ? { target } : {}) };
  }
  const list = Array.isArray(raw) ? raw : raw == null ? [] : null;
  if (!list) {
    problems.push(`${where} : une liste est attendue`);
    return [];
  }
  const items = list.map((item, i) => (def.of === 'text' ? readField({ type: 'text', max: 240, required: true }, item, `${where}[${i}]`, problems, targets) : readObject(def.of, item, `${where}[${i}]`, problems, targets))).filter((item) => item !== undefined);
  if (items.length < def.min) problems.push(`${where} : ${items.length} élément(s) pour ${def.min} au moins`);
  return items.slice(0, def.max);
}

function readObject(fields: Record<string, FieldDef>, raw: unknown, where: string, problems: string[], targets: Set<string>): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push(`${where} : un objet est attendu`);
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(fields)) {
    const value = readField(def, (raw as Record<string, unknown>)[name], `${where}.${name}`, problems, targets);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

export interface CopyResult {
  /** Le contenu de chaque section lisible ; une section absente repart vers l'auteur de code. */
  sections: Record<string, SectionContent>;
  /** Les phrases non vérifiées retirées par le code au dernier recours. */
  removed: string[];
  providerDown: boolean;
}

/** Lit et vérifie la réponse : forme, puis faits. Une section illisible est seulement écartée. */
export function readCopy(raw: unknown, tasks: CopyTask[], targets: string[]): { sections: Record<string, SectionContent>; problems: Record<string, string[]> } {
  const allowed = new Set(targets);
  const root = (raw as { sections?: unknown } | null)?.sections ?? raw;
  const sections: Record<string, SectionContent> = {};
  const problems: Record<string, string[]> = {};
  for (const task of tasks) {
    const value = (root as Record<string, unknown> | null)?.[task.section.id];
    const found: string[] = [];
    const content = readObject(task.kind.fields, value, task.section.id, found, allowed);
    if (found.length || !content) problems[task.section.id] = found.length ? found : [`${task.section.id} : absente`];
    if (content) sections[task.section.id] = content;
  }
  return { sections, problems };
}

/**
 * Les textes d'une page, au fil de l'eau : chaque section part vers l'assemblage DÈS QU'ELLE EST JUSTE, sans attendre
 * les autres.
 *
 * 1. Un appel pour toute la page. Seule une réponse illisible (aucune section) est redemandée telle quelle.
 * 2. Ce que le code sait corriger, il le corrige : une phrase non vérifiée est retirée, une prose trop longue perd ses
 *    dernières phrases (`fitProse`). Une section juste est livrée tout de suite.
 * 3. Les sections encore fautives — et elles seules — repartent en UN appel, avec leur version précédente et la liste
 *    de ce qui ne va pas. Avant : la page entière était réécrite jusqu'à trois fois pour un chiffre de 18 signes au
 *    lieu de 14 (60 s mesurées le 12/11/2026 sur l'accueil), et aucune section de la page ne s'affichait entre-temps.
 * 4. Dernier recours : un texte un peu trop long (≤ 1,6 × la limite) est gardé, la mise en page web le fait passer à
 *    la ligne ; au-delà, ou pour une forme fausse, la section repart vers l'auteur de code.
 */
export interface PageCopy {
  /** Le contenu d'une section dès qu'il est prêt ; `undefined` si elle n'a pas pu être rédigée. */
  section(id: string): Promise<SectionContent | undefined>;
  /** Toute la page, une fois chaque section livrée ou abandonnée. */
  done: Promise<CopyResult>;
}

/** Au dernier recours, le dépassement de longueur toléré (le texte passe à la ligne, il ne casse pas une page web). */
const LAST_RESORT_OVERFLOW = 1.6;

/** Une réponse dont aucune section n'est lisible : la seule redemandée telle quelle. */
const SHAPE_PROBLEM = SHAPE_REMINDER;

/** Un dépassement de longueur seulement (« 18 signes pour 14 au plus »), et dans la tolérance du dernier recours. */
function onlyMildOverflow(problems: string[]): boolean {
  return problems.every((line) => {
    const m = line.match(/: (\d+) signes pour (\d+) au plus$/);
    return !!m && Number(m[1]) <= Number(m[2]) * LAST_RESORT_OVERFLOW;
  });
}

export function startPageCopy(input: CopyInput): PageCopy {
  const { tasks, targets, check } = input;
  const waiting = new Map<string, (value: SectionContent | undefined) => void>();
  const ready = new Map<string, Promise<SectionContent | undefined>>();
  for (const task of tasks) ready.set(task.section.id, new Promise((resolve) => waiting.set(task.section.id, resolve)));

  const sections: Record<string, SectionContent> = {};
  const removed: string[] = [];
  const deliver = (id: string, content: SectionContent | undefined) => {
    if (content) sections[id] = content;
    waiting.get(id)?.(content);
    waiting.delete(id);
  };

  /** Une réponse lisible est toujours acceptée : le tri section par section se fait ici, pas par un renvoi au modèle. */
  const lenient = (subset: CopyTask[]) => (raw: unknown): Verdict<{ sections: Record<string, SectionContent>; problems: Record<string, string[]> }> => {
    const read = readCopy(raw, subset, targets);
    if (!Object.keys(read.sections).length) return { problem: SHAPE_PROBLEM };
    return { value: read };
  };

  /** Une section lue : livrée si elle est juste (au besoin après retrait des phrases non vérifiées), sinon ce qui ne va pas. */
  const settle = (task: CopyTask, content: SectionContent | undefined, problems: string[] | undefined): string[] => {
    const id = task.section.id;
    if (!content) return problems ?? [`${id} : absente`];
    if (problems?.length) return problems;
    const invented = check(content);
    if (!invented.length) {
      deliver(id, content);
      return [];
    }
    const again = readCopy({ [id]: stripSentences(content, invented) }, [task], targets);
    if (!again.problems[id] && again.sections[id] && !check(again.sections[id]).length) {
      removed.push(...invented);
      deliver(id, again.sections[id]);
      return [];
    }
    return [`${id} : retire ${invented.map((i) => `« ${i} »`).join(', ')} (absent des informations du projet), sans le remplacer par une autre affirmation`];
  };

  const done = (async (): Promise<CopyResult> => {
    let providerDown = false;
    try {
      if (!tasks.length) return { sections: {}, removed, providerDown };
      const maxTokens = Math.min(7000, 700 + tasks.length * 650);
      const first = await input.caller.json(input.label, copySystemPrompt(input.language), copyPrompt(input), lenient(tasks), maxTokens);
      providerDown = first.providerDown;
      const drafts = first.value?.sections ?? {};
      const faults = new Map<CopyTask, string[]>();
      for (const task of tasks) {
        const lines = settle(task, drafts[task.section.id], first.value?.problems[task.section.id]);
        if (lines.length) faults.set(task, lines);
      }
      if (!faults.size || !first.value) return { sections, removed, providerDown };

      // Les seules sections fautives, en un appel, avec ce qu'elles disaient et ce qu'il faut corriger.
      const subset = [...faults.keys()];
      const previous = subset
        .filter((task) => drafts[task.section.id])
        .map((task) => `« ${task.section.id} » : ${JSON.stringify(drafts[task.section.id])}`)
        .join('\n');
      const corrections = [...faults.values()].flat().map((line) => `- ${line}`).join('\n');
      const prompt = `${copyPrompt({ ...input, tasks: subset })}\n\n# Ta première version de ces sections${previous ? `\n${previous}` : ' : absente'}\n\n# À corriger, et seulement ces points\n${corrections}\nRenvoie l'objet JSON de ces sections seulement, complet.`;
      const second = await input.caller.json(`${input.label} (reprise)`, copySystemPrompt(input.language), prompt, lenient(subset), Math.min(5000, 600 + subset.length * 650));
      for (const task of subset) {
        const id = task.section.id;
        const content = second.value?.sections[id] ?? drafts[id];
        const problems = second.value?.sections[id] ? second.value.problems[id] : first.value.problems[id];
        const left = settle(task, content, problems);
        if (!left.length) continue;
        // Dernier recours : un texte un peu long, sans invention, est gardé tel quel.
        if (content && problems?.length && onlyMildOverflow(problems) && !check(content).length) {
          ChatLogger.info('SITE_CATALOG', `${input.label} : « ${id} » gardée un peu longue`, { problems });
          deliver(id, content);
        }
      }
      return { sections, removed, providerDown: providerDown && second.providerDown };
    } finally {
      // Une section jamais livrée repart vers l'auteur de code — jamais une attente sans fin.
      for (const id of [...waiting.keys()]) deliver(id, undefined);
    }
  })();

  return { section: (id) => ready.get(id) ?? Promise.resolve(undefined), done };
}

/** Les textes d'une page, en entier (la page n'est rendue qu'une fois chaque section livrée ou abandonnée). */
export function writePageCopy(input: CopyInput): Promise<CopyResult> {
  return startPageCopy(input).done;
}
