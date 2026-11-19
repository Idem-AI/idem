/**
 * Motion allégé — posé par IDEM, NE PAS MODIFIER.
 *
 * Le composant `motion` de Motion embarque toutes ses fonctions (gestes, glisser, dispositions animées) dans le
 * paquet de chaque page, même pour un simple fondu. Son jumeau `m` n'embarque rien : les fonctions viennent du
 * `<LazyMotion features={domMax}>` posé dans le point d'entrée de la page (`src/entries/*.tsx`).
 *
 *   aperçu        rien ne change : les sections importent `motion`, l'entrée fournit toutes les fonctions
 *   construction  dans le code du site, `import { motion } from 'motion/react'` devient
 *                 `import { m as motion } from 'motion/react'` ; et si aucune section ne se sert du glisser ni des
 *                 dispositions animées (`drag`, `layout`, `layoutId`…), l'entrée reçoit domAnimation à la place de
 *                 domMax (environ moitié moins de code)
 *
 * Le code écrit (par le modèle ou à la main) n'a rien à savoir : il garde `motion.div`, `motion.create(...)`.
 *
 * Garde-fou : la réécriture n'a lieu que si CHAQUE point d'entrée enveloppe la page dans `<LazyMotion>`. Un site
 * dont une entrée est d'avant (sans `LazyMotion`) se construit comme avant — sinon ses `m.div` n'auraient aucune
 * fonction et resteraient figés dans leur état de départ (souvent invisibles : `opacity: 0`).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Ce qui demande domMax : le glisser et les dispositions animées. */
const NEEDS_MAX = /\b(drag|dragConstraints|layout|layoutId|layoutScroll|layoutRoot)\s*[=:]|<LayoutGroup\b|\bReorder\b/;

/** Les fichiers de code d'un dossier (récursif). */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) sourceFiles(path, out);
    else if (/\.(tsx?|jsx?)$/.test(item.name)) out.push(path);
  }
  return out;
}

/** Vrai si chaque point d'entrée de page fournit les fonctions par `<LazyMotion>`. */
export function entriesProvideLazyMotion(root) {
  const entries = sourceFiles(join(root, 'src/entries'));
  return entries.length > 0 && entries.every((file) => /<LazyMotion\b/.test(readFileSync(file, 'utf8')));
}

/** Vrai si une section se sert du glisser ou des dispositions animées (domMax obligatoire). */
export function needsMaxFeatures(root) {
  return sourceFiles(join(root, 'src')).some((file) => !file.includes(`${join('src', 'entries')}`) && NEEDS_MAX.test(readFileSync(file, 'utf8')));
}

/**
 * Renomme des imports nommés de `motion/react` : `{ motion: 'm' }` change `import { motion, useInView } from
 * 'motion/react'` en `import { m as motion, useInView } from 'motion/react'`. Un alias est gardé (`motion as M` →
 * `m as M`). Le reste du fichier ne bouge pas : `motion.div`, `motion.create(Card)` et `motion(Card)` existent
 * aussi sur `m`.
 */
export function renameMotionImports(code, renames) {
  return code.replace(/import\s*\{([^}]*)\}\s*from\s*(['"])motion\/react\2/g, (statement, names, quote) => {
    let rewritten = names;
    for (const [from, to] of Object.entries(renames)) {
      const pattern = new RegExp(`(^|,)(\\s*)${from}(\\s+as\\s+[A-Za-z_$][\\w$]*)?(\\s*)(?=,|$)`, 'g');
      rewritten = rewritten.replace(pattern, (_all, lead, space, alias, tail) => `${lead}${space}${to}${alias ?? ` as ${from}`}${tail}`);
    }
    return rewritten === names ? statement : `import {${rewritten}} from ${quote}motion/react${quote}`;
  });
}

export default function idemMotion() {
  let root = process.cwd();
  let build = false;
  let lazy = false;
  let light = false;

  return {
    name: 'idem-motion',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      build = config.command === 'build' && !config.build.ssr;
    },
    buildStart() {
      lazy = build && entriesProvideLazyMotion(root);
      light = lazy && !needsMaxFeatures(root);
    },
    transform(code, id) {
      if (!lazy || id.includes('/node_modules/') || !/\.(tsx?|jsx?)$/.test(id.split('?')[0])) return null;
      const path = relative(root, id).split('\\').join('/');
      if (!path.startsWith('src/') || !code.includes('motion/react')) return null;
      const renames = path.startsWith('src/entries/') ? (light ? { domMax: 'domAnimation' } : {}) : { motion: 'm' };
      const out = renameMotionImports(code, renames);
      return out === code ? null : { code: out, map: null };
    },
  };
}
