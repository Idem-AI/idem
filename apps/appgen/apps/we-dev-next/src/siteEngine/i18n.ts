/**
 * LES LANGUES D'UN SITE, POSÉES PAR LE CODE — chaque site du moteur sort prêt à être traduit, qu'il ait une langue
 * ou cinq (le système du template : `src/i18n`, voir son en-tête).
 *
 * Les auteurs écrivent leurs textes en clair, dans la langue du site, comme avant : aucune clé à inventer, aucune
 * consigne de plus à suivre. Après eux, le code :
 *
 *   1. enveloppe chaque texte affiché (texte JSX, `alt`, `placeholder`, `aria-label`, textes des listes de contenu)
 *      dans `t("…")`, et chaque lien interne dans `localePath(…)` — `localizeCode`, sans modèle, vérifié par une
 *      relecture de l'arbre syntaxique (un fichier qui ne se relit plus garde son code d'origine) ;
 *   2. relève tous les textes du site (`collectMessages`) : c'est le catalogue de la langue principale ;
 *   3. confie à l'agent traducteur ce qui manque dans chaque autre langue (`translateCatalog`), par lots, en JSON :
 *      texte d'origine → traduction, noms propres, marques, prix et coordonnées inchangés ;
 *   4. écrit `src/i18n/config.json`, `src/i18n/messages/<langue>.json` et `src/i18n/messages.ts`.
 *
 * Le site d'une seule langue a déjà ses `t()` : demander l'anglais plus tard ne réécrit aucune section, seulement
 * les catalogues (`/translate`).
 */

import ts from 'typescript';
import { ChatLogger } from '../utils/logger.js';
import type { ModelCaller, Verdict } from './modelCaller.js';

/** Les attributs JSX dont la valeur se lit à l'écran (ou à voix haute). */
const TEXT_ATTRIBUTES = new Set(['alt', 'title', 'placeholder', 'aria-label', 'aria-description', 'label', 'description', 'caption']);

/** Les clés d'objet qui ne portent jamais un texte à traduire. */
const CODE_KEYS = /^(?:className|class|classes|href|to|src|srcSet|image|img|photo|avatar|logo|video|poster|media|mediaKey|asset|icon|iconName|id|key|slug|path|url|link|type|variant|size|as|target|rel|color|tone|theme|layout|aspect|align|position|side|ease|transition|initial|animate|exit|whileInView|viewport|style|format|locale|lang|currency|phone|email|tel|value|name)$/;

/** Les appels dont les arguments sont du code (classes, variantes) ou déjà traduits. */
const CODE_CALLS = new Set(['cn', 'clsx', 'cva', 'twMerge', 't', 'translate', 'localePath', 'require', 'useState', 'useRef', 'Symbol', 'querySelector', 'getElementById', 'addEventListener', 'removeEventListener', 'matchMedia', 'Intl', 'Date', 'RegExp', 'fetch', 'console']);

/** Un texte écrit pour être lu : des lettres, et une phrase, un mot en capitale ou un accent — jamais une liste de classes, un lien, un identifiant. */
export function isProse(text: string): boolean {
  const value = text.trim();
  if (!value || !/\p{L}/u.test(value)) return false;
  if (/^(?:https?:|mailto:|tel:|data:|\/|#|\.{1,2}\/|@|www\.)/i.test(value)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(value)) return false;
  const tokens = value.split(/\s+/);
  // Une liste de classes Tailwind (`flex items-center md:gap-4`) : minuscules, et des tirets ou deux-points.
  if (tokens.every((token) => /^[!-]?[a-z0-9:\-/[\].%#()_]+$/.test(token)) && tokens.some((token) => /[-:[]/.test(token))) return false;
  if (tokens.length === 1) {
    // Un mot seul : un nom d'icône (`ArrowRight`), un identifiant (`easeOut`, `primary`) n'est pas du texte.
    if (/^[a-z][a-zA-Z0-9_]*$/.test(value) || /^[A-Z][a-z0-9]+[A-Z]/.test(value) || /^[A-Z0-9_]+$/.test(value) && value.length < 4) return false;
  }
  return true;
}

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;|&rsquo;/g, (m) => (m === '&rsquo;' ? '’' : "'"))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const call = (fn: string, text: string) => `${fn}(${JSON.stringify(text)})`;

/** Un attribut JSX dont la valeur s'affiche : les attributs de texte, et les props d'un composant qui ne sont pas du code. */
const textAttribute = (name: string) => TEXT_ATTRIBUTES.has(name) || (!CODE_KEYS.test(name) && !/^(?:data-|aria-|on[A-Z]|class)/.test(name));

/** Un nom lié dans le fichier (paramètre, variable, fonction) : `t` déjà pris impose un autre nom à l'import. */
function bindsName(source: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === name) {
      found = true;
      return;
    }
    if (ts.isImportSpecifier(node) && node.name.text === name && node.parent.parent.parent.moduleSpecifier.getText(source).indexOf('@/i18n') < 0) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function propertyName(node: ts.PropertyName): string {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : '';
}

function insideCodeCall(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      if (CODE_CALLS.has(name)) return true;
      const root = ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? callee.expression.text : '';
      if (CODE_CALLS.has(root)) return true;
    }
    if (ts.isJsxAttribute(parent)) return !textAttribute(parent.name.getText());
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isTypeNode(parent)) return true;
    if (ts.isBlock(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

/** Un littéral placé là où une valeur de contenu s'écrit (et pas une comparaison, un `case`, une clé). */
function contentPosition(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isPropertyAssignment(parent)) return parent.initializer === node && !CODE_KEYS.test(propertyName(parent.name));
  if (ts.isArrayLiteralExpression(parent)) {
    // Une liste rangée sous une clé de code (`classes: ['…']`) n'est pas du contenu.
    const owner = parent.parent;
    return !(ts.isPropertyAssignment(owner) && CODE_KEYS.test(propertyName(owner.name)));
  }
  if (ts.isJsxExpression(parent)) return !ts.isJsxAttribute(parent.parent);
  if (ts.isConditionalExpression(parent)) return (parent.whenTrue === node || parent.whenFalse === node) && contentPosition(parent);
  if (ts.isBinaryExpression(parent)) {
    const op = parent.operatorToken.kind;
    return parent.right === node && (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) && contentPosition(parent);
  }
  if (ts.isVariableDeclaration(parent)) {
    const name = ts.isIdentifier(parent.name) ? parent.name.text : '';
    return parent.initializer === node && !CODE_KEYS.test(name) && !/class|style|variant|href|src|url|id$/i.test(name);
  }
  if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)) return contentPosition(parent);
  if (ts.isReturnStatement(parent)) return true;
  return false;
}

export interface LocalizeResult {
  code: string;
  /** Les textes enveloppés (catalogue de ce fichier). */
  texts: string[];
  changed: boolean;
}

/**
 * Enveloppe les textes et les liens internes d'un composant. Idempotent : un texte déjà dans `t()` ne bouge pas.
 * Un code que le parseur ne relit plus après coup est rendu tel qu'il était.
 */
export function localizeCode(code: string, path = 'Component.tsx'): LocalizeResult {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: { start: number; end: number; text: string }[] = [];
  const texts: string[] = [];
  let needsT = false;
  let needsLocalePath = false;
  // `t` est souvent un paramètre (`testimonials.map((t) => …)`) : l'import prend alors un autre nom.
  const tName = bindsName(source, 't') ? 'translate' : 't';

  /** Le texte d'un enfant JSX tel que React l'affiche : les lignes blanches tombent, les espaces d'une ligne restent. */
  const jsxText = (raw: string) => decodeEntities(raw).replace(/^\s*\n\s*/, '').replace(/\s*\n\s*$/, '').replace(/\s*\n\s*/g, ' ');

  const visit = (node: ts.Node) => {
    // Une phrase coupée par des valeurs (`Bienvenue chez {site.name}, depuis {year}.`) : une seule phrase à traduire,
    // `t("Bienvenue chez {name}, depuis {year}.", { name: site.name, year })`, jamais deux fragments.
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children.filter((child) => !(ts.isJsxText(child) && !child.getFullText(source).trim() && child.getFullText(source).includes('\n')));
      const simple = (child: ts.JsxChild) =>
        ts.isJsxText(child) || (ts.isJsxExpression(child) && !!child.expression && (ts.isIdentifier(child.expression) || ts.isPropertyAccessExpression(child.expression)));
      const lettered = children.filter((child) => ts.isJsxText(child) && /\p{L}/u.test(child.getFullText(source)));
      if (children.length > 1 && children.every(simple) && lettered.length && children.some((child) => ts.isJsxExpression(child))) {
        const values: [string, string][] = [];
        let sentence = '';
        for (const child of node.children) {
          if (ts.isJsxText(child)) sentence += jsxText(child.getFullText(source));
          else if (ts.isJsxExpression(child) && child.expression) {
            const expression = child.expression.getText(source);
            const base = (ts.isPropertyAccessExpression(child.expression) ? child.expression.name.text : expression).replace(/\W/g, '') || 'value';
            const existing = values.find(([, value]) => value === expression);
            const name = existing ? existing[0] : values.some(([key]) => key === base) ? `${base}${values.length + 1}` : base;
            if (!existing) values.push([name, expression]);
            sentence += `{${name}}`;
          }
        }
        sentence = sentence.trim();
        const first = node.children[0];
        const last = node.children[node.children.length - 1];
        const lead = first.getFullText(source).match(/^\s*/)![0];
        const trail = last.getFullText(source).match(/\s*$/)![0];
        const args = values.map(([key, value]) => (key === value ? key : `${key}: ${value}`)).join(', ');
        edits.push({
          start: first.getFullStart(),
          end: last.getEnd(),
          text: `${lead.includes('\n') ? lead : ''}{${tName}(${JSON.stringify(sentence)}, { ${args} })}${trail.includes('\n') ? trail : ''}`,
        });
        texts.push(sentence);
        needsT = true;
        // Les attributs de l'élément restent à traiter (un `href`, un `aria-label`).
        if (ts.isJsxElement(node)) visit(node.openingElement);
        return;
      }
    }

    if (ts.isJsxText(node)) {
      const raw = node.getFullText(source);
      const value = decodeEntities(raw).replace(/\s+/g, ' ').trim();
      // Tout texte JSX s'affiche : il suffit qu'il ait une lettre.
      if (/\p{L}/u.test(value)) {
        // Un espace collé à une expression voisine (`Bonjour {nom}`) compte en JSX : il devient `{' '}`. Un retour à
        // la ligne, non : il reste tel quel.
        const space = (edge: string) => (edge.includes('\n') ? edge : edge ? "{' '}" : '');
        edits.push({ start: node.getFullStart(), end: node.getEnd(), text: `${space(raw.match(/^\s*/)![0])}{${call(tName, value)}}${space(raw.match(/\s*$/)![0])}` });
        texts.push(value);
        needsT = true;
      }
      return;
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source);
      const init = node.initializer;
      if (name === 'href') {
        const expression = ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : undefined;
        if (!expression) return;
        if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === 'localePath') return;
        if (ts.isStringLiteral(expression) && !/^\/(?!\/)/.test(expression.text)) return;
        edits.push({ start: init.getStart(source), end: init.getEnd(), text: `{localePath(${expression.getText(source)})}` });
        needsLocalePath = true;
        return;
      }
      if (textAttribute(name) && ts.isStringLiteral(init) && isProse(init.text)) {
        edits.push({ start: init.getStart(source), end: init.getEnd(), text: `{${call(tName, init.text)}}` });
        texts.push(init.text);
        needsT = true;
        return;
      }
    }

    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isJsxAttribute(node.parent)) {
      if (isProse(node.text) && contentPosition(node) && !insideCodeCall(node)) {
        edits.push({ start: node.getStart(source), end: node.getEnd(), text: call(tName, node.text) });
        texts.push(node.text);
        needsT = true;
      }
      return;
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!edits.length) return { code, texts: [], changed: false };

  let out = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);

  // L'import, fusionné avec un import existant de `@/i18n` s'il y en a un.
  const wanted = [needsT ? (tName === 't' ? 't' : 't as translate') : '', needsLocalePath ? 'localePath' : ''].filter(Boolean);
  const existing = out.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/i18n(?:\/index)?(?:\.ts)?['"];?/);
  if (existing) {
    const names = new Set(existing[1].split(',').map((name) => name.trim()).filter(Boolean));
    wanted.forEach((name) => names.add(name));
    out = out.replace(existing[0], `import { ${[...names].join(', ')} } from '@/i18n';`);
  } else {
    const imports = [...out.matchAll(/^import[^;]*;[ \t]*$/gm)];
    const at = imports.length ? imports[imports.length - 1].index! + imports[imports.length - 1][0].length : 0;
    out = `${out.slice(0, at)}${at ? '\n' : ''}import { ${wanted.join(', ')} } from '@/i18n';${at ? '' : '\n'}${out.slice(at)}`;
  }

  // La relecture : le moindre doute, et le fichier garde son code d'origine.
  const check = ts.createSourceFile(path, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] };
  if (check.parseDiagnostics?.length) {
    ChatLogger.warn('SITE_I18N', `${path} : textes laissés en clair (relecture impossible)`, { error: ts.flattenDiagnosticMessageText(check.parseDiagnostics[0].messageText, '\n') });
    return { code, texts: [], changed: false };
  }
  return { code: out, texts, changed: true };
}

/** Tous les textes `t("…")` d'un ensemble de fichiers : le catalogue de la langue principale. */
export function collectMessages(files: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(path) || path.startsWith('src/i18n/')) continue;
    for (const match of code.matchAll(/\b(?:t|translate)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
      try {
        found.add(match[1].startsWith('"') ? JSON.parse(match[1]) : JSON.parse(`"${match[1].slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`));
      } catch {
        /* littéral illisible : ignoré */
      }
    }
  }
  return [...found];
}

/** Les textes des faits (`@/site/data`) qui s'affichent : traduits eux aussi, lus à travers `localize()`. */
export function dataMessages(data: unknown): string[] {
  const out = new Set<string>();
  const walk = (value: unknown, key = '') => {
    if (typeof value === 'string') {
      if (!CODE_KEYS.test(key) && key !== 'language' && isProse(value)) out.add(value);
    } else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(data);
  return [...out];
}

export const LANGUAGE_LABELS: Record<string, [string, string]> = {
  fr: ['français', 'French'],
  en: ['anglais', 'English'],
  es: ['espagnol', 'Spanish'],
  pt: ['portugais', 'Portuguese'],
  de: ['allemand', 'German'],
  it: ['italien', 'Italian'],
  nl: ['néerlandais', 'Dutch'],
  ar: ['arabe', 'Arabic'],
  sw: ['swahili', 'Swahili'],
  zh: ['chinois', 'Chinese'],
  ru: ['russe', 'Russian'],
  tr: ['turc', 'Turkish'],
  wo: ['wolof', 'Wolof'],
  ln: ['lingala', 'Lingala'],
  ha: ['haoussa', 'Hausa'],
  yo: ['yoruba', 'Yoruba'],
  am: ['amharique', 'Amharic'],
};

export const languageLabel = (code: string, fr: boolean) => LANGUAGE_LABELS[code]?.[fr ? 0 : 1] ?? code;

const BATCH = 60;

/**
 * Traduit ce qui manque d'un catalogue dans une langue, par lots de soixante textes, en parallèle. Un lot refusé
 * deux fois est laissé à l'original (le site s'affiche quand même, dans la langue principale pour ces textes).
 */
export async function translateCatalog(options: {
  caller: ModelCaller;
  texts: string[];
  from: string;
  to: string;
  existing?: Record<string, string>;
  siteName: string;
  /** Le secteur et la cible, pour le ton. */
  context: string;
  /** Les textes de la version existante dans cette langue (ancien site) : la terminologie à reprendre. */
  reference?: string;
}): Promise<Record<string, string>> {
  const existing = options.existing ?? {};
  const missing = options.texts.filter((text) => !existing[text]);
  const result: Record<string, string> = { ...existing };
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));

  const system = `Tu es traducteur professionnel de sites web, du ${languageLabel(options.from, true)} vers le ${languageLabel(options.to, true)}.
Tu traduis pour des clients réels : une langue naturelle, idiomatique, au ton du site, jamais mot à mot.
Règles strictes :
- Garde à l'identique les noms propres, le nom du site (« ${options.siteName} »), les marques, les prix, les nombres, les numéros, les e-mails et les adresses web.
- Garde les variables entre accolades ({nom}) telles quelles.
- Longueur comparable à l'original (un bouton reste court, un titre reste un titre).
- Ne traduis rien qui n'est pas dans la liste, n'ajoute rien.
Réponds UNIQUEMENT avec un objet JSON : { "translations": ["…", "…"] } — une traduction par texte, dans le même ordre, autant d'éléments que de textes.`;

  await Promise.all(
    batches.map(async (batch, index) => {
      const prompt = `Contexte du site : ${options.context}
${options.reference ? `\nTerminologie déjà employée par ce site en ${languageLabel(options.to, true)} (à reprendre quand elle correspond) :\n${options.reference.slice(0, 3000)}\n` : ''}
Textes à traduire (${batch.length}) :
${JSON.stringify(batch, null, 0)}`;
      const judge = (raw: unknown): Verdict<string[]> => {
        const list = (raw as { translations?: unknown })?.translations;
        if (!Array.isArray(list) || list.length !== batch.length || list.some((item) => typeof item !== 'string' || !item.trim()))
          return { problem: `Il faut exactement ${batch.length} traductions, chacune un texte non vide, dans l'ordre.` };
        return { value: list as string[] };
      };
      const outcome = await options.caller.json(`i18n-${options.to}-${index + 1}`, system, prompt, judge, Math.min(8000, 400 + batch.join(' ').length * 2));
      if (!outcome.value) {
        ChatLogger.warn('SITE_I18N', `lot ${index + 1} (${options.to}) non traduit`, { texts: batch.length });
        return;
      }
      batch.forEach((text, i) => (result[text] = outcome.value![i].trim()));
    })
  );
  return result;
}

/** Les fichiers de langues d'un site. */
export function renderI18nFiles(defaultLanguage: string, catalogs: Record<string, Record<string, string>>): Record<string, string> {
  const others = Object.keys(catalogs).filter((lang) => lang !== defaultLanguage);
  const files: Record<string, string> = {
    'src/i18n/config.json': `${JSON.stringify({ defaultLanguage, languages: [defaultLanguage, ...others] }, null, 2)}\n`,
  };
  for (const lang of others) {
    const sorted = Object.fromEntries(Object.entries(catalogs[lang]).sort(([a], [b]) => a.localeCompare(b)));
    files[`src/i18n/messages/${lang}.json`] = `${JSON.stringify(sorted, null, 2)}\n`;
  }
  const ident = (lang: string) => `m_${lang.replace(/\W/g, '_')}`;
  files['src/i18n/messages.ts'] = `/**
 * Les traductions du site, une par langue (\`messages/<langue>.json\` : texte d'origine → traduction). Posé par IDEM :
 * ajouter une langue se demande dans la conversation, le fichier est réécrit.
 */
${others.map((lang) => `import ${ident(lang)} from './messages/${lang}.json';`).join('\n')}${others.length ? '\n\n' : ''}export const messages: Record<string, Record<string, string>> = {${others.length ? `\n${others.map((lang) => `  ${JSON.stringify(lang)}: ${ident(lang)},`).join('\n')}\n` : ''}};
`;
  return files;
}

/** Les langues d'un site déjà généré (`src/i18n/config.json`), la principale en tête. */
export function siteLanguagesOf(files: Record<string, string>): { main: string; languages: string[] } | null {
  try {
    const config = JSON.parse(files['src/i18n/config.json'] ?? '');
    const main = String(config.defaultLanguage || '');
    const languages = (Array.isArray(config.languages) ? config.languages : []).map(String).filter(Boolean);
    return main ? { main, languages: languages.length ? languages : [main] } : null;
  } catch {
    return null;
  }
}

/** Le catalogue existant d'une langue. */
export function catalogOf(files: Record<string, string>, lang: string): Record<string, string> {
  try {
    const parsed = JSON.parse(files[`src/i18n/messages/${lang}.json`] ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Remet les catalogues à jour après une retouche (ou un ajout de langue) : les textes nouveaux sont traduits, les
 * autres gardent leur traduction. Rend les fichiers de langues à écrire (rien quand le site n'a qu'une langue et
 * qu'aucune n'est ajoutée).
 */
export async function syncCatalogs(options: {
  caller: ModelCaller;
  /** Tous les fichiers du site, retouches comprises. */
  files: Record<string, string>;
  /** Les langues à ajouter (`/translate en`). */
  add?: string[];
  siteName: string;
  context: string;
  extraTexts?: string[];
}): Promise<{ files: Record<string, string>; languages: string[]; translated: number }> {
  const current = siteLanguagesOf(options.files);
  if (!current) return { files: {}, languages: [], translated: 0 };
  const languages = [...new Set([...current.languages, ...(options.add ?? [])])].filter((lang) => /^[a-z]{2}$/.test(lang));
  if (languages.length < 2) return { files: {}, languages, translated: 0 };
  const texts = [...new Set([...collectMessages(options.files), ...dataModuleTexts(options.files['src/site/data.ts'] ?? ''), ...(options.extraTexts ?? [])])];
  // Dans l'ordre des langues (le fichier de configuration le reprend tel quel).
  const catalogs: Record<string, Record<string, string>> = Object.fromEntries(languages.map((lang) => [lang, {}]));
  let translated = 0;
  await Promise.all(
    languages
      .filter((lang) => lang !== current.main)
      .map(async (lang) => {
        const existing = catalogOf(options.files, lang);
        const before = texts.filter((text) => existing[text]).length;
        // Les traductions déjà là restent (titres des pages, textes d'une section retirée qui pourrait revenir).
        catalogs[lang] = await translateCatalog({ caller: options.caller, texts, from: current.main, to: lang, existing, siteName: options.siteName, context: options.context });
        translated += texts.filter((text) => catalogs[lang][text]).length - before;
      })
  );
  return { files: renderI18nFiles(current.main, catalogs), languages, translated };
}

/** Les textes de `src/site/data.ts` (l'objet passé à `localize(…)`). */
export function dataModuleTexts(code: string): string[] {
  const match = code.match(/localize\(([\s\S]*)\);\s*(?:\n|$)/);
  if (!match) return [];
  try {
    return dataMessages(JSON.parse(match[1]));
  } catch {
    return [];
  }
}

const NATIVE_NAMES: Record<string, string> = {
  francais: 'fr', french: 'fr', english: 'en', espanol: 'es', castellano: 'es', portugues: 'pt', deutsch: 'de', italiano: 'it', nederlands: 'nl', arabe: 'ar', kiswahili: 'sw', lingala: 'ln', hausa: 'ha', haoussa: 'ha', yoruba: 'yo',
};

/** « anglais et espagnol », « en, es », « English » → `['en', 'es']` (codes ISO, noms en français, en anglais ou natifs). */
export function parseLanguages(text: string): string[] {
  const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const names = new Map<string, string>();
  for (const [code, [frName, enName]] of Object.entries(LANGUAGE_LABELS)) {
    names.set(fold(frName), code);
    names.set(fold(enName), code);
    names.set(code, code);
  }
  for (const [name, code] of Object.entries(NATIVE_NAMES)) names.set(name, code);
  const found: string[] = [];
  for (const word of fold(text).split(/[^a-z]+/).filter(Boolean)) {
    const code = names.get(word);
    if (code && !found.includes(code)) found.push(code);
  }
  return found;
}

/** `src/site/data.ts` d'un site d'avant les langues : ses faits passent par `localize()`. Idempotent. */
export function localizeDataModule(code: string): string {
  if (/localize\(/.test(code)) return code;
  const match = code.match(/export const site = (\{[\s\S]*\});\s*\n/);
  if (!match) return code;
  const head = code.slice(0, match.index!);
  const tail = code.slice(match.index! + match[0].length);
  return `${head}import { localize } from '@/i18n';\n\nexport const site = localize(${match[1]});\n${tail}`;
}

/** Le choix de la langue posé au bas du pied de page (un en-tête qui ne l'a pas). Rend `null` si rien n'est à faire. */
/**
 * Le choix de la langue posé dans l'en-tête que son auteur a écrit sans lui : juste avant le déclencheur du menu
 * mobile (`<Sheet`), c'est-à-dire dans le groupe d'actions à droite de la barre — visible en haut sur ordinateur
 * comme sur téléphone. `null` quand la place n'est pas reconnue (le pied de page le reçoit alors).
 */
export function withHeaderLanguageSwitcher(headerCode: string): string | null {
  if (/LanguageSwitcher/.test(headerCode)) return null;
  const at = headerCode.search(/<Sheet[\s>]/);
  if (at < 0) return null;
  const indent = headerCode.slice(headerCode.lastIndexOf('\n', at) + 1, at).match(/^\s*/)?.[0] ?? '';
  // La page en cours, quand l'en-tête la reçoit : les liens de langue pointent alors la même page dès le pré-rendu.
  const current = /\{\s*current\b/.test(headerCode) ? ' current={current}' : '';
  return `import LanguageSwitcher from '@/components/site/language-switcher';\n${headerCode.slice(0, at)}<LanguageSwitcher${current} />\n${indent}${headerCode.slice(at)}`;
}

export function withLanguageSwitcher(footerCode: string): string | null {
  if (/LanguageSwitcher/.test(footerCode)) return null;
  const at = footerCode.lastIndexOf('</footer>');
  if (at < 0) return null;
  return `import LanguageSwitcher from '@/components/site/language-switcher';\n${footerCode.slice(0, at)}  <LanguageSwitcher className="mx-auto mt-6 w-fit" />\n${footerCode.slice(at)}`;
}

/**
 * Les fichiers de langues d'un montage de contrôle en PSEUDO-LANGUE : chaque texte y est « traduit » en lui-même
 * suivi d'un caractère invisible. Un composant qui retrouve une icône ou une image par son texte
 * (`icons[item.title]`) marche dans la langue principale mais casse une fois traduit — ce montage le montre avant
 * qu'un visiteur ne le voie.
 */
export function pseudoLocaleFiles(texts: string[], runtime: string): Record<string, string> {
  const marked = Object.fromEntries(texts.map((text) => [text, `${text}​`]));
  return {
    'src/i18n/config.json': `${JSON.stringify({ defaultLanguage: 'fr', languages: ['fr', 'qa'] })}\n`,
    'src/i18n/messages.ts': `export const messages: Record<string, Record<string, string>> = { qa: ${JSON.stringify(marked)} };\n`,
    // Le runtime du template, la langue de la page forcée sur la pseudo-langue.
    'src/i18n/index.ts': runtime.replace(/export function currentLanguage\(\): string \{/, "export function currentLanguage(): string {\n  return 'qa';"),
  };
}
