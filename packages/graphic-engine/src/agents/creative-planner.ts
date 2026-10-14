/**
 * Le PLANIFICATEUR CRÉATIF : les décisions graphiques confiées à un modèle, selon le cran.
 *
 *  · High  — CHOISIR une composition dans un menu de candidats distincts (réponse : un numéro) ;
 *  · Max   — la choisir ET régler ses paramètres, sa tension et son accent, en un seul appel ;
 *  · High+ — CONCEVOIR l'arbre de la page à partir des primitives autorisées (aucun gabarit à suivre : les
 *            compositions éprouvées ne sont que des références ; Max et Ultra révisent l'arbre sur la critique).
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

function header(plan: DocumentPlan, brand: string, format: FormatDef, grammar?: string): string {
  return `You are the art director of a ${plan.documentType.replace('-', ' ')} for the brand "${brand}". Visual style: ${plan.styleId}. Canvas: ${format.id} (${format.kind === 'flow' ? 'paginated document page' : `fixed ${Math.round(format.width)}×${Math.round(format.height)} px`}).${grammar ? `\nTHE BRAND'S COMPOSITION GRAMMAR (from its charter — follow it, it is what makes this brand recognisable):\n${grammar}` : ''}`;
}

export function pickPrompt(plan: DocumentPlan, brand: string, format: FormatDef, summary: string, menu: Candidate[], previous: string[], grammar?: string): { system: string; user: string } | null {
  if (menu.length < 2) return null;
  return {
    system: `${header(plan, brand, format, grammar)} Choose ONE composition for this page from the menu: the one that best serves the content (clear hierarchy, readable, nothing cramped) and differs from the previous pages. Answer with JSON only: {"choice": <number>, "why": "<at most 10 words>"}.`,
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

export function pickTunePrompt(plan: DocumentPlan, brand: string, format: FormatDef, summary: string, menu: Candidate[], previous: string[], grammar?: string): { system: string; user: string } | null {
  if (!menu.length) return null;
  const spaces = menu.map((c, i) => `${i + 1}. ${c.pattern.id} — ${c.pattern.summary}\n   params: ${Object.entries(c.pattern.params).map(([k, vs]) => `${k}∈{${vs.join('|')}}`).join('; ') || 'none'}`);
  return {
    system: `${header(plan, brand, format, grammar)} Choose ONE composition from the menu AND set its parameters (only the listed values), plus the page tension and accent from the allowed lists. Serve the content first, then make this page differ from the previous ones. Answer with JSON only: {"choice": <number>, "params": {<name>: <value>}, "tension": "<value>", "accent": "<value>"}.`,
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
- layer {items: [{"at": {"x","y","w","h"} in % of the layer, "z"?: 0..20, "node": <node>}]} — free overlap: a photo with a panel over it, an annotation over a capture
- text {role: kicker|title|display|lede|body|caption|label|number|figure|subtitle|small, ref: "title"|"kicker"|"lede"|"<blockId>.<field>", size?: xs…6xl, align?, ink?, emphasis?: underline|outline, rotate?: up}
  a block of short fields (copy, points, metrics, cover, quote) may be placed FIELD BY FIELD anywhere on the page: "<blockId>.headline", ".subhead", ".offer", ".facts.0.text", ".items.0.label"… (the fields of each block are listed below)
- block {ref: "<blockId>", variant?: {…}} — draws a content block with its component
- image {ref: "<figureBlockId>", fit?: cover|contain, overlay?: none|scrim-bottom|scrim-top|scrim-full|tint-brand, radius?, grow?} — places that photo/capture
- icon {name: "<icon of a point>", size?: sm|md|lg, ink?}
- rule {weight?: hair|thin|thick, ink?, length?: full|short|xshort, vertical?}
- spacer {size?: xs…3xl} or {flex: true}
- logo {height?: sm|md|lg|xl}
- pattern {index?: 0 main|1 secondary|2 fine texture|3 inverted, opacity?: 0..1} — THE BRAND'S OWN MOTIFS from its charter (use them for any texture, never invent one)
- shape {shape: rings|quarter-circles|half-discs|stripes|grid-lines|dots-field|chevrons|arcs|blob|waves|steps|triangles|cross-marks|checker|contours|burst|slant, tone?: brand|accent|soft|ink, size?: fill|sm|md|lg, opacity?: 0..1}
TOKENS: space none|2xs|xs|sm|md|lg|xl|2xl|3xl · surface ground|raised|sunken|brand|brand-soft|accent|accent-soft|ink · ink ink|muted|faint|heading|kicker|emphasis|brand|accent`;

/** L'intention de la page et les compositions éprouvées, montrées comme RÉFÉRENCES (jamais comme menu imposé). */
function intentLines(section: SectionContent, references: Candidate[]): string {
  const intent = section.intent;
  const lines: string[] = [];
  if (intent) lines.push(`INTENT: show it as "${intent.visualStrategy}"${intent.keyMessage ? ` — the audience must remember: ${intent.keyMessage.slice(0, 160)}` : ''}${intent.textBudget ? ` (text budget ${intent.textBudget.bodyWords} words: keep the words large and few)` : ''}`);
  if (references.length) lines.push(`PROVEN COMPOSITIONS (optional inspiration, NOT a menu — do better or different):\n${references.slice(0, 4).map((c) => `- ${c.pattern.summary}`).join('\n')}`);
  return lines.join('\n');
}

/** Une composition MODÈLE fournie par l'utilisateur (image de référence analysée) : à reproduire avec la marque. */
export interface ReferenceComposition {
  description: string;
  /** Les zones du modèle, en % de la toile (photo, titre, prix, logo, bandeau…). */
  zones?: Array<{ role: string; x: number; y: number; w: number; h: number }>;
}

function referenceLines(ref?: ReferenceComposition): string {
  if (!ref) return '';
  const zones = (ref.zones ?? []).map((z) => `${z.role} at x${Math.round(z.x)} y${Math.round(z.y)} w${Math.round(z.w)} h${Math.round(z.h)}`).join('; ');
  return `REFERENCE TO REPRODUCE (the client's model — its composition, NOT its texts or colours): ${ref.description.slice(0, 600)}${zones ? `\nITS ZONES in % of the canvas: ${zones}. Reproduce this layout faithfully — a "layer" root with items at these positions is the surest way.` : ''}`;
}

export function authorPrompt(plan: DocumentPlan, brand: string, format: FormatDef, section: SectionContent, a: ContentAnalysis, previous: string[], references: Candidate[] = [], reference?: ReferenceComposition, grammar?: string): { system: string; user: string } {
  const blocks = a.blocks.map((b) => {
    const variants = componentsFor(b.kind)[0]?.variants ?? {};
    const v = Object.entries(variants)
      .map(([k, vs]) => `${k}∈{${vs.join('|')}}`)
      .join('; ');
    const block = section.blocks.find((x) => x.id === b.id);
    const extra =
      block?.kind === 'points'
        ? ` — ${block.items.length} points${block.items.some((i) => i.icon) ? `, icons: ${block.items.map((i) => i.icon ?? '-').join(', ')}` : ''}${block.items.some((i) => i.value) ? ', with figures' : ''}`
        : block?.kind === 'figure'
          ? ` — a picture: place it with an "image" node (ref "${b.id}"), large`
          : '';
    const fields = block ? fieldPathsOf(block) : [];
    const fieldList = fields.length ? ` — fields: ${fields.map((f) => `${b.id}.${f.path}`).join(', ')}` : '';
    return `- ${b.id}: ${b.kind}, weight ${b.weight.toFixed(2)}${b.wide ? ', needs full width' : ''}${extra}${fieldList}${v ? ` — variants ${v}` : ''}`;
  });
  return {
    system: `${header(plan, brand, format, grammar)} DESIGN this page yourself: invent a composition (not a common template) that makes its message understood at a glance — show rather than write — with a clear hierarchy and a strong, professional silhouette.\n${GRAMMAR}\nRULES: place EVERY block exactly once (a "block" node, an "image" node for a picture, or point by point); never write words (texts are refs only); no colours or CSS (tokens only); at most 9 levels and 60 nodes; ${format.kind === 'flow' ? 'the root MUST be a stack whose children are rows (the page is paginated)' : 'the root fills the page; mark the region that should absorb space with "grow": true'}. Decorations (optional) go in "decor": [{"at": {"x","y","w","h"} in % of the page, "node": shape|box}] and never sit under text with opacity above 0.15.\nAnswer with JSON only: {"root": <node>, "decor": [ … ]}.`,
    user: `CONTENT: ${describeSection(section, a)}\nTEXT REFS: title${section.kicker ? ', kicker' : ''}${section.lede ? ', lede' : ''}\nBLOCKS:\n${blocks.join('\n')}\n${reference ? referenceLines(reference) : intentLines(section, references)}\n${reference ? '' : `OTHER PAGES ALREADY USE: ${previous.slice(-5).join(' | ') || 'nothing yet'} — make this one different.`}`,
  };
}

/**
 * La RÉVISION d'un arbre d'auteur par la critique visuelle (Max, Ultra) : l'auteur reçoit son arbre et les
 * notes du critique — il corrige SA composition ; on ne lui impose jamais un gabarit à la place.
 */
export function authorRevisePrompt(base: { system: string; user: string }, tree: { root: NodeT; decor: DecorItem[] }, scores: Record<string, number>, weakest: string): { system: string; user: string } {
  return {
    system: base.system,
    user: `${base.user}\n\nYOUR PREVIOUS DESIGN:\n${JSON.stringify({ root: tree.root, decor: tree.decor }).slice(0, 6000)}\nA SENIOR DESIGNER RATED THE RENDERED PAGE (1-5): ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(', ')}. Weakest: ${weakest}. Revise YOUR design to fix ${weakest} first, keep what works. Same JSON format.`,
  };
}

/**
 * Les champs d'un bloc qu'un auteur peut poser un à un (texte court), le PRINCIPAL d'abord (sans lui, le bloc
 * se pose entier) et le rôle typographique d'un champ qu'il aurait oublié.
 */
export function fieldPathsOf(block: SectionContent['blocks'][number]): Array<{ path: string; role: Extract<NodeT, { t: 'text' }>['role'] }> {
  type R = Extract<NodeT, { t: 'text' }>['role'];
  const out: Array<{ path: string; role: R }> = [];
  const add = (cond: unknown, path: string, role: R) => {
    if (cond) out.push({ path, role });
  };
  switch (block.kind) {
    case 'copy':
      add(true, 'headline', 'display');
      add(block.kicker, 'kicker', 'kicker');
      add(block.subhead, 'subhead', 'lede');
      add(block.offer, 'offer', 'figure');
      add(block.body, 'body', 'body');
      (block.facts ?? []).forEach((f, i) => {
        add(f.label, `facts.${i}.label`, 'label');
        add(true, `facts.${i}.text`, 'small');
      });
      add(block.quote?.text, 'quote.text', 'quote');
      add(block.quote?.author, 'quote.author', 'caption');
      add(block.footnote, 'footnote', 'note');
      break;
    case 'points':
      block.items.forEach((it, i) => {
        add(true, `items.${i}.label`, 'subtitle');
        add(it.value, `items.${i}.value`, 'figure');
        add(it.detail, `items.${i}.detail`, 'small');
      });
      break;
    case 'metrics':
      block.items.forEach((it, i) => {
        add(true, `items.${i}.value`, 'figure');
        add(true, `items.${i}.label`, 'small');
        add(it.note, `items.${i}.note`, 'caption');
      });
      break;
    case 'cover':
      add(true, 'brandName', 'display');
      add(block.kicker, 'kicker', 'kicker');
      add(block.promise, 'promise', 'lede');
      add(true, 'documentLabel', 'label');
      add(block.detail, 'detail', 'small');
      add(block.dateLabel, 'dateLabel', 'caption');
      break;
    case 'quote':
      add(true, 'text', 'quote');
      add(block.attribution, 'attribution', 'caption');
      break;
    default:
      break;
  }
  return out;
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
  const figures = new Set(section.blocks.filter((b) => b.kind === 'figure').map((b) => b.id));
  const icons = new Set(section.blocks.flatMap((b) => (b.kind === 'points' ? b.items.map((i) => i.icon).filter((x): x is string => Boolean(x)) : [])));
  // Un bloc posé CHAMP PAR CHAMP n'est admis que s'il est entier : chaque libellé d'un « points ».
  const fieldRefs = new Map<string, Set<string>>();
  const collect = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const nd = node as Record<string, unknown>;
    if (nd.t === 'text' && typeof nd.ref === 'string' && nd.ref.includes('.')) {
      const [id, ...rest] = nd.ref.split('.');
      if (!fieldRefs.has(id)) fieldRefs.set(id, new Set());
      fieldRefs.get(id)!.add(rest.join('.'));
    }
    for (const child of Array.isArray(nd.children) ? nd.children : []) collect(child);
    for (const item of Array.isArray(nd.items) ? nd.items : []) collect((item as { node?: unknown })?.node);
  };
  collect(o.root);
  // Un bloc posé CHAMP PAR CHAMP (le titre d'un visuel en haut, son prix dans une pastille…) : admis pour les
  // blocs faits de champs courts ; un champ oublié est AJOUTÉ (jamais perdu), il ne coûte pas la composition.
  const wholeByFields = new Set<string>();
  const forgottenFields: NodeT[] = [];
  for (const [id, refs] of fieldRefs) {
    const block = section.blocks.find((b) => b.id === id);
    if (!block) continue;
    const fields = fieldPathsOf(block);
    if (!fields.length || !refs.has(fields[0].path)) {
      repaired.push(`bloc ${id} posé en partie champ par champ : reposé en entier`);
      continue;
    }
    wholeByFields.add(id);
    const missingFields = fields.filter((f) => !refs.has(f.path));
    for (const f of missingFields) forgottenFields.push({ t: 'text', role: f.role, ref: `${id}.${f.path}` } as NodeT);
    if (missingFields.length) repaired.push(`${missingFields.length} champ(s) de ${id} oublié(s) : ajouté(s)`);
  }
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
      const [id] = nd.ref.split('.');
      if (nd.ref.includes('.') && !wholeByFields.has(id) && ids.has(id)) return null;
      delete nd.bind;
    }
    if (nd.t === 'block') {
      if (typeof nd.ref !== 'string' || !ids.has(nd.ref) || seen.has(nd.ref) || wholeByFields.has(nd.ref)) {
        repaired.push(`bloc ${String(nd.ref)} écarté (inconnu ou en double)`);
        return null;
      }
      seen.add(nd.ref);
      delete nd.component;
    }
    if (nd.t === 'image') {
      // Une image ne vient que d'une figure du contenu : jamais une adresse écrite par le modèle.
      delete nd.url;
      if (typeof nd.ref !== 'string' || !figures.has(nd.ref) || seen.has(nd.ref)) {
        repaired.push(`image ${String(nd.ref)} écartée (pas une figure du contenu, ou en double)`);
        return null;
      }
      seen.add(nd.ref);
    }
    if (nd.t === 'icon' && (typeof nd.name !== 'string' || !icons.has(nd.name))) {
      repaired.push(`icône ${String(nd.name)} écartée (pas celle d'un point)`);
      return null;
    }
    if (Array.isArray(nd.children)) nd.children = (nd.children as unknown[]).map(clean).filter(Boolean);
    if (nd.t === 'layer') {
      const items = (Array.isArray(nd.items) ? nd.items : [])
        .map((it) => {
          const item = it as { at?: DecorItem['at']; z?: number; node?: unknown };
          const child = clean(item?.node);
          return item?.at && child ? { at: item.at, ...(typeof item.z === 'number' ? { z: item.z } : {}), node: child } : null;
        })
        .filter(Boolean)
        .slice(0, 24);
      if (!items.length) return null;
      nd.items = items;
    }
    return nd as NodeT;
  };
  let root = clean(o.root);
  if (!root) return undefined;
  if (format.kind === 'flow' && root.t !== 'stack') root = { t: 'stack', gap: 'lg', children: [root] };
  // Une page fixe peut avoir un CALQUE pour racine (superpositions libres) ; sinon un conteneur.
  if (!('children' in root) && root.t !== 'layer') root = { t: 'stack', gap: 'md', grow: true, children: [root] };
  const missing = section.blocks.filter((b) => !seen.has(b.id) && !wholeByFields.has(b.id));
  if (missing.length || forgottenFields.length) {
    const added: NodeT[] = [...(forgottenFields.length ? [{ t: 'stack', gap: 'xs', children: forgottenFields } as NodeT] : []), ...missing.map((b) => ({ t: 'block' as const, ref: b.id }))];
    if (root.t === 'layer') root = { t: 'stack', gap: 'md', grow: true, children: [{ ...root }, ...added] } as NodeT;
    else if ('children' in root) root.children.push(...added);
    if (missing.length) repaired.push(`${missing.length} bloc(s) oublié(s) ajouté(s) en fin de page`);
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
