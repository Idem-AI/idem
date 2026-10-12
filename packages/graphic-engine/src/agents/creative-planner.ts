/**
 * Le PLANIFICATEUR CRÉATIF : les décisions graphiques confiées à un modèle, selon le cran.
 *
 *  · High  — CHOISIR une composition dans un menu de candidats distincts (réponse : un numéro) ;
 *  · Max   — la choisir ET régler ses paramètres, sa tension et son accent, en un seul appel ;
 *  · Ultra — CONCEVOIR l'arbre de la page à partir des primitives autorisées (aucun gabarit à suivre :
 *            on lui dit seulement ce que les autres pages font déjà, pour qu'il fasse autre chose).
 *
 * Le modèle ne reçoit jamais le texte complet ni la documentation des composants : un résumé du contenu
 * (types de blocs, volumes) et un MENU court. Il ne peut pas écrire de mots (les textes sont des
 * références) ni de couleurs (des jetons) : un arbre qui en écrirait est corrigé ou refusé.
 */
import type { Params, ParamValue } from '../contracts/common';
import type { SectionContent } from '../contracts/content-model';
import type { Accent, DecorItem, NodeT, Tension } from '../contracts/design-spec';
import { textRefResolves, validateNode, walk } from '../contracts/validate';
import type { ContentAnalysis } from '../composition-engine/analyze';
import type { Candidate } from '../composition-engine/compose';
import type { DocumentPlan } from '../composition-engine/plan';
import { componentsFor } from '../design-system/components/registry';
import type { FormatDef } from '../design-system/formats';
import { parseJsonObject } from '../orchestrator/run-task';

/** Le contenu résumé pour un agent : types, volumes, jamais le texte. */
export function describeSection(section: SectionContent, a: ContentAnalysis): string {
  const blocks = section.blocks.map((b) => {
    const size =
      b.kind === 'prose'
        ? `${b.paragraphs.length} §, ${b.paragraphs.join(' ').length} chars`
        : b.kind === 'metrics'
          ? `${b.items.length} figures`
          : b.kind === 'chart'
            ? `${b.chartType}, ${b.labels.length} labels, ${b.series.length} series`
            : b.kind === 'table'
              ? `${b.headers.length} cols × ${b.rows.length} rows`
              : b.kind === 'cards'
                ? `${b.items.length} cards`
                : '';
    return `${b.id}:${b.kind}${size ? `(${size})` : ''}`;
  });
  return `"${section.title.slice(0, 90)}" — ${blocks.join(', ') || 'no blocks'}; weight ${a.weight.toFixed(2)} A4 page${a.hasLede ? '; has a lede' : ''}`;
}

const paramText = (p: Params): string =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

export function menuLines(menu: Candidate[]): string[] {
  return menu.map((c, i) => `${i + 1}. ${c.pattern.id} — ${c.pattern.summary}${Object.keys(c.params).length ? ` (${paramText(c.params)})` : ''}`);
}

function header(plan: DocumentPlan, brand: string, format: FormatDef): string {
  return `You are the art director of a ${plan.documentType.replace('-', ' ')} for the brand "${brand}". Visual style: ${plan.styleId}. Canvas: ${format.id} (${format.kind === 'flow' ? 'paginated document page' : `fixed ${Math.round(format.width)}×${Math.round(format.height)} px`}).`;
}

export function pickPrompt(plan: DocumentPlan, brand: string, format: FormatDef, summary: string, menu: Candidate[], previous: string[]): { system: string; user: string } | null {
  if (menu.length < 2) return null;
  return {
    system: `${header(plan, brand, format)} Choose ONE composition for this page from the menu: the one that best serves the content (clear hierarchy, readable, nothing cramped) and differs from the previous pages. Answer with JSON only: {"choice": <number>, "why": "<at most 10 words>"}.`,
    user: `PAGE: ${summary}\nPREVIOUS PAGES: ${previous.slice(-4).join(', ') || 'none'}\nMENU:\n${menuLines(menu).join('\n')}`,
  };
}

export function parsePick(raw: string, size: number): number | undefined {
  const o = parseJsonObject(raw);
  const choice = Number(o?.choice);
  return Number.isInteger(choice) && choice >= 1 && choice <= size ? choice - 1 : undefined;
}

export interface Tuned {
  index: number;
  params: Params;
  tension?: Tension;
  accent?: Accent;
}

export function pickTunePrompt(plan: DocumentPlan, brand: string, format: FormatDef, summary: string, menu: Candidate[], previous: string[]): { system: string; user: string } | null {
  if (!menu.length) return null;
  const spaces = menu.map((c, i) => `${i + 1}. ${c.pattern.id} — ${c.pattern.summary}\n   params: ${Object.entries(c.pattern.params).map(([k, vs]) => `${k}∈{${vs.join('|')}}`).join('; ') || 'none'}`);
  return {
    system: `${header(plan, brand, format)} Choose ONE composition from the menu AND set its parameters (only the listed values), plus the page tension and accent from the allowed lists. Serve the content first, then make this page differ from the previous ones. Answer with JSON only: {"choice": <number>, "params": {<name>: <value>}, "tension": "<value>", "accent": "<value>"}.`,
    user: `PAGE: ${summary}\nPREVIOUS PAGES: ${previous.slice(-4).join(', ') || 'none'}\nTENSIONS ALLOWED: ${['calm', ...plan.tensions].join(', ')}\nACCENTS ALLOWED: ${['none', ...plan.accents].join(', ')}\nMENU:\n${spaces.join('\n')}`,
  };
}

export function parsePickTune(raw: string, menu: Candidate[], plan: DocumentPlan): Tuned | undefined {
  const o = parseJsonObject(raw);
  const choice = Number(o?.choice);
  if (!Number.isInteger(choice) || choice < 1 || choice > menu.length) return undefined;
  const pattern = menu[choice - 1].pattern;
  const params: Params = { ...menu[choice - 1].params };
  const asked = (o?.params && typeof o.params === 'object' ? o.params : {}) as Record<string, unknown>;
  for (const [key, values] of Object.entries(pattern.params)) {
    const wanted = asked[key];
    const match = values.find((v: ParamValue) => String(v) === String(wanted));
    if (match !== undefined) params[key] = match;
  }
  const tension = ['calm', ...plan.tensions].includes(String(o?.tension)) ? (String(o?.tension) as Tension) : undefined;
  const accent = ['none', ...plan.accents].includes(String(o?.accent)) ? (String(o?.accent) as Accent) : undefined;
  return { index: choice - 1, params, tension, accent };
}

// ── Ultra : concevoir l'arbre ───────────────────────────────────────────────────────────────

const GRAMMAR = `NODES (JSON objects, "t" is the type):
- stack {children[], gap?, align?: start|center|end|stretch, justify?: start|center|end|between, grow?, pad?, surface?, border?, radius?, bleed?: ["t","r","b","l"]}
- row {children[], gap?, align?, justify?, wrap?} — side by side
- grid {cols: <n> or [fr, fr…], children[], gap?, spans?: [n…], align?}
- box {children[], surface?, pad?, radius?, border?: {weight: hair|thin|thick, sides?: ["t","r","b","l"], ink?}}
- text {role: kicker|title|display|lede|body|caption|label|number, ref: "title"|"kicker"|"lede"|"<blockId>.<field>", size?: xs…6xl, align?, ink?, emphasis?: underline|outline, rotate?: up}
- block {ref: "<blockId>", variant?: {…}} — draws a content block with its component
- rule {weight?: hair|thin|thick, ink?, length?: full|short|xshort, vertical?}
- spacer {size?: xs…3xl} or {flex: true}
- logo {height?: sm|md|lg|xl}
- shape {shape: rings|quarter-circles|half-discs|stripes|grid-lines|dots-field|chevrons|arcs|blob|waves|steps|triangles|cross-marks|checker|contours|burst|slant, tone?: brand|accent|soft|ink, size?: fill|sm|md|lg, opacity?: 0..1}
TOKENS: space none|2xs|xs|sm|md|lg|xl|2xl|3xl · surface ground|raised|sunken|brand|brand-soft|accent|accent-soft|ink · ink ink|muted|faint|heading|kicker|emphasis|brand|accent`;

export function authorPrompt(plan: DocumentPlan, brand: string, format: FormatDef, section: SectionContent, a: ContentAnalysis, previous: string[]): { system: string; user: string } {
  const blocks = a.blocks.map((b) => {
    const variants = componentsFor(b.kind)[0]?.variants ?? {};
    const v = Object.entries(variants)
      .map(([k, vs]) => `${k}∈{${vs.join('|')}}`)
      .join('; ');
    return `- ${b.id}: ${b.kind}, weight ${b.weight.toFixed(2)}${b.wide ? ', needs full width' : ''}${v ? ` — variants ${v}` : ''}`;
  });
  return {
    system: `${header(plan, brand, format)} DESIGN this page yourself: invent a composition (not a common template) that gives the content a clear hierarchy and a strong, professional silhouette.\n${GRAMMAR}\nRULES: place EVERY block exactly once with a "block" node; never write words (texts are refs only); no colours or CSS (tokens only); at most 9 levels and 60 nodes; ${format.kind === 'flow' ? 'the root MUST be a stack whose children are rows (the page is paginated)' : 'the root fills the page; mark the region that should absorb space with "grow": true'}. Decorations (optional) go in "decor": [{"at": {"x","y","w","h"} in % of the page, "node": shape|box}] and never sit under text with opacity above 0.15.\nAnswer with JSON only: {"root": <node>, "decor": [ … ]}.`,
    user: `CONTENT: ${describeSection(section, a)}\nTEXT REFS: title${section.kicker ? ', kicker' : ''}${section.lede ? ', lede' : ''}\nBLOCKS:\n${blocks.join('\n')}\nOTHER PAGES ALREADY USE: ${previous.slice(-5).join(' | ') || 'nothing yet'} — make this one different.`,
  };
}

/**
 * Lit, valide et RÉPARE un arbre d'auteur : un texte libre est retiré, une référence inconnue aussi, un bloc
 * posé deux fois l'est une seule fois, un bloc oublié est ajouté en fin de page. Refusé seulement s'il ne
 * reste rien d'exploitable (le défaut de forme coûte une correction, pas la page).
 */
export function parseAuthored(raw: string, section: SectionContent, format: FormatDef): { root: NodeT; decor: DecorItem[]; repaired: string[] } | undefined {
  const o = parseJsonObject(raw);
  if (!o || !o.root || typeof o.root !== 'object') return undefined;
  const repaired: string[] = [];
  const ids = new Set(section.blocks.map((b) => b.id));
  const seen = new Set<string>();
  const clean = (node: unknown): NodeT | null => {
    if (!node || typeof node !== 'object') return null;
    const nd = { ...(node as Record<string, unknown>) };
    if (nd.t === 'text') {
      if ('text' in nd) {
        delete nd.text;
        repaired.push('texte libre retiré');
      }
      if (typeof nd.ref !== 'string' || !textRefResolves(nd.ref, section)) return null;
      delete nd.bind;
    }
    if (nd.t === 'block') {
      if (typeof nd.ref !== 'string' || !ids.has(nd.ref) || seen.has(nd.ref)) {
        repaired.push(`bloc ${String(nd.ref)} écarté (inconnu ou en double)`);
        return null;
      }
      seen.add(nd.ref);
      delete nd.component;
    }
    if (Array.isArray(nd.children)) nd.children = (nd.children as unknown[]).map(clean).filter(Boolean);
    if (nd.t === 'layer') return null;
    return nd as NodeT;
  };
  let root = clean(o.root);
  if (!root) return undefined;
  if (format.kind === 'flow' && root.t !== 'stack') root = { t: 'stack', gap: 'lg', children: [root] };
  if (!('children' in root)) root = { t: 'stack', gap: 'md', grow: true, children: [root] };
  const missing = section.blocks.filter((b) => !seen.has(b.id));
  if (missing.length && 'children' in root) {
    root.children.push(...missing.map((b) => ({ t: 'block' as const, ref: b.id })));
    repaired.push(`${missing.length} bloc(s) oublié(s) ajouté(s) en fin de page`);
  }
  const checked = validateNode(root);
  if (!checked.ok || !checked.value) return undefined;
  const decor: DecorItem[] = Array.isArray(o.decor)
    ? (o.decor as unknown[])
        .map((d) => {
          const item = d as { at?: DecorItem['at']; node?: unknown };
          const node = clean(item?.node);
          if (!item?.at || !node || (node.t !== 'shape' && node.t !== 'box')) return null;
          if (node.t === 'shape' && (node.opacity ?? 1) > 0.15) node.opacity = 0.15;
          return { at: item.at, node } as DecorItem;
        })
        .filter((x): x is DecorItem => Boolean(x))
        .slice(0, 4)
    : [];
  let nodes = 0;
  walk(checked.value, () => (nodes += 1));
  if (nodes > 80) return undefined;
  return { root: checked.value, decor, repaired };
}
