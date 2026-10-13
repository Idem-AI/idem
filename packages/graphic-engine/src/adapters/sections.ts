/**
 * Les AIDES DE SECTION : ce que les services des applications font autour du moteur, écrit une fois.
 *
 *  · la sortie d'un rédacteur (JSON, JSON abîmé, ou page HTML par erreur) → une section valide ;
 *  · les blocs POSÉS PAR LE CODE (spécimens de charte, tableaux financiers) → des blocs exacts, jamais
 *    confiés à un modèle, placés avant ou après ce qu'il a écrit ;
 *  · la nomenclature imposée par le livrable (« Déclinaison sur fond sombre ») à la place du titre du modèle ;
 *  · une page rendue → le fragment autonome que stockent les applications (polices puis racine) ;
 *  · les contenus des toiles qui ne sont pas rédigées en sections : couverture, faces de carte, visuel.
 */
import type { Issue } from '../contracts/common';
import type { Block, BlockDraft, CardField, SectionContent, SectionRole } from '../contracts/content-model';
import { CARD_FIELDS } from '../contracts/content-model';
import { normalizeSection, NormalizeOptions } from '../contracts/normalize';
import { looksLikeHtmlPage, salvageHtmlSection } from '../contracts/salvage';
import type { SectionOutput } from '../engine';
import { parseJsonObject } from '../orchestrator/run-task';

export interface SectionFromModelOptions {
  /** Identifiant stable de la section (il sème sa composition). */
  id: string;
  role?: SectionRole;
  /** Blocs posés par le CODE avant ceux du modèle (spécimens, tableaux financiers) — normalisés. */
  prepend?: Array<BlockDraft | Block>;
  /** Blocs posés par le code après ceux du modèle (références d'une section sourcée). */
  append?: Array<BlockDraft | Block>;
  /** La nomenclature du livrable l'emporte sur le titre du modèle — et son sur-titre avec lui. */
  heading?: { title: string; kicker?: string };
  /** Recompose les blocs (spécimens compris) : le logo et son explication dans UN objet graphique. */
  compose?: (blocks: Block[]) => Block[];
  /** Titre de repli d'une page récupérée sans titre. */
  fallbackTitle?: string;
  /** Les types de blocs admis venant du modèle (défaut : ceux qu'un modèle peut produire). */
  allow?: NormalizeOptions['allow'];
}

export interface SectionFromModelResult {
  section: SectionContent | null;
  /** Ce qui a été écarté ou complété (journaux). */
  notes: Issue[];
  /** La sortie était une page HTML : son texte a été récupéré. */
  salvaged: boolean;
}

/** Les blocs posés par le code, normalisés (tous les types admis), avec des identifiants qui ne croisent jamais ceux du modèle. */
export function systemBlocks(raw: unknown[], prefix = 'sys'): Block[] {
  if (!raw.length) return [];
  const out = normalizeSection({ title: 'system', blocks: raw.map((b) => (b && typeof b === 'object' ? { ...(b as object), id: undefined } : b)) }, { allow: 'all' }).section?.blocks ?? [];
  return out.map((block, i) => ({ ...block, id: `${prefix}-${i + 1}`, origin: 'system' }) as Block);
}

/**
 * La sortie d'un rédacteur → une section. `raw` est un objet déjà lu (l'hôte a son propre réparateur de
 * JSON tronqué) ou le texte brut. `section: null` : rien d'exploitable — l'appelant traite la section comme
 * échouée (jamais une page de JSON brut).
 */
export function sectionFromModel(raw: unknown, o: SectionFromModelOptions): SectionFromModelResult {
  let input: unknown = raw;
  let salvaged = false;
  if (typeof raw === 'string') {
    if (looksLikeHtmlPage(raw)) {
      input = salvageHtmlSection(raw, o.heading?.title ?? o.fallbackTitle ?? o.id, { id: o.id });
      salvaged = Boolean(input);
    } else input = parseJsonObject(raw);
  }
  const model = input ? normalizeSection(input, { id: o.id, role: o.role, allow: o.allow ?? 'model' }) : { section: null, notes: [] as Issue[] };
  if (!model.section) return { section: null, notes: model.notes, salvaged };
  const blocks = [...systemBlocks(o.prepend ?? [], 'sys'), ...model.section.blocks, ...systemBlocks(o.append ?? [], 'ref')];
  const composed = o.compose ? o.compose(blocks) : blocks;
  const headed: Record<string, unknown> = { ...model.section, blocks: composed };
  if (o.heading) {
    headed.title = o.heading.title;
    if (o.heading.kicker) headed.kicker = o.heading.kicker;
    else delete headed.kicker;
  }
  if (o.role) headed.role = o.role;
  const final = normalizeSection(headed, { id: o.id, role: o.role, allow: 'all' });
  return { section: final.section, notes: [...model.notes, ...final.notes], salvaged };
}

/** Une section entièrement posée par le code (page de spécimens, page de références). */
export function systemSection(o: { id: string; title: string; kicker?: string; lede?: string; role?: SectionRole; blocks: Array<BlockDraft | Block> }): SectionContent | null {
  return normalizeSection({ title: o.title, ...(o.kicker ? { kicker: o.kicker } : {}), ...(o.lede ? { lede: o.lede } : {}), blocks: systemBlocks(o.blocks) }, { id: o.id, role: o.role, allow: 'all' }).section;
}

/**
 * Le fragment AUTONOME d'une page : les polices d'abord, puis la racine. Les `<link>` restent AVANT la
 * racine, jamais dedans : le paginateur du PDF prend les enfants de la racine pour des blocs de contenu.
 */
export function sectionHtml(out: Pick<SectionOutput, 'result'>): string {
  return `${out.result.head ? `${out.result.head}\n` : ''}${out.result.html}`;
}

// ── Les toiles qui ne sont pas rédigées en sections ─────────────────────────────────────────

/** La couverture d'un livrable : le nom, ce qu'il est, sa promesse — des mots, jamais une mise en page. */
export function coverContent(o: { id?: string; brandName: string; documentLabel: string; kicker?: string; promise?: string; detail?: string; dateLabel?: string }): SectionContent {
  const clip = (v: string | undefined, max: number) => (v && v.trim() ? v.trim().slice(0, max) : undefined);
  const block = {
    id: 'cover',
    kind: 'cover' as const,
    brandName: clip(o.brandName, 80) ?? 'Marque',
    documentLabel: clip(o.documentLabel, 60) ?? 'Document',
    ...(clip(o.kicker, 80) ? { kicker: clip(o.kicker, 80) } : {}),
    ...(clip(o.promise, 200) ? { promise: clip(o.promise, 200) } : {}),
    ...(clip(o.detail, 80) ? { detail: clip(o.detail, 80) } : {}),
    ...(clip(o.dateLabel, 40) ? { dateLabel: clip(o.dateLabel, 40) } : {}),
  };
  return { id: o.id ?? 'cover', role: 'cover', title: block.brandName, blocks: [block] };
}

/**
 * Les deux faces d'une carte de visite. En mode `markers`, la carte est un GABARIT partagé (chaque champ
 * sort en `{{champ}}` dans un élément `data-field`) ; en mode `values`, elle porte les valeurs.
 */
export function cardFaces(o: { binding: 'markers' | 'values'; fields?: Partial<Record<CardField, string>> }): { front: SectionContent; back: SectionContent } {
  const fields = Object.fromEntries(CARD_FIELDS.map((f) => [f, o.fields?.[f]?.trim() ? o.fields[f]?.trim().slice(0, 160) : undefined]).filter(([, v]) => v !== undefined)) as Partial<Record<CardField, string>>;
  const face = (side: 'front' | 'back'): SectionContent => ({ id: side, role: 'card-face', title: side === 'front' ? 'Recto' : 'Verso', blocks: [{ id: 'contact', kind: 'contact', side, binding: o.binding, fields }] });
  return { front: face('front'), back: face('back') };
}

export interface VisualCopy {
  kicker?: string;
  headline: string;
  subhead?: string;
  body?: string;
  offer?: string;
  facts?: Array<{ label?: string; text: string }>;
  quote?: { text: string; author?: string };
  footnote?: string;
}

/** Un visuel (flyer, publication, story, bannière) : son texte et, s'il y en a une, sa photo. */
export function visualContent(o: { id?: string; title?: string; copy: VisualCopy; image?: { url: string; alt: string; caption?: string; focal?: { x: number; y: number } } | null }): SectionContent | null {
  const blocks: unknown[] = [{ kind: 'copy', ...o.copy }];
  if (o.image?.url) blocks.push({ kind: 'figure', url: o.image.url, alt: o.image.alt || o.copy.headline, ...(o.image.caption ? { caption: o.image.caption } : {}), ...(o.image.focal ? { focal: o.image.focal } : {}) });
  return normalizeSection({ title: o.title ?? o.copy.headline, blocks }, { id: o.id ?? 'visual', role: 'visual', allow: 'all' }).section;
}
