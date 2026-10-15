/**
 * Correction automatique d'un composant, par le code, avant sa vérification.
 *
 * Les journaux de génération montrent que les refus viennent presque tous des
 * mêmes fautes, toutes mécaniques :
 *
 *   - une couleur écrite en dur (`bg-[#C79100]`, `text-gray-600`) au lieu d'un
 *     jeton du thème ;
 *   - un composant ou un module employé sans import (`<Heading>`, `motion`) ;
 *   - un import au mauvais endroit (`media` depuis `@/site/data`) ;
 *   - une icône mal nommée (`washingMachine`, `Iron`, `FaWhatsapp`) ;
 *   - un composant exporté sans `default`.
 *
 * Aucune ne demande de jugement : la bonne réponse est connue. Le code la pose
 * donc lui-même, sans rappeler le modèle, et la vérification ne voit plus que
 * ce qui demande vraiment une réécriture (une erreur de syntaxe, un fait
 * inventé).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CATALOG } from './catalog.js';
import { compiler } from './template.js';

/* -------------------------------------------------------------------------- */
/*  Icônes                                                                     */
/* -------------------------------------------------------------------------- */

let iconNames: Set<string> | null = null;

/**
 * Les icônes exportées par lucide-react, alias compris (`AlertCircle`,
 * `CheckCircle2`), dans la version exacte posée dans les sites. C'est le bloc
 * d'export FINAL du fichier de types qui les liste toutes ; le premier bloc
 * venu n'a que les noms canoniques.
 */
export function lucideIcons(): Set<string> {
  if (iconNames) return iconNames;
  try {
    const require = createRequire(import.meta.url);
    const types = readFileSync(require.resolve('lucide-react/dist/lucide-react.d.ts'), 'utf8');
    const start = types.lastIndexOf('\nexport {');
    const block = types.slice(start + '\nexport {'.length, types.indexOf('}', start));
    iconNames = new Set(
      block
        .split(',')
        .map((part) => part.trim().split(/\s+as\s+/).pop()!.trim())
        .filter((name) => /^[A-Z]\w*$/.test(name))
    );
  } catch {
    iconNames = new Set();
  }
  return iconNames;
}

/** Mots du nom d'une icône inventée → icône existante qui dit la même chose. */
const ICON_SYNONYMS: Array<[RegExp, string]> = [
  [/whats ?app|message|chat|sms|comment/i, 'MessageCircle'],
  [/phone|call|tel/i, 'Phone'],
  [/mail|envelope|email/i, 'Mail'],
  [/map|location|pin|marker|address/i, 'MapPin'],
  [/clock|time|hour|schedule/i, 'Clock'],
  [/calendar|date|agenda/i, 'Calendar'],
  [/check|success|tick|valid|done/i, 'CircleCheck'],
  [/alert|warning|error|danger|info/i, 'CircleAlert'],
  [/star|rating/i, 'Star'],
  [/heart|love|like/i, 'Heart'],
  [/truck|deliver|shipping|livraison/i, 'Truck'],
  [/wash|laundry|lessive/i, 'WashingMachine'],
  [/iron|shirt|cloth|vetement|tshirt/i, 'Shirt'],
  [/spray|clean|nettoy/i, 'SprayCan'],
  [/user|person|people|team|client|customer/i, 'Users'],
  [/home|house|maison/i, 'House'],
  [/shop|store|cart|bag|boutique/i, 'ShoppingBag'],
  [/money|cash|wallet|pay|price|coin|dollar|euro/i, 'Wallet'],
  [/card|bank|credit/i, 'CreditCard'],
  [/shield|secure|safe|trust|lock/i, 'ShieldCheck'],
  [/food|utensil|restaurant|meal|fork/i, 'Utensils'],
  [/leaf|eco|nature|plant|green/i, 'Leaf'],
  [/arrow|chevron|next|right/i, 'ArrowRight'],
  [/facebook/i, 'Facebook'],
  [/instagram/i, 'Instagram'],
  [/linkedin/i, 'Linkedin'],
  [/twitter|x$/i, 'Twitter'],
  [/youtube|video|play/i, 'Youtube'],
  [/globe|world|web|internet/i, 'Globe'],
  [/menu|burger|bars/i, 'Menu'],
  [/close|times|cross/i, 'X'],
];

/** Le nom existant d'une icône demandée sous un autre nom. Jamais rien d'inexistant. */
export function resolveIcon(name: string): string {
  const icons = lucideIcons();
  if (icons.has(name)) return name;
  const bare = name.replace(/^(Fa|Fi|Md|Hi|Bi|Ai|Bs|Io|Ri|Tb|Lu|Si|Gi)(?=[A-Z])/, '').replace(/Icon$|Outline$|Solid$|Fill$/, '');
  const wanted = bare.replace(/[-_\s]/g, '').toLowerCase();
  const exact = Array.from(icons).find((icon) => icon.toLowerCase() === wanted);
  if (exact) return exact;
  for (const [pattern, icon] of ICON_SYNONYMS) {
    if (pattern.test(bare) && icons.has(icon)) return icon;
  }
  return icons.has('Sparkles') ? 'Sparkles' : 'Circle';
}

const ICON_LIBRARIES = /^(react-icons(\/.*)?|@heroicons\/.*|@tabler\/icons-react|react-feather|@phosphor-icons\/react|lucide)$/;

/* -------------------------------------------------------------------------- */
/*  Imports                                                                    */
/* -------------------------------------------------------------------------- */

interface ModuleImport {
  source: string;
  defaultName?: string;
  namespace?: string;
  /** Nom local → nom importé (deux noms locaux peuvent viser la même icône). */
  named: Map<string, string>;
}

/** Où vit chaque nom que les composants emploient. */
function symbolHome(): Map<string, { source: string; isDefault?: boolean }> {
  const home = new Map<string, { source: string; isDefault?: boolean }>();
  for (const entry of CATALOG) {
    for (const name of entry.exports) home.set(name, { source: `@/components/ui/${entry.module}` });
  }
  for (const name of ['motion', 'AnimatePresence', 'MotionConfig', 'useInView', 'useScroll', 'useTransform', 'useReducedMotion', 'useMotionValue', 'useSpring', 'stagger', 'animate']) {
    home.set(name, { source: 'motion/react' });
  }
  for (const name of ['useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'useId', 'Fragment']) home.set(name, { source: 'react' });
  home.set('motionTokens', { source: '@/design-system' });
  home.set('componentConfig', { source: '@/design-system' });
  home.set('site', { source: '@/site/data' });
  home.set('media', { source: '@/site/media' });
  home.set('cn', { source: '@/lib/utils' });
  home.set('messageLink', { source: '@/lib/contact' });
  home.set('BrandMark', { source: '@/site/brand', isDefault: true });
  return home;
}

const IMPORT_STATEMENT = /^import\s+(?!type\s)([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;

function parseClause(clause: string, source: string): ModuleImport {
  const entry: ModuleImport = { source, named: new Map() };
  const named = clause.match(/\{([\s\S]*)\}/)?.[1];
  if (named) {
    for (const part of named.split(',')) {
      const text = part.trim().replace(/^type\s+/, '');
      if (!text) continue;
      const [imported, local] = text.split(/\s+as\s+/).map((item) => item.trim());
      entry.named.set(local ?? imported, imported);
    }
  }
  const head = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
  const namespace = head.match(/\*\s+as\s+(\w+)/)?.[1];
  if (namespace) entry.namespace = namespace;
  else if (head) entry.defaultName = head.split(/\s+/)[0];
  return entry;
}

function renderImport(entry: ModuleImport): string {
  const named = Array.from(entry.named.entries()).map(([local, imported]) => (imported === local ? imported : `${imported} as ${local}`));
  const parts = [
    entry.defaultName,
    entry.namespace ? `* as ${entry.namespace}` : undefined,
    named.length ? `{ ${named.join(', ')} }` : undefined,
  ].filter(Boolean);
  return `import ${parts.join(', ')} from '${entry.source}';`;
}

/** Les modules du projet et ce qu'ils exportent (pour déplacer un import mal placé). */
function knownExports(): Map<string, Set<string>> {
  const exports = new Map<string, Set<string>>();
  for (const entry of CATALOG) exports.set(`@/components/ui/${entry.module}`, new Set(entry.exports));
  exports.set('@/site/data', new Set(['site']));
  exports.set('@/site/media', new Set(['media']));
  exports.set('@/design-system', new Set(['motionTokens', 'componentConfig']));
  exports.set('@/lib/utils', new Set(['cn']));
  exports.set('@/lib/contact', new Set(['messageLink', 'contactChannel']));
  exports.set('@/site/brand', new Set(['BRAND_NAME']));
  return exports;
}

/** Les noms employés comme valeur ou comme balise, sans déclaration ni import. */
function usedNames(code: string, body: string): Set<string> {
  const used = new Set<string>();
  for (const match of Array.from(body.matchAll(/<([A-Z][\w$]*|motion)\b/g))) used.add(match[1]);
  for (const name of ['motion', 'motionTokens', 'site', 'media', 'cn', 'messageLink', 'AnimatePresence', 'useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'useId', 'useInView', 'useScroll', 'useTransform', 'useReducedMotion']) {
    if (new RegExp(`(?<![\\w.$'"\`])${name}\\s*[.(]`).test(body)) used.add(name);
  }
  // `icon: Phone` dans un tableau de données : une icône employée comme valeur.
  for (const match of Array.from(body.matchAll(/(?:icon|Icon)\s*[:=]\s*\{?\s*([A-Z][\w$]*)/g))) used.add(match[1]);
  void code;
  return used;
}

function declaredNames(body: string, imports: ModuleImport[]): Set<string> {
  const declared = new Set<string>(['Math', 'Date', 'Number', 'String', 'Array', 'Object', 'JSON', 'Intl', 'Boolean', 'Promise', 'Set', 'Map', 'URL', 'Fragment']);
  for (const entry of imports) {
    if (entry.defaultName) declared.add(entry.defaultName);
    if (entry.namespace) declared.add(entry.namespace);
    entry.named.forEach((_imported, local) => declared.add(local));
  }
  for (const match of Array.from(body.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g))) declared.add(match[1]);
  for (const match of Array.from(body.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g))) {
    match[1].split(',').forEach((part) => declared.add(part.split(':').pop()!.trim()));
  }
  // Paramètres déstructurés et variables de boucle : `({ icon: Icon })`, `.map((Item) =>`.
  for (const match of Array.from(body.matchAll(/[{,]\s*\w+\s*:\s*([A-Z][\w$]*)\s*[,}]/g))) declared.add(match[1]);
  for (const match of Array.from(body.matchAll(/\(\s*\{?\s*([A-Z][\w$]*)/g))) declared.add(match[1]);
  return declared;
}

/* -------------------------------------------------------------------------- */
/*  Couleurs                                                                   */
/* -------------------------------------------------------------------------- */

export type ThemeColors = Record<string, { r: number; g: number; b: number }>;

/** Les couleurs du thème, lues dans le CSS compilé (`--primary: 14 124 102;`). */
export function themeColorsFromCss(css: string): ThemeColors {
  const colors: ThemeColors = {};
  for (const match of Array.from(css.matchAll(/--([a-z-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3});/g))) {
    colors[match[1]] = { r: Number(match[2]), g: Number(match[3]), b: Number(match[4]) };
  }
  return colors;
}

const PALETTE = /(?<![\w-])(bg|text|border(?:-[trblxy])?|from|via|to|ring|fill|stroke|outline|divide|decoration|placeholder|caret|accent|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)(\/\d{1,3})?(?![\w-])/g;
const ARBITRARY = /(?<![\w-])(bg|text|border(?:-[trblxy])?|from|via|to|ring|fill|stroke|outline|decoration|shadow)-\[(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch)\([^\]]*\))\](\/\d{1,3})?(?![\w-])/g;

const NEUTRALS = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);
const TINT_BY_SHADE: Record<string, string> = { '50': '/5', '100': '/10', '200': '/15', '300': '/25' };

/** Jetons candidats selon l'usage : un texte et un fond ne se remplacent pas pareil. */
const TEXT_TOKENS = ['foreground', 'muted-foreground', 'primary', 'primary-foreground', 'background'];
const SURFACE_TOKENS = ['background', 'card', 'muted', 'secondary', 'accent', 'primary', 'foreground', 'border'];

function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function nearest(color: { r: number; g: number; b: number }, candidates: string[], theme: ThemeColors): string {
  let best = candidates[0];
  let score = Infinity;
  for (const token of candidates) {
    const value = theme[token];
    if (!value) continue;
    const d = distance(color, value);
    if (d < score) {
      score = d;
      best = token;
    }
  }
  return best;
}

/** Remplace les couleurs écrites en dur par les jetons du thème les plus proches. */
export function themeColors(code: string, theme: ThemeColors): { code: string; replaced: number } {
  let replaced = 0;
  const textual = (utility: string) => utility === 'text' || utility === 'placeholder' || utility === 'decoration' || utility === 'caret';

  let out = code.replace(PALETTE, (_match, utility: string, family: string, shade: string, opacity = '') => {
    replaced += 1;
    const level = Number(shade);
    if (NEUTRALS.has(family)) {
      if (textual(utility)) return `${utility}-${level <= 300 ? 'background' : level <= 600 ? 'muted-foreground' : 'foreground'}${opacity}`;
      if (utility.startsWith('border') || utility === 'divide' || utility === 'ring' || utility === 'outline') return `${utility}-${level >= 700 ? 'foreground' : 'border'}${opacity}`;
      return `${utility}-${level <= 200 ? 'muted' : level <= 400 ? 'border' : 'foreground'}${opacity}`;
    }
    if (textual(utility)) return `${utility}-primary${opacity}`;
    return `${utility}-primary${opacity || (level <= 300 ? TINT_BY_SHADE[shade] : '')}`;
  });

  out = out.replace(ARBITRARY, (match, utility: string, value: string, opacity = '') => {
    const color = compiler.parseColor(value);
    if (!color) return match;
    replaced += 1;
    const white = { r: 255, g: 255, b: 255 };
    const candidates = textual(utility) ? TEXT_TOKENS : SURFACE_TOKENS;
    if (distance(color, white) < 300 && textual(utility)) return `${utility}-white${opacity}`;
    return `${utility}-${nearest(color, candidates, theme)}${opacity}`;
  });

  return { code: out, replaced };
}

/* -------------------------------------------------------------------------- */
/*  Correction                                                                 */
/* -------------------------------------------------------------------------- */

export interface Correction {
  code: string;
  /** Ce qui a été corrigé, pour les journaux. */
  fixes: string[];
}

/** Applique toutes les corrections mécaniques ; ne lève jamais. */
export function autocorrect(source: string, theme: ThemeColors): Correction {
  const fixes: string[] = [];
  let code = source;

  try {
    // 1. Imports : relus, rangés, complétés.
    const imports: ModuleImport[] = [];
    const statements: string[] = [];
    for (const match of Array.from(code.matchAll(IMPORT_STATEMENT))) {
      statements.push(match[0]);
      imports.push(parseClause(match[1], match[2]));
    }
    let body = code;
    for (const statement of statements) body = body.replace(statement, '');

    const icons = lucideIcons();
    const home = symbolHome();
    const exports = knownExports();
    const target = new Map<string, ModuleImport>();
    const take = (source: string): ModuleImport => {
      const existing = target.get(source);
      if (existing) return existing;
      const created: ModuleImport = { source, named: new Map() };
      target.set(source, created);
      return created;
    };

    for (const entry of imports) {
      let source = entry.source === 'framer-motion' ? 'motion/react' : entry.source;
      if (source !== entry.source) fixes.push('framer-motion → motion/react');

      // Une bibliothèque d'icônes étrangère : ses icônes deviennent des icônes lucide.
      if (ICON_LIBRARIES.test(source) && source !== 'lucide-react') {
        for (const [local] of entry.named) {
          const icon = resolveIcon(local);
          take('lucide-react').named.set(local, icon);
          fixes.push(`icône ${local} → ${icon}`);
        }
        continue;
      }

      if (source === 'lucide-react') {
        for (const [local, imported] of entry.named) {
          const icon = resolveIcon(imported);
          if (icon !== imported) fixes.push(`icône ${imported} → ${icon}`);
          take('lucide-react').named.set(local, icon);
        }
        if (entry.defaultName || entry.namespace) take('lucide-react').defaultName = undefined;
        continue;
      }

      const isUi = source === '@/components/ui' || source.startsWith('@/components/ui/');
      const owned = exports.get(source);
      if (isUi || owned) {
        for (const [local, imported] of entry.named) {
          if (owned?.has(imported)) {
            take(source).named.set(local, imported);
            continue;
          }
          const where = home.get(imported);
          if (where && !where.isDefault) {
            take(where.source).named.set(local, imported);
            fixes.push(`${imported} importé depuis ${where.source}`);
          } else if (icons.has(imported)) {
            take('lucide-react').named.set(local, imported);
          } else if (isUi) {
            // Un nom inconnu du catalogue : il sera signalé s'il est employé.
            fixes.push(`${imported} retiré (inconnu de ${source})`);
          } else {
            take(source).named.set(local, imported);
          }
        }
        if (entry.defaultName) {
          const where = home.get(entry.defaultName);
          if (source === '@/site/brand' || where?.isDefault) take('@/site/brand').defaultName = entry.defaultName;
          else if (where) {
            take(where.source).named.set(entry.defaultName, entry.defaultName);
            fixes.push(`${entry.defaultName} : import nommé`);
          }
        }
        if (entry.namespace) take(source).namespace = entry.namespace;
        continue;
      }

      const kept = take(source);
      if (entry.defaultName) kept.defaultName = entry.defaultName;
      if (entry.namespace) kept.namespace = entry.namespace;
      entry.named.forEach((imported, local) => kept.named.set(local, imported));
    }

    // Les noms employés sans import, quand leur module est connu.
    const declared = declaredNames(body, Array.from(target.values()));
    for (const name of usedNames(code, body)) {
      if (declared.has(name)) continue;
      const where = home.get(name);
      if (where?.isDefault) take(where.source).defaultName = name;
      else if (where) take(where.source).named.set(name, name);
      else if (icons.has(name)) take('lucide-react').named.set(name, name);
      else continue;
      fixes.push(`import ajouté : ${name}`);
    }

    const head = Array.from(target.values())
      .filter((entry) => entry.defaultName || entry.namespace || entry.named.size)
      .map(renderImport);
    const leading = code.match(/^(\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n|['"]use client['"];?\s*))*/)?.[0] ?? '';
    const typeImports = Array.from(code.matchAll(/^import\s+type\s[^\n]*$/gm)).map((match) => match[0]);
    const sideEffects = Array.from(code.matchAll(/^import\s+['"][^'"]+['"];?[ \t]*$/gm)).map((match) => match[0]);
    body = body.replace(leading, '');
    for (const line of [...typeImports, ...sideEffects]) body = body.replace(line, '');
    code = `${leading}${[...head, ...typeImports, ...sideEffects.filter((line) => !/\.css['"]/.test(line))].join('\n')}\n\n${body.replace(/^\s+/, '')}`;
  } catch {
    code = source;
  }

  // 2. L'export par défaut.
  if (!/export\s+default\s/.test(code)) {
    const named = code.match(/export\s+function\s+([A-Z]\w*)\s*\(/);
    const plain = code.match(/^function\s+([A-Z]\w*)\s*\(/m);
    if (named) {
      code = code.replace(named[0], `export default function ${named[1]}(`);
      fixes.push('export par défaut');
    } else if (plain) {
      code = `${code.trimEnd()}\n\nexport default ${plain[1]};\n`;
      fixes.push('export par défaut');
    }
  }

  // 3. Les couleurs écrites en dur → jetons du thème.
  const colored = themeColors(code, theme);
  if (colored.replaced) {
    code = colored.code;
    fixes.push(`${colored.replaced} couleur(s) → jetons du thème`);
  }

  // 4. Pas de feuille de style ni de balise <style>.
  if (/<style[\s>]/.test(code)) {
    code = code.replace(/<style[\s\S]*?<\/style>/g, '');
    fixes.push('balise <style> retirée');
  }

  return { code, fixes };
}

/* -------------------------------------------------------------------------- */
/*  Faits                                                                      */
/* -------------------------------------------------------------------------- */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Retire du code les phrases qui portent une affirmation absente des faits —
 * dans les textes JSX et dans les chaînes. Dernier recours, quand le modèle
 * n'a pas su les retirer lui-même : une phrase en moins vaut mieux qu'une
 * promesse que personne n'a faite.
 */
export function stripClaims(code: string, items: string[]): string {
  if (!items.length) return code;
  const patterns = items.map((item) => new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(item)}(?![\\p{L}\\d])`, 'iu'));
  const hits = (text: string) => patterns.some((pattern) => pattern.test(text));
  const clean = (text: string) =>
    text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !hits(sentence))
      .join(' ');

  // Textes JSX : entre deux balises, sans expression.
  let out = code.replace(/>([^<>{}]*\p{L}[^<>{}]*)</gu, (match, text: string) => (hits(text) ? `>${clean(text)}<` : match));
  // Chaînes de caractères avec des espaces (données d'une liste, attributs).
  out = out.replace(/(['"])((?:(?!\1)[^\\\n]|\\.)*\s(?:(?!\1)[^\\\n]|\\.)*)\1/g, (match, quote: string, text: string) =>
    hits(text) ? `${quote}${clean(text)}${quote}` : match
  );
  return out;
}
