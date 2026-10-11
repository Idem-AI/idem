/**
 * LE COMPOSITEUR DE PAGE — le cran Ultra des documents (charte graphique, business plan, pitch deck).
 *
 * Deux agents distincts : le rédacteur a déjà écrit et fait valider le CONTENU (blocs,
 * chiffres, citations, sources ; et les spécimens posés par le code : nuancier, polices,
 * logos) ; le compositeur n'écrit que la MISE EN PAGE, en HTML, autour de ce contenu. Il ne
 * peut rien ajouter : le code vérifie, après lui,
 *
 *  - la forme (grille qualité : troncature, balises, gabarit non rempli, bavardage) ;
 *  - la fidélité : les textes du contenu sont là, aucun chiffre n'apparaît qui n'y était pas,
 *    chaque couleur et chaque image du contenu est posée, aucune autre image n'est appelée ;
 *  - le rendu MESURÉ au format réel (`pageInspect.ts`) : rien de rogné, hors page, trop petit
 *    ou illisible — les constats repartent au compositeur pour UNE réparation ;
 *  - les règles de design (anti-« slop », enforceDesignRules) — réparées sur place.
 *
 * Une page refusée retombe sur le rendu par gabarit (`renderSection`) : une page Ultra n'est
 * jamais pire qu'une page gabarit.
 */
import logger from '../../config/logger';
import { pageGfx, pageKitManifest } from '../../../../ivision/core/src/visual/poster/kit/page';
import { inspectOutput } from '../agents/quality-gate';
import { derivedPalette, DocumentDesignSystem } from '../design/documentDesignSystem';
import { describeSectionSeed, SectionSeed } from '../design/designSeed';
import { condenseForFixedPage, SectionContent } from '../design/sectionContent';
import { PageFormat, renderStandaloneChart } from '../design/sectionRenderer';
import { enforceDesignRules, SlopLintOptions } from '../design/slopLint.service';
import { AgentCall, AgentTrace, CreativeOrchestrator } from './orchestrator';
import { inspectComposedPage } from './pageInspect';

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[’'`«»"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const URL_RE = /^(https?:|data:)/i;
const HEX_RE = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;

function strings(content: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number' && Number.isFinite(v)) out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(content);
  return out;
}

/**
 * Les textes du contenu à retrouver sur la page : les phrases (au moins 12 caractères, des
 * mots, une espace). Les identifiants, URLs, valeurs hexadécimales et noms de motifs n'en sont
 * pas — ils sont contrôlés à part, ou n'ont pas à être écrits.
 */
function contentTexts(content: SectionContent): string[] {
  return strings(content).filter((v) => v.trim().length >= 12 && /\s/.test(v.trim()) && /[a-zà-ÿ]{3,}/i.test(v) && !URL_RE.test(v.trim()));
}

/** Les nombres d'un texte (« 1 200 000 », « 12,5 % » → 1200000, 12,5). */
const numbersOf = (t: string) => (t.replace(/(\d)[\s .](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g) || []).filter((n) => n.length >= 2);

/** Les images du contenu (logos, spécimens, photos) : les seules que la page peut appeler. */
const imagesOf = (content: SectionContent) => [...new Set(strings(content).map((s) => s.trim()).filter((s) => URL_RE.test(s)))];

/** Repère court d'une image du contenu : le modèle l'écrit, le code le remplace par l'URL. */
const imageToken = (index: number) => `{{IMG_${index + 1}}}`;

/** Le contenu tel que le compositeur le lit : chaque image remplacée par son repère. */
function withImageTokens(content: SectionContent, images: string[]): SectionContent {
  const swap = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const index = images.indexOf(v.trim());
      return index >= 0 ? imageToken(index) : v;
    }
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return swap(content) as SectionContent;
}

/** La réponse du compositeur, ses repères remplacés par les URLs réelles. */
const restoreImages = (raw: string, images: string[]) => images.reduce((html, url, i) => html.split(imageToken(i)).join(url), raw || '');

type ChartBlock = Extract<SectionContent['blocks'][number], { kind: 'chart' }>;

/** Les graphiques du contenu : le compositeur les PLACE, il ne les dessine pas. */
const chartsOf = (content: SectionContent): ChartBlock[] => content.blocks.filter((b): b is ChartBlock => b.kind === 'chart');

const chartToken = (index: number) => `{{CHART_${index + 1}}}`;

/** Une ligne par graphique : ce qu'il montre, pour que le compositeur lui donne la bonne place. */
const describeCharts = (charts: ChartBlock[]) =>
  charts.map((c, i) => `${chartToken(i)} — ${c.chartType}, ${c.labels.length} ${c.labels.length > 1 ? 'entries' : 'entry'} (${c.labels.slice(0, 4).join(', ')}${c.labels.length > 4 ? '…' : ''}), ${c.series.length} series${c.unit ? `, in ${c.unit}` : ''}${c.readingKey ? ` — reads: ${c.readingKey}` : ''}`);

/** Chaque repère remplacé par le graphique RÉEL, dessiné par le code (canvas Chart.js + repli). */
function restoreCharts(raw: string, charts: ChartBlock[], draw: (block: ChartBlock) => string): string {
  return charts.reduce((html, block, i) => (html.includes(chartToken(i)) ? html.split(chartToken(i)).join(`<div style="width:100%">${draw(block)}</div>`) : html), raw || '');
}

export function buildComposerPrompt(input: {
  content: SectionContent;
  ds: DocumentDesignSystem;
  seed: SectionSeed;
  page: PageFormat;
  sheet: string;
  document: string;
  /** Une section = exactement une page (diapositive, page de charte). */
  singlePage?: boolean;
}): { system: string; user: string } {
  const { ds, page } = input;
  // Les URLs (parfois des data: de plusieurs Ko) ne partent pas au modèle : des repères courts.
  const images = imagesOf(input.content);
  const charts = chartsOf(input.content);
  const content = withImageTokens(input.content, images);
  const system = [
    `You are a senior editorial designer. You compose ONE page of a ${input.document} in HTML with Tailwind CSS classes, from VALIDATED content. Answer with the HTML only, in a single \`\`\`html block.`,
    input.singlePage
      ? `- Root element: <section style="width:${page.width};height:${page.minHeight};padding:${page.padding};position:relative;overflow:hidden;box-sizing:border-box"> … </section>. EVERYTHING must fit in this one page: nothing may be cut at the bottom.`
      : `- Root element: <section style="width:${page.width};min-height:${page.minHeight};padding:${page.padding};position:relative;box-sizing:border-box"> … </section>.`,
    `- Colours: ONLY these hex values — surface ${ds.colors.surface}, raised ${ds.colors.surfaceRaised}, ink ${ds.colors.ink}, muted ${ds.colors.inkMuted}, primary ${ds.colors.primary}, secondary ${ds.colors.secondary}, accent ${ds.colors.accent} (text on accent: ${ds.colors.onAccent}), rules ${ds.colors.rule} — plus the hex values given in the content. Text must keep ≥ 4.5:1 contrast with its background. The page background stays light (${ds.colors.surface}).`,
    `- Fonts: font-family '${ds.fonts.display}' for titles, '${ds.fonts.body}' for text (inline style). Sizes from this scale (px): ${Object.entries(ds.typeScale).map(([k, v]) => `${k} ${v}`).join(', ')}. Never below 10 px.`,
    '- Keep EVERY text of the content verbatim and in order of importance. Do not add, remove or invent any fact, number, name, reference or source. No lorem ipsum, no placeholders.',
    '- Colour swatches, type specimens and logos in the content are the deliverable: show each one, large and exact (hex written as given, font names as given).',
    images.length
      ? `- Images: ONLY these placeholders, each one used once, written exactly as src: <img src="{{IMG_1}}" alt="…"> with object-fit: contain — ${images.map((_, i) => imageToken(i)).join(', ')}. No other image, no CSS background image.`
      : '- No image at all.',
    charts.length
      ? `- Charts: the code draws them, you only give them their place and their size — write the placeholder on its own line inside a block whose width you control: ${charts.map((_, i) => chartToken(i)).join(', ')}. Each one once. NEVER redraw a chart yourself (no bars as divs, no invented values, no <canvas> of your own); the numbers of a chart stay out of the page text.\n${describeCharts(charts).map((line) => `  ${line}`).join('\n')}`
      : '- Metrics: tables as real <table>; no chart on this page.',
    '- Professional editorial layout: a clear focal point, generous whitespace, a strict grid, one accent colour, no decorative emoji, no gradients behind text, no drop shadows on text.',
    ...pageKitManifest({ page: { width: page.width, height: page.minHeight } }),
    '- No <script>, no web font link.',
  ].join('\n');
  const user = [input.sheet, `PAGE COMPOSITION (follow it):\n${describeSectionSeed(input.seed)}`, `CONTENT (JSON):\n${JSON.stringify(content)}`].join('\n\n');
  return { system, user };
}

/** Le HTML d'une réponse (bloc ```html, ou la réponse entière si elle commence par <section>). */
export function extractComposedHtml(raw: string): string | undefined {
  const html = ((raw || '').match(/```(?:html)?\s*\n([\s\S]*?)```/i)?.[1] || (/^\s*<section\b/i.test(raw || '') ? raw : '')).trim();
  return html || undefined;
}

/**
 * Les défauts de forme et de FIDÉLITÉ d'une page composée (vide = la page est fidèle) : chacun est
 * formulé pour être corrigé par le compositeur au tour suivant, jamais seulement constaté.
 */
export function fidelityIssues(html: string, content: SectionContent): string[] {
  const issues: string[] = [];
  if (/<script\b/i.test(html)) issues.push('remove every <script>');
  // Les graphiques : chaque repère posé une fois, et aucun graphique redessiné à la main — un
  // graphique « en divs » perd ses proportions, et un <canvas> du modèle reste vide à l'impression.
  // Le repère est ensuite neutralisé : ce qu'il désigne (le graphique, ses étiquettes, sa clé de
  // lecture) est dessiné par le code, et n'a donc pas à être écrit une seconde fois dans la page.
  const charts = chartsOf(content);
  let probe = html;
  charts.forEach((_, i) => {
    const count = html.split(chartToken(i)).length - 1;
    if (count !== 1) issues.push(`place ${chartToken(i)} exactly once (found ${count}): the code draws the chart, you only give it its place`);
    probe = probe.split(chartToken(i)).join('<div data-chart-slot="1"></div>');
  });
  if (charts.length && /<canvas\b/i.test(html)) issues.push('remove your <canvas>: a chart is placed with its {{CHART_n}} placeholder, never drawn by hand');
  html = probe;
  const form = inspectOutput(html, { format: 'html', minChars: 300 });
  if (form.blocking.length) issues.push(`form: ${form.summary}`);
  const page = norm(html);
  // Les textes que le CODE dessine (ceux des graphiques) ne sont pas réclamés au compositeur.
  const drawnByCode = new Set(strings({ blocks: charts } as unknown as SectionContent).map((s) => s.trim()));
  const texts = contentTexts(content).filter((t) => !drawnByCode.has(t.trim()));
  const missing = texts.filter((t) => !page.includes(norm(t).slice(0, 36)));
  if (texts.length && missing.length / texts.length > 0.15) issues.push(`these texts of the content are missing — write them verbatim: ${missing.slice(0, 4).map((t) => `"${t.slice(0, 70)}"`).join(' · ')}`);
  // Aucun chiffre qui n'était pas dans le contenu (un chiffre inventé dans un plan est une faute).
  const known = new Set(numbersOf(strings(content).filter((s) => !URL_RE.test(s.trim())).join(' ')));
  const invented = [...new Set(numbersOf(html.replace(/<[^>]+>/g, ' ')).filter((n) => !known.has(n)))];
  if (invented.length) issues.push(`remove these numbers, they are not in the content (no page numbers, sizes or figures of your own): ${invented.slice(0, 8).join(', ')}`);
  // Les spécimens : chaque couleur du contenu est posée, chaque image aussi, et aucune autre.
  const lower = html.toLowerCase();
  const hexes = [...new Set(strings(content).flatMap((s) => s.match(HEX_RE) || []).map((h) => h.toLowerCase()))];
  const absent = hexes.filter((h) => !lower.includes(h));
  if (absent.length) issues.push(`show these colours of the content (written as given): ${absent.join(', ')}`);
  const images = imagesOf(content);
  const lost = images.filter((u) => !html.includes(u));
  if (lost.length) issues.push(`place every image of the content (${lost.length} missing): use each placeholder once as <img src>`);
  const called = [...html.matchAll(/(?:src\s*=\s*["']|url\(\s*["']?)((?:https?:|data:)[^"')\s]+)/gi)].map((m) => m[1]);
  if (called.some((u) => !images.includes(u))) issues.push('use no image other than the placeholders of the content (no external URL, no CSS background image)');
  return issues;
}

/** Le HTML d'une réponse, s'il passe forme et fidélité ; sinon undefined. */
export function acceptComposedPage(raw: string, content: SectionContent): string | undefined {
  const html = extractComposedHtml(raw);
  return html && !fidelityIssues(html, content).length ? html : undefined;
}

export async function composePageHtml(input: {
  content: SectionContent;
  ds: DocumentDesignSystem;
  seed: SectionSeed;
  page: PageFormat;
  sheet: string;
  document: string;
  /** Une section = exactement une page (diapositive, page de charte) : la hauteur est bornée. */
  singlePage?: boolean;
  call?: AgentCall;
  /** Nom de la page (trace). */
  name: string;
  /** Règles de design du livrable (palette, polices, couleurs dérivées). */
  lint?: SlopLintOptions;
  /** Contrôle mesuré ; par défaut, le rendu Chromium au format de la page. */
  inspect?: (html: string) => Promise<string[]>;
}): Promise<{ html: string | null; traces: AgentTrace[]; issues?: string[] }> {
  const orchestrator = new CreativeOrchestrator({ level: 'ultra', call: input.call });
  const inspect =
    input.inspect ??
    ((html: string) => inspectComposedPage(html, { page: input.page, singlePage: !!input.singlePage, fonts: { display: input.ds.fonts.display, body: input.ds.fonts.body }, label: input.name }));
  const base = buildComposerPrompt(input);
  const images = imagesOf(input.content);
  const charts = chartsOf(input.content);
  // Le kit graphique de cette page : ses couleurs sont celles du document, ses cotes celles de la
  // page (millimètres à l'impression).
  const ds = input.ds;
  const gfx = pageGfx({
    width: input.page.width,
    height: input.page.minHeight,
    tokens: { primary: ds.colors.primary, secondary: ds.colors.secondary, accent: ds.colors.accent, ink: ds.colors.ink, muted: ds.colors.inkMuted, surface: ds.colors.surface, raised: ds.colors.surfaceRaised, rule: ds.colors.rule },
    surface: ds.colors.surface,
    ink: ds.colors.ink,
    primary: ds.colors.primary,
    secondary: ds.colors.secondary,
  });
  let issues: string[] = [];
  let previous: string | null = null;
  // Trois tours : la forme et la fidélité, puis la mesure du rendu, repartent au compositeur.
  // Une page n'est rendue par le gabarit qu'après trois essais.
  for (let attempt = 0; attempt < 3; attempt++) {
    const repair: boolean = attempt > 0 && !!previous;
    const res: { value: string | null } = await orchestrator.run<string | null>({
      role: 'pageComposer',
      key: `pageComposer:${input.name}${attempt ? `:r${attempt}` : ''}`,
      minLevel: 'ultra',
      profile: 'coder',
      prompt: (): { system: string; user: string } =>
        repair
          ? { system: base.system, user: `${base.user}\n\nYOUR PREVIOUS PAGE WAS CHECKED AND REJECTED. Fix ALL of these and answer with the whole corrected page in a single \`\`\`html block:\n- ${issues.join('\n- ')}\n\nPREVIOUS PAGE:\n\`\`\`html\n${previous}\n\`\`\`` }
          : base,
      parse: (raw) => extractComposedHtml(raw),
      fallback: () => null,
    });
    if (!res.value) {
      issues = ['no HTML was returned: answer with the whole page in a single ```html block'];
      continue;
    }
    const composed = restoreImages(res.value, images);
    previous = res.value;
    issues = fidelityIssues(composed, input.content);
    if (issues.length) continue;
    // Les règles de design (tics de génération, couleurs hors charte, ornements) réparées sur place.
    const linted = enforceDesignRules(composed, { ...input.lint, label: input.lint?.label ?? `ultra/${input.name}` }).html || composed;
    // Le décor du kit est dessiné APRÈS la relecture des règles : ses dégradés tonals sont des
    // mélanges des couleurs du document, et seraient pris pour des couleurs hors charte. Ce qui
    // est mesuré ensuite, et imprimé, est bien la page avec ses formes.
    const drawn = gfx.expand(linted);
    if (drawn.issues.length) {
      issues = drawn.issues;
      continue;
    }
    // Les graphiques du contenu, dessinés par le code à la place du repère.
    const html = restoreCharts(drawn.html, charts, (block) => renderStandaloneChart(block, input.ds, input.seed, { page: input.page, multiPage: !input.singlePage }));
    issues = await inspect(html);
    if (!issues.length) return { html, traces: orchestrator.traces };
  }
  return { html: null, traces: orchestrator.traces, issues };
}

/**
 * Le crochet `SectionTemplate.compose` d'une page au cran Ultra (common/generic.service.ts) :
 * le contenu validé de la page part au compositeur, condensé comme le gabarit le condenserait
 * sur une page à hauteur fixe ; `null` (page refusée) et le gabarit rend la page.
 */
export function ultraPageComposer(input: {
  ds: DocumentDesignSystem;
  seed: SectionSeed;
  page: PageFormat;
  singlePage: boolean;
  sheet: string;
  document: string;
  call?: AgentCall;
  name: string;
  lint?: SlopLintOptions;
}): (content: SectionContent) => Promise<string | null> {
  return async (content) => {
    const { ds } = input;
    // Les règles du design system du document : sa palette, ses rampes dérivées, ses polices.
    const lint: SlopLintOptions = {
      palette: { primary: ds.colors.primary, secondary: ds.colors.secondary, accent: ds.colors.accent, background: ds.colors.surface, text: ds.colors.ink },
      extraAllowedColors: derivedPalette(ds),
      fonts: [ds.fonts.display, ds.fonts.body].filter(Boolean),
      ...input.lint,
    };
    const { html, issues } = await composePageHtml({ ...input, lint, content: input.singlePage ? condenseForFixedPage(content) : content });
    if (!html) logger.warn(`[Ultra] ${input.document} / ${input.name} : page du compositeur refusée${issues?.length ? ` (${issues.slice(0, 3).join(' ; ')})` : ''} → gabarit`);
    return html;
  };
}
