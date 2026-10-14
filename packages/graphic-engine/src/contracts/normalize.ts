/**
 * Le normalisateur INDULGENT : de ce qu'un modèle a rendu à un contenu valide.
 *
 * Le contrat est strict ; les modèles ne le sont pas. Entre les deux, ce module ne lève JAMAIS sur
 * un bloc mal formé : il l'écarte (et le dit), il complète ce qui peut l'être (lignes de tableau
 * irrégulières, séries plus courtes que les étiquettes), il raccourcit ce qui dépasse. Un petit
 * modèle produit régulièrement un bloc à moitié rempli au milieu de blocs corrects : perdre la
 * page entière pour cela serait exactement l'échec que ce dispositif supprime.
 *
 * Renvoie `section: null` seulement quand il ne reste rien d'exploitable — l'appelant retombe alors
 * sur son repli.
 */
import { Issue } from './common';
import { Block, BlockKind, MODEL_BLOCK_KINDS, SectionContent, SectionRole, CARD_FIELDS, ChartType } from './content-model';
import { SlideIntent, TextBudget, VISUAL_STRATEGIES, VisualStrategy } from './slide-intent';

export interface NormalizeOptions {
  /** Identifiant imposé de la section (sinon dérivé du titre). */
  id?: string;
  role?: SectionRole;
  /** `model` (défaut) : seuls les blocs qu'un modèle peut produire ; `all` : tous (contenu posé par le code). */
  allow?: 'model' | 'all' | ReadonlySet<BlockKind>;
  /**
   * L'intention de la page. `visualStrategy` est la stratégie du CODE ; celle que le modèle propose (clé
   * `visual` de sa sortie) ne l'emporte que si elle figure dans `allowStrategies` (la jauge en décide).
   */
  intent?: { visualStrategy: VisualStrategy; textBudget?: TextBudget; allowStrategies?: readonly VisualStrategy[] };
}

export interface NormalizeReport {
  section: SectionContent | null;
  /** Ce qui a été écarté ou raccourci — pour les journaux, jamais pour l'utilisateur. */
  notes: Issue[];
}

const advisory = (code: string, message: string, path?: string): Issue => ({ code, severity: 'advisory', message, ...(path ? { path } : {}) });

/** Texte propre, sur une ligne, borné à `max` (coupé au dernier mot entier, avec « … »). */
export function clip(value: unknown, max: number): string {
  const raw = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

const texts = (value: unknown, maxItems: number, maxLen: number): string[] =>
  (Array.isArray(value) ? value : [])
    .map((v) => clip(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

const numbers = (value: unknown): number[] =>
  (Array.isArray(value) ? value : [])
    .map((n) => (typeof n === 'string' ? Number(n.replace(/\s/g, '').replace(',', '.')) : Number(n)))
    .filter((n) => Number.isFinite(n));

const records = (value: unknown): Record<string, unknown>[] =>
  (Array.isArray(value) ? value : []).filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v));

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;

export const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';

const KIND_ALIASES: Record<string, BlockKind> = {
  text: 'prose',
  paragraph: 'prose',
  paragraphs: 'prose',
  stats: 'metrics',
  kpi: 'metrics',
  kpis: 'metrics',
  numbers: 'metrics',
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const URL_RE = /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);)/i;
const CHART_TYPES = new Set<string>(['bar', 'groupedBar', 'stacked', 'horizontalBar', 'line', 'area', 'pie', 'doughnut', 'radar']);

function allowedKinds(allow: NormalizeOptions['allow']): ReadonlySet<BlockKind> | null {
  if (allow === 'all') return null;
  if (!allow || allow === 'model') return MODEL_BLOCK_KINDS;
  return allow;
}

function buildBlock(kind: string, b: Record<string, unknown>): Record<string, unknown> | null {
  switch (kind) {
    case 'prose': {
      const paragraphs = texts(b.paragraphs ?? b.text, 24, 2400);
      return paragraphs.length ? { paragraphs } : null;
    }
    case 'cards': {
      const items = records(b.items)
        .map((i) => ({ title: clip(i.title, 120), body: clip(i.body, 700), emphasis: i.emphasis === true ? true : undefined }))
        .filter((i) => i.title || i.body)
        // Une carte sans titre ou sans corps reste une carte : on complète par l'autre champ.
        .map((i) => ({ title: i.title || clip(i.body, 120), body: i.body || i.title, ...(i.emphasis ? { emphasis: true } : {}) }))
        .slice(0, 12);
      return items.length ? { items } : null;
    }
    case 'table': {
      const headers = texts(b.headers, 10, 80);
      const rows = (Array.isArray(b.rows) ? b.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => clip(c, 320)) : [])).filter((r) => r.some(Boolean));
      if (!headers.length || !rows.length) return null;
      // Lignes recalibrées sur l'en-tête : une ligne courte casserait la grille.
      const aligned = rows.slice(0, 60).map((r) => (r.length === headers.length ? r : [...r, ...Array(Math.max(0, headers.length - r.length)).fill('')].slice(0, headers.length)));
      return { headers, rows: aligned, ...(clip(b.caption, 240) ? { caption: clip(b.caption, 240) } : {}) };
    }
    case 'metrics': {
      const items = records(b.items)
        .map((i) => ({ value: clip(i.value, 32), label: clip(i.label, 96), note: clip(i.note, 96) }))
        .filter((i) => i.value && i.label)
        .map((i) => ({ value: i.value, label: i.label, ...(i.note ? { note: i.note } : {}) }))
        .slice(0, 8);
      return items.length ? { items } : null;
    }
    case 'chart': {
      const labels = texts(b.labels, 36, 48);
      const series = records(b.series)
        .map((s) => ({ name: clip(s.name, 64) || 'Série', data: numbers(s.data) }))
        .filter((s) => s.data.length > 0)
        .slice(0, 8);
      if (!labels.length || !series.length) return null;
      // Séries recalibrées sur les libellés : une barre sans étiquette ne se dessine pas, une étiquette sans valeur laisse un trou.
      const aligned = series.map((s) => ({ name: s.name, data: labels.map((_, i) => s.data[i] ?? 0) }));
      // Un graphique dont toutes les valeurs valent zéro se rend comme un CADRE VIDE : pire que pas de graphique.
      if (!aligned.some((s) => s.data.some((v) => v !== 0))) return null;
      const declared = typeof b.chartType === 'string' && CHART_TYPES.has(b.chartType) ? (b.chartType as ChartType) : null;
      // Sinon on déduit de la FORME de la donnée : plusieurs séries appellent des barres groupées, une seule des barres.
      const chartType = declared ?? (aligned.length > 1 ? 'groupedBar' : 'bar');
      const title = clip(b.title, 140);
      return {
        chartType,
        ...(title ? { title } : {}),
        labels,
        series: aligned,
        readingKey: clip(b.readingKey, 240) || title || aligned[0].name,
        ...(clip(b.unit, 24) ? { unit: clip(b.unit, 24) } : {}),
      };
    }
    case 'quote': {
      const t = clip(b.text, 600);
      return t ? { text: t, ...(clip(b.attribution, 120) ? { attribution: clip(b.attribution, 120) } : {}) } : null;
    }
    case 'timeline': {
      const steps = records(b.steps)
        .map((s) => ({ date: clip(s.date, 40) || '—', title: clip(s.title, 120), body: clip(s.body, 500) || clip(s.title, 120) }))
        .filter((s) => s.title)
        .slice(0, 10);
      return steps.length >= 2 ? { steps } : null;
    }
    case 'assumption': {
      const statement = clip(b.statement, 400);
      return statement ? { statement, basis: clip(b.basis, 500) || '—' } : null;
    }
    case 'comparison': {
      const columns = texts(b.columns, 5, 60);
      const rows = records(b.rows)
        .map((r) => ({ label: clip(r.label, 100), values: texts(r.values, 5, 160) }))
        .filter((r) => r.label && r.values.length)
        .map((r) => ({ label: r.label, values: columns.map((_, i) => r.values[i] ?? '—') }))
        .slice(0, 12);
      return columns.length >= 2 && rows.length ? { columns, rows } : null;
    }
    case 'steps': {
      const items = records(b.items)
        .map((i) => ({ title: clip(i.title, 100), body: clip(i.body, 420) || clip(i.title, 100) }))
        .filter((i) => i.title)
        .slice(0, 7);
      return items.length >= 2 ? { items } : null;
    }
    case 'swot': {
      const out = { strengths: texts(b.strengths, 5, 200), weaknesses: texts(b.weaknesses, 5, 200), opportunities: texts(b.opportunities, 5, 200), threats: texts(b.threats, 5, 200) };
      return Object.values(out).every((l) => l.length) ? out : null;
    }
    case 'funnel': {
      const stages = records(b.stages)
        .map((s) => ({ label: clip(s.label, 80), value: clip(s.value, 32), ...(clip(s.note, 100) ? { note: clip(s.note, 100) } : {}) }))
        .filter((s) => s.label && s.value)
        .slice(0, 6);
      return stages.length >= 3 ? { stages } : null;
    }
    case 'persona': {
      const name = clip(b.name, 80);
      const role = clip(b.role, 120);
      if (!name || !role) return null;
      const traits = texts(b.traits, 6, 120);
      const needs = texts(b.needs, 5, 160);
      return { name, role, ...(traits.length ? { traits } : {}), ...(needs.length ? { needs } : {}), ...(clip(b.quote, 240) ? { quote: clip(b.quote, 240) } : {}) };
    }
    case 'riskMatrix': {
      const level = (v: unknown): 'low' | 'medium' | 'high' => (v === 'high' || v === 'medium' || v === 'low' ? v : 'medium');
      const risks = records(b.risks)
        .map((r) => ({ label: clip(r.label, 120), likelihood: level(r.likelihood), impact: level(r.impact), ...(clip(r.mitigation, 240) ? { mitigation: clip(r.mitigation, 240) } : {}) }))
        .filter((r) => r.label)
        .slice(0, 9);
      return risks.length ? { risks } : null;
    }
    case 'businessModel': {
      const keys = new Set(['partners', 'activities', 'resources', 'value', 'relations', 'channels', 'segments', 'costs', 'revenues']);
      const cells = records(b.cells)
        .map((c) => ({ key: String(c.key), items: texts(c.items, 4, 160) }))
        .filter((c) => keys.has(c.key) && c.items.length)
        .slice(0, 9);
      return cells.length >= 3 ? { cells } : null;
    }
    case 'points': {
      const items = records(b.items)
        .map((i) => {
          const media = i.media && typeof i.media === 'object' ? (i.media as Record<string, unknown>) : null;
          const url = media && typeof media.url === 'string' && URL_RE.test(media.url) ? media.url : '';
          const icon = typeof i.icon === 'string' && /^[a-z0-9-]{1,64}$/.test(i.icon) ? i.icon : '';
          return {
            label: clip(i.label ?? i.title, 80),
            ...(clip(i.detail ?? i.body, 160) ? { detail: clip(i.detail ?? i.body, 160) } : {}),
            ...(clip(i.value, 32) ? { value: clip(i.value, 32) } : {}),
            ...(clip(i.visual, 60) ? { visual: clip(i.visual, 60) } : {}),
            ...(icon ? { icon } : {}),
            ...(url ? { media: { url, alt: clip(media?.alt, 200) || clip(i.label ?? i.title, 80) || 'Illustration' } } : {}),
          };
        })
        .filter((i) => i.label)
        .slice(0, 6);
      return items.length >= 2 ? { items } : null;
    }
    case 'figure': {
      const url = typeof b.url === 'string' && URL_RE.test(b.url) ? b.url : '';
      const focal = b.focal && typeof b.focal === 'object' ? (b.focal as Record<string, unknown>) : null;
      const unit = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
      const fx = focal ? unit(focal.x) : null;
      const fy = focal ? unit(focal.y) : null;
      return url ? { url, alt: clip(b.alt, 200) || 'Illustration', ...(clip(b.caption, 240) ? { caption: clip(b.caption, 240) } : {}), ...(fx !== null && fy !== null ? { focal: { x: fx, y: fy } } : {}) } : null;
    }
    case 'copy': {
      const headline = clip(b.headline, 180);
      if (!headline) return null;
      const facts = records(b.facts)
        .map((f) => ({ ...(clip(f.label, 40) ? { label: clip(f.label, 40) } : {}), text: clip(f.text, 120) }))
        .filter((f) => f.text)
        .slice(0, 5);
      const quote = b.quote && typeof b.quote === 'object' ? (b.quote as Record<string, unknown>) : null;
      return {
        ...(clip(b.kicker, 60) ? { kicker: clip(b.kicker, 60) } : {}),
        headline,
        ...(clip(b.subhead, 240) ? { subhead: clip(b.subhead, 240) } : {}),
        ...(clip(b.body, 600) ? { body: clip(b.body, 600) } : {}),
        ...(clip(b.offer, 48) ? { offer: clip(b.offer, 48) } : {}),
        ...(facts.length ? { facts } : {}),
        ...(quote && clip(quote.text, 300) ? { quote: { text: clip(quote.text, 300), ...(clip(quote.author, 80) ? { author: clip(quote.author, 80) } : {}) } } : {}),
        ...(clip(b.footnote, 160) ? { footnote: clip(b.footnote, 160) } : {}),
      };
    }
    case 'contact': {
      const raw = b.fields && typeof b.fields === 'object' ? (b.fields as Record<string, unknown>) : {};
      const fields: Record<string, string> = {};
      for (const key of CARD_FIELDS) if (clip(raw[key], 160)) fields[key] = clip(raw[key], 160);
      return { side: b.side === 'back' ? 'back' : 'front', fields, binding: b.binding === 'markers' ? 'markers' : 'values' };
    }
    default:
      // Les spécimens et la couverture portent des valeurs exactes posées par le code : ils passent tels quels.
      return b;
  }
}

/** Un bloc, ou `null` (avec la raison dans `notes`). */
export function normalizeBlock(raw: unknown, nextId: () => string, notes: Issue[], allow: NormalizeOptions['allow'] = 'model'): Block | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const declared = String(input.kind ?? input.type ?? '').trim();
  const kind = (KIND_ALIASES[declared] ?? declared) as string;
  const kinds = allowedKinds(allow);
  if (kinds && !kinds.has(kind as BlockKind)) {
    notes.push(advisory('block_kind_refused', `Bloc « ${declared || '?'} » écarté : ce type n'est pas admis ici.`));
    return null;
  }
  const built = buildBlock(kind, input);
  if (!built) {
    notes.push(advisory('block_dropped', `Bloc « ${kind} » écarté : rien d'exploitable.`));
    return null;
  }
  const id = typeof input.id === 'string' && ID_RE.test(input.id) ? input.id : nextId();
  const origin = input.origin === 'system' || input.origin === 'model' ? input.origin : undefined;
  const candidate = { ...built, kind, id, ...(origin ? { origin } : {}) };
  const checked = Block.safeParse(candidate);
  if (!checked.success) {
    notes.push(advisory('block_invalid', `Bloc « ${kind} » écarté : ${checked.error.issues[0]?.message ?? 'forme invalide'}.`));
    return null;
  }
  return checked.data;
}

/** Une section, depuis une sortie de modèle (objet déjà analysé). */
export function normalizeSection(raw: unknown, options: NormalizeOptions = {}): NormalizeReport {
  const notes: Issue[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { section: null, notes };
  const input = raw as Record<string, unknown>;
  const title = clip(input.title, 160);
  if (!title) {
    notes.push(advisory('section_untitled', 'Section sans titre : refusée.'));
    return { section: null, notes };
  }
  let counter = 0;
  const used = new Set<string>();
  const nextId = (): string => {
    let id: string;
    do id = `b${++counter}`;
    while (used.has(id));
    return id;
  };
  const blocks: Block[] = [];
  for (const candidate of Array.isArray(input.blocks) ? input.blocks : []) {
    const block = normalizeBlock(candidate, nextId, notes, options.allow);
    if (!block) continue;
    if (used.has(block.id)) (block as { id: string }).id = nextId();
    used.add(block.id);
    blocks.push(block);
  }
  if (!blocks.length) {
    notes.push(advisory('section_empty', 'Aucun bloc exploitable.'));
    return { section: null, notes };
  }
  const section: SectionContent = {
    id: options.id && ID_RE.test(options.id) ? options.id : slug(title),
    ...(options.role ? { role: options.role } : {}),
    ...(clip(input.kicker, 80) ? { kicker: clip(input.kicker, 80) } : {}),
    title,
    ...(clip(input.lede, 320) ? { lede: clip(input.lede, 320) } : {}),
    blocks: blocks.slice(0, 40),
  };
  const intent = normalizeIntent(input.intent ?? input.visual, options.intent, notes);
  if (intent) section.intent = intent;
  const spoken = typeof input.notes === 'string' ? input.notes.replace(/\s+/g, ' ').trim().slice(0, 4000) : '';
  if (spoken) section.notes = spoken;
  return { section, notes };
}

/**
 * L'intention d'une page : celle du code, que la proposition du modèle (`visual` : stratégie, message,
 * image) complète. La stratégie du modèle n'est retenue que si elle est admise — aux crans où le code
 * décide, la liste admise ne contient que la sienne.
 */
export function normalizeIntent(raw: unknown, base: NormalizeOptions['intent'], notes: Issue[] = []): SlideIntent | undefined {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const asked = String(o.strategy ?? o.visualStrategy ?? '').trim() as VisualStrategy;
  const known = (VISUAL_STRATEGIES as readonly string[]).includes(asked);
  const allowed = base?.allowStrategies ?? (base ? [base.visualStrategy] : VISUAL_STRATEGIES);
  let strategy: VisualStrategy | undefined = base?.visualStrategy;
  if (known && allowed.includes(asked)) strategy = asked;
  else if (known && base && asked !== base.visualStrategy) notes.push(advisory('strategy_refused', `Stratégie « ${asked} » proposée par le modèle : non admise à ce cran, « ${base.visualStrategy} » gardée.`));
  if (!strategy) return undefined;
  const image = o.image && typeof o.image === 'object' ? (o.image as Record<string, unknown>) : typeof o.image === 'string' ? { subject: o.image } : null;
  const subject = image ? clip(image.subject, 240) : '';
  const keyMessage = clip(o.keyMessage ?? o.message, 200);
  // Une intention déjà normalisée (seconde passe, contenu rejoué) garde son budget et ses preuves.
  const budget = base?.textBudget ?? (TextBudget.safeParse(o.textBudget).success ? (o.textBudget as TextBudget) : undefined);
  const evidence = Array.isArray(o.evidenceRefs) ? o.evidenceRefs.filter((r): r is string => typeof r === 'string' && ID_RE.test(r)).slice(0, 8) : [];
  return {
    visualStrategy: strategy,
    ...(keyMessage ? { keyMessage } : {}),
    ...(budget ? { textBudget: budget } : {}),
    ...(evidence.length ? { evidenceRefs: evidence } : {}),
    ...(subject ? { image: { subject, ...(clip(image?.framing, 80) ? { framing: clip(image?.framing, 80) } : {}), ...(clip(image?.mood, 80) ? { mood: clip(image?.mood, 80) } : {}) } } : {}),
  };
}

/** Une couleur hexadécimale valide, ou le repli. */
export const hexOr = (value: unknown, fallback: string): string => (typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim() : fallback);
