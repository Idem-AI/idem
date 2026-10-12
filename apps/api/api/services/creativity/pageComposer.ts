/**
 * LE COMPOSITEUR DE PAGE — les crans Max et Ultra des documents (charte graphique, business plan,
 * pitch deck).
 *
 * Deux agents distincts : le rédacteur a déjà écrit et fait valider le CONTENU (blocs, chiffres,
 * citations, sources ; et les spécimens posés par le code : nuancier, polices, logos) ; le
 * compositeur n'écrit que la MISE EN PAGE, en HTML, autour de ce contenu.
 *
 * ── DEUX CATÉGORIES DE CONTRÔLE, ET C'EST TOUT L'ENJEU ───────────────────────
 *
 * Ce module confondait « la page est fausse » et « la page est imparfaite » : le moindre constat
 * la renvoyait au gabarit. Mesuré dans les journaux : 26 pages Ultra refusées contre 3 retenues,
 * pour des motifs comme « 658 px au lieu de 631 », « contraste 4,0:1 » ou « le chiffre 01 n'est pas
 * dans le contenu » (un numéro de page) — et des nombres lus dans un bloc `<style>` pris pour des
 * chiffres inventés. Le cran Ultra rendait donc des pages de gabarit, ce qui est exactement le
 * reproche qui lui était fait.
 *
 * Désormais :
 *
 *  BLOQUANT (la page repart au compositeur, puis au gabarit au dernier tour)
 *   - un texte du contenu absent, un chiffre INVENTÉ (un fait, pas un numéro ni une valeur CSS),
 *     une couleur ou une image du contenu non posée, une image étrangère, un `<script>` ;
 *   - un texte hors page, coupé par sa boîte, ou illisible qu'aucune encre de la charte ne sauve.
 *
 *  CONSEIL (la page est gardée, le constat part au compositeur s'il y a un tour suivant)
 *   - les défauts que le CODE répare : hauteur, contraste, corps minimal (`pageInspect.ts`) ;
 *   - les défauts que le KIT absorbe : un décor de trop, un bloc riche de trop, une variante
 *     inconnue — le kit dessine quand même, il n'y a donc rien à refaire ;
 *   - les règles de charte, réparées sur place (`enforceDesignRules`).
 *
 * Et la page RETENUE est la meilleure des tentatives, pas la dernière. Le gabarit ne reprend la
 * main que si aucune tentative n'a produit une page juste.
 */
import logger from '../../config/logger';
import { pageGfx, pageKitManifest } from '../../../../ivision/core/src/visual/poster/kit/page';
import { expandUiMacros, uiManifest, uiTokensOf, type UiDeliverable } from '../../../../ivision/core/src/design/uiKit';
import { inspectOutput } from '../agents/quality-gate';
import { derivedPalette, DocumentDesignSystem } from '../design/documentDesignSystem';
import { describeDocumentSeed, SectionSeed } from '../design/designSeed';
import { condenseForFixedPage, SectionContent } from '../design/sectionContent';
import { PageFormat, renderStandaloneChart } from '../design/sectionRenderer';
import { enforceDesignRules, SlopLintOptions } from '../design/slopLint.service';
import { stripActiveContent } from '../../../../ivision/core/src/render/sanitize-html';
import { AgentCall, AgentTrace, CreativeOrchestrator } from './orchestrator';
import { inspectComposedPage, type PageMeasure } from './pageInspect';

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

/**
 * LE TEXTE QUE LE LECTEUR VERRA — balises, feuilles de style, scripts et SVG retirés.
 *
 * Retirer les seules balises ne suffit pas : le CONTENU d'un bloc `<style>` n'est pas dans une
 * balise, il reste donc dans le texte. Les graisses (400, 700), les interlignes (0,95) et les
 * opacités (0,03) d'une page étaient ainsi lues comme des chiffres inventés, et la page refusée.
 */
const visibleText = (html: string) =>
  (html || '')
    .replace(/<(style|script|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');

/**
 * LES NOMBRES QUI SONT DES FAITS — ceux qu'un lecteur prendra pour une donnée du projet.
 *
 * Un numéro de page (« 01 »), un rang (« 3 »), une année de deux chiffres ne sont pas des faits :
 * les refuser faisait tomber des pages entières pour une pagination. Un fait a trois chiffres ou
 * plus, une décimale, ou une unité (%, devise, multiple) collée à lui.
 */
function factNumbers(text: string): string[] {
  const cleaned = text.replace(/(\d)[\s\u00a0.](?=\d{3}\b)/g, '$1');
  const out = new Set<string>();
  for (const m of cleaned.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|‰|€|\$|FCFA|XAF|XOF|USD|EUR|MAD|k\b|M\b|Md\b|bn\b|×)?/g)) {
    const n = m[1];
    if (n.replace(/\D/g, '').length >= 3 || /[.,]/.test(n) || m[2]) out.add(n);
  }
  return [...out];
}

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

/** Le livrable, tel que le registre des composants le nomme. */
export function uiDeliverableOf(document: string): UiDeliverable {
  const d = document.toLowerCase();
  if (d.includes('deck') || d.includes('slide')) return 'pitch deck';
  if (d.includes('brand') || d.includes('charte') || d.includes('guidelines')) return 'brand guidelines';
  if (d.includes('card') || d.includes('carte')) return 'business card';
  return 'business plan';
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
    `You are the art director of this ${input.document}, and you DESIGN this page — you do not fill a template. Invent its composition: the grid, what dominates, what breathes, where the eye lands first. Two pages of the same document must not be built the same way. Answer with the HTML only, in a single \`\`\`html block.`,
    input.singlePage
      ? `- Root element: <section style="width:${page.width};height:${page.minHeight};padding:${page.padding};position:relative;overflow:hidden;box-sizing:border-box"> … </section>. EVERYTHING must fit in this one page: nothing may be cut at the bottom.`
      : `- Root element: <section style="width:${page.width};min-height:${page.minHeight};padding:${page.padding};position:relative;box-sizing:border-box"> … </section>.`,
    `- Colours: the brand charter — surface ${ds.colors.surface}, raised ${ds.colors.surfaceRaised}, ink ${ds.colors.ink}, muted ${ds.colors.inkMuted}, primary ${ds.colors.primary}, secondary ${ds.colors.secondary}, accent ${ds.colors.accent}, rules ${ds.colors.rule} — plus the hex values given in the content. A TINT or SHADE of one of those (a pale wash of the primary for a band, a deep shade for a footer) is part of the charter too: use them freely. No colour from outside the charter. The page ground stays light (${ds.colors.surface}).`,
    // Le contraste n'est plus une consigne : c'était une double contrainte intenable (« ces hex
    // SEULEMENT » + « 4,5:1 »), et elle coûtait la moitié des pages Ultra. Le code mesure le fond
    // réel de chaque texte et pose l'encre de la charte qui passe. On dit seulement OÙ poser quoi.
    `- Text colours, so it reads: on the light ground use ${ds.colors.ink} (secondary text ${ds.colors.inkMuted}); on a primary, secondary or accent ground use ${ds.colors.onAccent}. Don't put ink on a mid-tone of the same hue. The code measures every text on its real ground and corrects the ink if needed — so commit to your composition rather than playing safe.`,
    `- Fonts: font-family '${ds.fonts.display}' for titles, '${ds.fonts.body}' for text (inline style). The scale (px): ${Object.entries(ds.typeScale).map(([k, v]) => `${k} ${v}`).join(', ')} — go bigger than the scale for a figure or a statement if the page calls for it, never below 10 px for running text.`,
    // ── LES BONNES PRATIQUES SONT DEMANDÉES ICI ─────────────────────────────
    //
    // Au-dessus de Medium, le code ne les arbitre plus après coup : il ne garde qu'un plancher
    // (sécurité, page vide) et répare ce qui a une réponse déterministe. Ce bloc est donc le seul
    // endroit où elles vivent — il est écrit comme un contrat professionnel, pas comme une liste
    // d'interdits, parce que c'est ce qu'un modèle suit le mieux.
    '- THE CONTENT IS THE DELIVERABLE, and a client will read it. Keep EVERY text of the content verbatim and in order of importance. Do not add, remove or invent any fact, number, name, reference or source — not one figure of your own, not even a page number, a date or a percentage: an invented number in a business plan is a professional fault. No lorem ipsum, no placeholder text.',
    '- Every text must READ: at least 4.5:1 against its own ground (3:1 for a title above 24 px), never below 10 px for running text. Nothing may be cut: everything you place has to fit inside the page, and a text set on a mid-tone of its own hue is unreadable even when the hex values look fine.',
    '- Colour swatches, type specimens and logos in the content are the deliverable: show each one, large and exact (hex written as given, font names as given).',
    images.length
      ? `- Images: ONLY these placeholders, each one used once, written exactly as src: <img src="{{IMG_1}}" alt="…"> with object-fit: contain — ${images.map((_, i) => imageToken(i)).join(', ')}. No other image, no CSS background image.`
      : '- No image at all.',
    charts.length
      ? `- Charts: the code draws them, you only give them their place and their size — write the placeholder on its own line inside a block whose width you control: ${charts.map((_, i) => chartToken(i)).join(', ')}. Each one once. NEVER redraw a chart yourself (no bars as divs, no invented values, no <canvas> of your own); the numbers of a chart stay out of the page text.\n${describeCharts(charts).map((line) => `  ${line}`).join('\n')}`
      : '- Metrics: tables as real <table>; no chart on this page.',
    '- The craft, not a recipe: one focal point, a grid you chose and hold, generous whitespace, one accent colour used with intent. Asymmetry, a full-bleed band, an oversized figure, a rule that runs off the page, a column that breaks the grid, a caption set sideways, a number used as architecture — all of it is yours, as long as the page reads in one pass. No decorative emoji, no gradient behind text, no drop shadow on text.',
    '- You are not filling a slot: there is no house layout to match. If two pages of this document could be swapped without anyone noticing, you have not designed either of them.',
    ...uiManifest(uiDeliverableOf(input.document), 'macro'),
    ...pageKitManifest({ page: { width: page.width, height: page.minHeight } }),
    '- No <script>, no web font link.',
  ].join('\n');
  // ── CE QU'ON TRANSMET, ET CE QU'ON NE TRANSMET PLUS ──────────────────────
  //
  // On transmettait à la page SON archétype de gabarit, en lui demandant de ne pas le copier.
  // Une consigne contradictoire ne libère rien : le modèle lisait une description de mise en page
  // et la suivait, ce qui donnait, au cran le plus cher, les mises en page du cran Medium.
  //
  // Ne partent donc que les INVARIANTS du document — ce qui fait que ses pages forment un
  // document (stratégie de couleur, humeur typographique, accent graphique, rythme). La
  // composition de CETTE page est entièrement celle du compositeur.
  const user = [
    input.sheet,
    `WHAT HOLDS THIS DOCUMENT TOGETHER (every page shares these — the composition of THIS page is yours alone):\n${describeDocumentSeed(input.seed)}`,
    `CONTENT (JSON):\n${JSON.stringify(content)}`,
  ].join('\n\n');
  return { system, user };
}

/** Le HTML d'une réponse (bloc ```html, ou la réponse entière si elle commence par <section>). */
export function extractComposedHtml(raw: string): string | undefined {
  const html = ((raw || '').match(/```(?:html)?\s*\n([\s\S]*?)```/i)?.[1] || (/^\s*<section\b/i.test(raw || '') ? raw : '')).trim();
  return html || undefined;
}

/**
 * LES CATÉGORIES DE CONSTAT — c'est le CRAN qui décide lesquelles gardent la main.
 *
 *   security   ce qui ne doit jamais partir à l'impression ni au navigateur : un script, une
 *              ressource extérieure. Jamais négociable, à aucun cran.
 *   substance  la page n'est pas une page : rien n'a été rendu, ou le contenu a été ignoré.
 *   figures    un CHIFFRE qui n'est pas dans le contenu. La seule faute de fidélité qui bloque à
 *              tous les crans : un plan qui pose un chiffre absent du contenu, ou un visuel qui
 *              annonce « -40 % » quand la promotion est à -30 %, est une faute professionnelle que
 *              le client voit — pas un écart de goût. (Les numéros de page et les valeurs de
 *              feuille de style n'en sont pas, cf. `factNumbers`.)
 *   fidelity   un texte ou une image du contenu ne s'y retrouve pas.
 *   charter    une couleur du contenu n'est pas posée.
 *   form       la grille qualité (troncature, marqueur de gabarit, bavardage).
 */
export type CheckKind = 'security' | 'substance' | 'figures' | 'fidelity' | 'charter' | 'form';

export interface Finding {
  kind: CheckKind;
  /** Formulé pour être corrigé par le compositeur, jamais seulement constaté. */
  message: string;
}

/**
 * CE QUE LE CRAN VÉRIFIE ENCORE.
 *
 *   full   le contrôle complet. Les crans Low et Medium ne font pas écrire de page à l'IA : ce
 *          mode sert le script de contrôle et toute reprise qui voudrait le contrôle d'origine.
 *   floor  le PLANCHER, au-dessus de Medium : la sécurité et le vide. Tout le reste est un
 *          conseil — la page de l'IA est livrée.
 *
 * Pourquoi : un contrôle statique qui refuse une page la renvoie au gabarit, donc le cran payé le
 * plus cher rend ce que rend le cran Medium. Et un contrôle de chaîne se trompe — un numéro de
 * page pris pour un chiffre inventé, une phrase coupée par une incise prise pour une phrase
 * absente, le mot « placeholder » dans un nom de classe pris pour un gabarit non rempli. Mesuré
 * dans les journaux : 26 pages Ultra refusées contre 3 retenues. Au-dessus de Medium, les bonnes
 * pratiques sont donc DEMANDÉES À L'ÉCRITURE (le prompt les porte) et non arbitrées après coup.
 */
export type CheckMode = 'full' | 'floor';

const BLOCKS: Record<CheckMode, readonly CheckKind[]> = {
  full: ['security', 'substance', 'figures', 'fidelity', 'charter', 'form'],
  floor: ['security', 'substance', 'figures'],
};

/** Ce que le contrôle de chaîne rend : des constats étiquetés, dans l'ordre où ils sont trouvés. */
export interface FidelityReport {
  findings: Finding[];
  /** Ce qui condamne la page à ce cran. */
  blocking: string[];
  /** Ce qui ne fait que l'améliorer : transmis au compositeur, sans lui coûter sa page. */
  advisory: string[];
}

/**
 * Les défauts de forme et de FIDÉLITÉ d'une page composée. Chacun est formulé pour être corrigé
 * par le compositeur au tour suivant, jamais seulement constaté.
 */
export function fidelityCheck(html: string, content: SectionContent, mode: CheckMode = 'full'): FidelityReport {
  const findings: Finding[] = [];
  const add = (kind: CheckKind, message: string) => findings.push({ kind, message });

  if (/<script\b/i.test(html)) add('security', 'remove every <script>');
  const charts = chartsOf(content);
  // Les repères de graphique : le code les remplace, et NETTOIE ce qui reste (un repère oublié
  // s'imprimerait en clair). Un graphique mal posé est donc réparé, plus jamais refusé.
  let probe = html;
  charts.forEach((_, i) => {
    const count = html.split(chartToken(i)).length - 1;
    if (count !== 1) add('form', `place ${chartToken(i)} exactly once (found ${count}): the code draws the chart, you only give it its place`);
    probe = probe.split(chartToken(i)).join('<div data-chart-slot="1"></div>');
  });
  if (charts.length && /<canvas\b/i.test(html)) add('form', 'a chart is placed with its {{CHART_n}} placeholder, never drawn by hand');
  html = probe;
  // La grille qualité, en deux lectures. La FORME se juge sur le balisage (troncature, conteneurs
  // déséquilibrés) ; les MARQUEURS de gabarit se jugent sur le texte visible seulement : le mot
  // « placeholder » dans un commentaire ou un nom de classe n'est pas un gabarit non rempli, et il
  // faisait refuser des pages entières — alors que le compositeur reçoit justement des repères
  // `{{IMG_n}}` dans sa consigne.
  const form = inspectOutput(html, { format: 'html', minChars: 300, forbidPlaceholders: false });
  // Une page sous 300 signes de balisage n'est pas une page : c'est du vide, à tous les crans.
  if (form.blocking.some((i) => i.code === 'too_short' || i.code === 'empty')) add('substance', 'the page is almost empty: compose the whole page around the content');
  else if (form.blocking.length) add('form', `form: ${form.summary}`);
  const visible = visibleText(html).replace(/\s+/g, ' ').trim();
  if (visible) {
    const words = inspectOutput(visible, { format: 'text', minChars: 0 });
    if (words.blocking.length) add('form', `form: ${words.summary}`);
  }
  const page = norm(html);
  // Les textes que le CODE dessine (ceux des graphiques) ne sont pas réclamés au compositeur.
  const drawnByCode = new Set(strings({ blocks: charts } as unknown as SectionContent).map((s) => s.trim()));
  const texts = contentTexts(content).filter((t) => !drawnByCode.has(t.trim()));
  const missing = texts.filter((t) => !page.includes(norm(t).slice(0, 24)));
  if (texts.length && missing.length / texts.length > 0.85) {
    // Le contenu a été ignoré : la page est vide de ce qu'elle devait porter.
    add('substance', `the content was ignored: write the texts of the content, verbatim — starting with ${missing.slice(0, 2).map((t) => `"${t.slice(0, 70)}"`).join(' · ')}`);
  } else if (texts.length && missing.length / texts.length > 0.15) {
    add('fidelity', `these texts of the content are missing — write them verbatim: ${missing.slice(0, 4).map((t) => `"${t.slice(0, 70)}"`).join(' · ')}`);
  } else if (missing.length) {
    add('fidelity', `${missing.length} text(s) of the content did not make it onto the page`);
  }
  const own = strings(content).filter((s) => !URL_RE.test(s.trim())).join(' ');
  const known = new Set([...numbersOf(own), ...factNumbers(own)]);
  const invented = [...new Set(factNumbers(visibleText(html)).filter((n) => !known.has(n)))];
  if (invented.length) add('figures', `remove these numbers, they are not in the content (write no figure of your own): ${invented.slice(0, 8).join(', ')}`);
  const lower = html.toLowerCase();
  const hexes = [...new Set(strings(content).flatMap((s) => s.match(HEX_RE) || []).map((h) => h.toLowerCase()))];
  const absent = hexes.filter((h) => !lower.includes(h) && !lower.includes(shortHex(h)));
  if (absent.length) add('charter', `show these colours of the content (written as given): ${absent.join(', ')}`);
  const images = imagesOf(content);
  const lost = images.filter((u) => !html.includes(u));
  if (lost.length) add('fidelity', `place every image of the content (${lost.length} missing): use each placeholder once as <img src>`);
  const called = [...html.matchAll(/(?:src\s*=\s*["']|url\(\s*["']?)((?:https?:|data:)[^"')\s]+)/gi)].map((m) => m[1]);
  // Une ressource extérieure ne s'imprime pas (le rendu coupe le réseau) et fuite la page.
  if (called.some((u) => !images.includes(u) && /^https?:/i.test(u))) add('security', 'use no image other than the placeholders of the content (no external URL)');
  else if (called.some((u) => !images.includes(u))) add('fidelity', 'use no image other than the placeholders of the content');

  const blocks = BLOCKS[mode];
  return {
    findings,
    blocking: findings.filter((f) => blocks.includes(f.kind)).map((f) => f.message),
    advisory: findings.filter((f) => !blocks.includes(f.kind)).map((f) => f.message),
  };
}

/** `#aabbcc` → `#abc` quand les deux s'écrivent (une page peut avoir écrit la forme courte). */
const shortHex = (hex: string) => (/^#(.)\1(.)\2(.)\3$/i.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex);

/** Les seuls défauts qui condamnent la page (contrôle complet). */
export const fidelityIssues = (html: string, content: SectionContent): string[] => fidelityCheck(html, content).blocking;

/** Le HTML d'une réponse, s'il passe forme et fidélité ; sinon undefined. */
export function acceptComposedPage(raw: string, content: SectionContent): string | undefined {
  const html = extractComposedHtml(raw);
  return html && !fidelityCheck(html, content).blocking.length ? html : undefined;
}

/**
 * Les repères que le code n'a pas pu remplacer : retirés, pour qu'un `{{CHART_2}}` ou un
 * `{{IMG_3}}` oublié ne s'imprime jamais en clair. Et le `<canvas>` que le modèle aurait dessiné
 * lui-même : retiré aussi (il reste vide à l'impression), le nôtre porte `data-idem-chart`.
 */
export function cleanComposedLeftovers(html: string): string {
  return (html || '')
    .replace(/\{\{(?:IMG|CHART)_\d+\}\}/g, '')
    .replace(/<canvas\b(?![^>]*data-idem-chart)[^>]*>[\s\S]*?<\/canvas\s*>/gi, '');
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
  /** Mesure et réparation ; par défaut, le rendu Chromium au format de la page. */
  inspect?: (html: string) => Promise<PageMeasure>;
  /** Essais accordés (Max : 2, Ultra : 3). Un seul essai reste un essai. */
  attempts?: number;
  /**
   * Ce que le contrôle de chaîne garde la main de faire refuser (`floor` au-dessus de Medium).
   * Au-dessus de Medium, les bonnes pratiques sont demandées À L'ÉCRITURE, pas arbitrées après.
   */
  checks?: CheckMode;
  /**
   * La mesure RÉPARE et ne refuse plus (cran Ultra) : la page de l'IA est livrée, corrigée de ce
   * qui a une réponse déterministe, jamais remplacée par un gabarit pour un écart de mesure.
   */
  repairOnly?: boolean;
}): Promise<{ html: string | null; traces: AgentTrace[]; issues?: string[] }> {
  const orchestrator = new CreativeOrchestrator({ level: 'ultra', call: input.call });
  const ds = input.ds;
  const inspect =
    input.inspect ??
    ((html: string) =>
      inspectComposedPage(html, {
        page: input.page,
        singlePage: !!input.singlePage,
        fonts: { display: ds.fonts.display, body: ds.fonts.body },
        label: input.name,
        // Les encres que le code a le droit de poser pour sauver un contraste : celles de la charte.
        inks: [ds.colors.ink, ds.colors.inkMuted, ds.colors.onAccent, ds.colors.surface, ds.colors.surfaceRaised],
        repairOnly: !!input.repairOnly,
      }));
  const base = buildComposerPrompt(input);
  const images = imagesOf(input.content);
  const charts = chartsOf(input.content);
  // Le kit graphique de cette page : ses couleurs sont celles du document, ses cotes celles de la
  // page (millimètres à l'impression).
  const gfx = pageGfx({
    width: input.page.width,
    height: input.page.minHeight,
    tokens: { primary: ds.colors.primary, secondary: ds.colors.secondary, accent: ds.colors.accent, ink: ds.colors.ink, muted: ds.colors.inkMuted, surface: ds.colors.surface, raised: ds.colors.surfaceRaised, rule: ds.colors.rule },
    surface: ds.colors.surface,
    ink: ds.colors.ink,
    primary: ds.colors.primary,
    secondary: ds.colors.secondary,
  });
  const rounds = Math.max(1, Math.min(5, input.attempts ?? 3));
  const mode: CheckMode = input.checks ?? 'floor';
  /** Ce qu'il reste à corriger pour que la page soit JUSTE, et ce qui ne ferait que l'améliorer. */
  let issues: string[] = [];
  let advice: string[] = [];
  let previous: string | null = null;
  /** La meilleure page JUSTE rencontrée : on la garde, même si un tour suivant échoue. */
  let best: { html: string; advice: number } | null = null;
  /**
   * Un tour de PERFECTIONNEMENT d'une page déjà juste n'est accordé qu'au cran Ultra : c'est ce
   * qui le distingue du cran Max, lequel s'arrête dès qu'il a une page juste (deux essais au
   * total). Sans cela, les deux crans coûteraient la même chose pour le même résultat.
   */
  let polished = rounds < 3;

  for (let attempt = 0; attempt < rounds; attempt++) {
    const repair: boolean = attempt > 0 && !!previous;
    const res: { value: string | null } = await orchestrator.run<string | null>({
      role: 'pageComposer',
      key: `pageComposer:${input.name}${attempt ? `:r${attempt}` : ''}`,
      minLevel: 'ultra',
      profile: 'coder',
      prompt: (): { system: string; user: string } =>
        repair
          ? {
              system: base.system,
              user: [
                base.user,
                issues.length
                  ? `YOUR PREVIOUS PAGE WAS MEASURED. These MUST be fixed — answer with the whole corrected page in a single \`\`\`html block:\n- ${issues.join('\n- ')}`
                  : 'YOUR PREVIOUS PAGE WAS MEASURED AND IT HOLDS. Push it further: make the composition more its own, more confident — same content, no new fact.',
                advice.length ? `Worth improving while you are there (the code already handled them, they will not cost you the page):\n- ${advice.join('\n- ')}` : '',
                `PREVIOUS PAGE:\n\`\`\`html\n${previous}\n\`\`\``,
              ]
                .filter(Boolean)
                .join('\n\n'),
            }
          : base,
      parse: (raw) => extractComposedHtml(raw),
      fallback: () => null,
    });
    if (!res.value) {
      issues = ['no HTML was returned: answer with the whole page in a single ```html block'];
      advice = [];
      continue;
    }
    const composed = cleanComposedLeftovers(restoreImages(res.value, images));
    previous = res.value;
    const fidelity = fidelityCheck(composed, input.content, mode);
    if (fidelity.blocking.length) {
      issues = fidelity.blocking;
      advice = fidelity.advisory;
      continue;
    }
    // ── LA CHARTE N'EST PLUS RÉÉCRITE AU-DESSUS DE MEDIUM ──────────────────
    //
    // `enforceDesignRules` réécrit la page : il ramène toute couleur hors palette à la couleur de
    // charte la plus proche, aligne les rayons, retire les ombres, neutralise les capitales
    // tracées après la première. Sur une page composée par un directeur artistique, c'est ce qui
    // annulait son travail — et ce qui faisait que toutes les pages finissaient par se ressembler.
    // Au-dessus de Medium, il ne reste que la SÉCURITÉ : ce qui exécuterait du code au rendu.
    const linted =
      mode === 'floor'
        ? stripActiveContent(composed)
        : enforceDesignRules(composed, { allowDerivedTints: true, ...input.lint, label: input.lint?.label ?? `ultra/${input.name}` }).html || composed;
    // Le décor du kit est dessiné APRÈS la relecture des règles : ses dégradés tonals sont des
    // mélanges des couleurs du document, et seraient pris pour des couleurs hors charte. Ce qui
    // est mesuré ensuite, et imprimé, est bien la page avec ses formes.
    //
    // LE KIT NE CONDAMNE PLUS UNE PAGE. Il dessine ce qu'il sait dessiner et signale le reste
    // (un décor de trop, une variante inconnue, une donnée absente) : refuser la page pour cela
    // revenait à la renvoyer au gabarit alors que le kit l'avait déjà rendue correctement.
    const rich = expandUiMacros(linted, uiTokensOf(input.ds as never), { max: 3 });
    const drawn = gfx.expand(rich.html);
    // Les graphiques du contenu, dessinés par le code à la place du repère.
    const assembled = restoreCharts(drawn.html, charts, (block) => renderStandaloneChart(block, input.ds, input.seed, { page: input.page, multiPage: !input.singlePage }));
    const measure = await inspect(assembled);
    issues = measure.issues;
    advice = [...fidelity.advisory, ...rich.issues, ...drawn.issues, ...measure.advisories];
    if (!issues.length) {
      // La page est juste : on la garde.
      if (!best || advice.length < best.advice) best = { html: measure.html, advice: advice.length };
      if (!advice.length) break;
    }
    // Une page juste a droit à UN tour de perfectionnement, pas à tout le budget du cran : au-delà,
    // on paierait du surplace, et la page retenue serait de toute façon la meilleure des deux.
    if (best && polished) break;
    if (best) polished = true;
  }
  if (best) return { html: best.html, traces: orchestrator.traces, issues: [] };
  return { html: null, traces: orchestrator.traces, issues };
}

/**
 * Le crochet `SectionTemplate.compose` d'une page aux crans Max et Ultra
 * (common/generic.service.ts) : le contenu validé de la page part au compositeur, condensé comme
 * le gabarit le condenserait sur une page à hauteur fixe ; `null` (aucune tentative juste) et le
 * gabarit dirigé rend la page.
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
  /** Essais accordés par le cran de la jauge (`documentDesign.ts#delegationOf`). */
  attempts?: number;
  /** Contrôle de chaîne gardé à ce cran (`floor` au-dessus de Medium). */
  checks?: CheckMode;
  /** La mesure répare sans jamais refuser (cran Ultra). */
  repairOnly?: boolean;
}): (content: SectionContent) => Promise<string | null> {
  return async (content) => {
    const { ds } = input;
    // Les règles du design system du document : sa palette, ses rampes dérivées, ses polices.
    const lint: SlopLintOptions = {
      palette: { primary: ds.colors.primary, secondary: ds.colors.secondary, accent: ds.colors.accent, background: ds.colors.surface, text: ds.colors.ink },
      extraAllowedColors: derivedPalette(ds),
      fonts: [ds.fonts.display, ds.fonts.body].filter(Boolean),
      allowDerivedTints: true,
      ...input.lint,
    };
    const { html, issues } = await composePageHtml({ ...input, lint, content: input.singlePage ? condenseForFixedPage(content) : content });
    if (html) logger.info(`[Compositeur] ${input.document} / ${input.name} : page composée par l'IA (${input.attempts ?? 3} essai(s), contrôle ${input.checks ?? 'floor'}${input.repairOnly ? ', mesure sans refus' : ''})`);
    else logger.warn(`[Compositeur] ${input.document} / ${input.name} : aucune tentative livrable${issues?.length ? ` (${issues.slice(0, 3).join(' ; ')})` : ''} → gabarit dirigé`);
    return html;
  };
}
