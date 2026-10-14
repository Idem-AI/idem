/**
 * TAILWIND, CÔTÉ SERVEUR — toute page s'écrit en classes Tailwind (v4) : jamais de CSS natif.
 *
 * Le compilateur est le cœur JavaScript de `tailwindcss` (aucun binaire natif) : les classes de la page sont
 * lues dans ses attributs `class`, compilées avec le THÈME DE LA MARQUE (couleurs, polices) et la feuille
 * obtenue part dans le `<head>` du fragment. Elle est autonome :
 *  · les variables du thème sont portées par `.ge-page` (deux documents de marques différentes cohabitent) ;
 *  · les `rem` deviennent des `px` (la taille de police racine de l'application hôte ne change pas la page) ;
 *  · une remise à zéro minimale, limitée à `.ge-page`, remplace le preflight (rien ne fuit dans l'hôte).
 */
import fs from 'fs';
import path from 'path';
import type { DesignTokens } from '../design-system/tokens';
import { stableHash } from '../foundation/hash';

type Compiler = { build(candidates: string[]): string };

let twDir: string | null = null;
function tailwindDir(): string {
  if (!twDir) twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  return twDir;
}

/** Les couleurs de la marque, nommées pour l'auteur (`bg-brand-primary`, `text-ink`…). */
export function themeColors(tokens: DesignTokens): Record<string, string> {
  const c = tokens.color;
  const ramp = (r: Record<string, string>, prefix: string) => Object.fromEntries(Object.entries(r).map(([k, v]) => [`${prefix}-${k}`, v]));
  return {
    'brand-primary': c.primary,
    'brand-secondary': c.secondary,
    'brand-accent': c.accent,
    'brand-soft': c.brandSoft,
    'accent-soft': c.accentSoft,
    'on-brand': c.onBrand,
    'on-accent': c.onAccent,
    ground: c.ground,
    raised: c.raised,
    sunken: c.sunken,
    ink: c.ink,
    muted: c.muted,
    faint: c.faint,
    rule: c.rule,
    deep: c.deep,
    'on-deep': c.onDeep,
    ...ramp(c.brandRamp, 'brand'),
    ...ramp(c.accentRamp, 'accent'),
  };
}

export function themeCss(tokens: DesignTokens): string {
  const colors = Object.entries(themeColors(tokens))
    .map(([k, v]) => `--color-${k}: ${v};`)
    .join(' ');
  return `@theme { ${colors} --font-display: ${tokens.font.displayStack}; --font-body: ${tokens.font.bodyStack}; }`;
}

const compilers = new Map<string, Promise<Compiler>>();

async function compilerFor(theme: string): Promise<Compiler> {
  const key = stableHash(theme, 16);
  let c = compilers.get(key);
  if (!c) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tw = require('tailwindcss') as { compile: (css: string, o: Record<string, unknown>) => Promise<Compiler> };
    const dir = tailwindDir();
    c = tw.compile(`@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css";\n${theme}`, {
      base: dir,
      loadStylesheet: async (id: string, base: string) => {
        const file = id.startsWith('tailwindcss/') ? path.join(dir, id.slice('tailwindcss/'.length)) : path.resolve(base, id);
        return { path: file, base: path.dirname(file), content: await fs.promises.readFile(file, 'utf8') };
      },
      loadModule: async () => {
        throw new Error('plugins are not allowed');
      },
    });
    c.catch(() => compilers.delete(key));
    compilers.set(key, c);
    if (compilers.size > 64) compilers.delete(compilers.keys().next().value as string);
  }
  return c;
}

/** Les classes d'un fragment : le contenu de ses attributs `class` (le HTML est le nôtre, déjà assaini). */
export function classCandidates(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\sclass\s*=\s*("([^"]*)"|'([^']*)')/gi)) for (const c of (m[2] ?? m[3] ?? '').split(/\s+/)) if (c) out.add(c.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  return [...out];
}

/** Une remise à zéro limitée à la page (le preflight de Tailwind, réduit), sans poids : toute classe passe devant. */
const BASE = `:where(.ge-page),:where(.ge-page) *,:where(.ge-page) ::before,:where(.ge-page) ::after{box-sizing:border-box;border:0 solid;margin:0;padding:0}
:where(.ge-page){-webkit-print-color-adjust:exact;print-color-adjust:exact;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
:where(.ge-page) :where(h1,h2,h3,h4,h5,h6){font-size:inherit;font-weight:inherit}
:where(.ge-page) :where(ol,ul){list-style:none}
:where(.ge-page) :where(img,svg,video){display:block;vertical-align:middle}
:where(.ge-page) :where(img){max-width:100%}
:where(.ge-page) :where(table){border-collapse:collapse;text-indent:0;border-color:inherit}
:where(.ge-page) :where(a){color:inherit;text-decoration:inherit}`;

/** Dans les DÉCLARATIONS seulement : un sélecteur échappé (`.text-\[1\.5rem\]`) garde son nom. */
const remToPx = (css: string) => css.replace(/:[^;{}]*[;}]/g, (decl) => decl.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${Math.round(parseFloat(n) * 16 * 1000) / 1000}px`));

/**
 * La feuille d'un fragment. Une classe inconnue de Tailwind est ignorée (comme dans un navigateur) ; une erreur
 * du compilateur remonte : c'est une erreur TECHNIQUE, la seule que le moteur traite.
 */
export async function compileTailwind(html: string, tokens: DesignTokens): Promise<string> {
  const compiler = await compilerFor(themeCss(tokens));
  const built = compiler.build(classCandidates(html));
  // Le thème habite la page, pas le document hôte.
  const scoped = built.replace(/:root,\s*:host\s*\{/g, '.ge-page {').replace(/^\/\*![^*]*\*\/\s*/, '');
  return `${BASE}\n${remToPx(scoped)}`;
}
