/**
 * Plugin Vite du design system — posé par IDEM, NE PAS MODIFIER.
 *
 * `src/design-system/design-system.json` est la seule source de vérité de
 * l'apparence du site. Ce plugin la compile au démarrage, à la construction et
 * à chaque modification :
 *
 *   - `theme.generated.css` et `component-config.generated.json` sont réécrits
 *     quand ils ne correspondent plus à la configuration ;
 *   - les feuilles des polices sont ajoutées au `<head>` de chaque page.
 *
 * Une configuration mal formée n'arrête pas le site : les champs fautifs
 * reprennent leur valeur par défaut et le terminal dit lesquels.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDesignSystem, fontLinksHtml } from './compile.mjs';

const SOURCE = 'src/design-system/design-system.json';
const CSS = 'src/design-system/theme.generated.css';
const COMPONENTS = 'src/design-system/component-config.generated.json';
const FONTS_MARKER = '<!-- idem:fonts -->';

export default function idemDesignSystem() {
  let root = process.cwd();
  let fonts = [];

  const compile = () => {
    const source = resolve(root, SOURCE);
    let input = {};
    if (existsSync(source)) {
      try {
        input = JSON.parse(readFileSync(source, 'utf8'));
      } catch (error) {
        console.warn(`[design-system] ${SOURCE} illisible (${error.message}) : valeurs par défaut appliquées`);
      }
    }

    const result = compileDesignSystem(input);
    for (const message of result.report.errors) console.warn(`[design-system] ${message}`);

    const outputs = [
      [resolve(root, CSS), result.css],
      [resolve(root, COMPONENTS), `${JSON.stringify(result.componentConfig, null, 2)}\n`],
    ];
    for (const [path, content] of outputs) {
      const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
      if (current !== content) writeFileSync(path, content);
    }

    fonts = result.fonts;
  };

  return {
    name: 'idem-design-system',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      compile();
    },

    configureServer(server) {
      const source = resolve(root, SOURCE);
      server.watcher.add(source);
      server.watcher.on('change', (file) => {
        if (resolve(file) !== source) return;
        compile();
        // Les polices vivent dans le document : il faut le recharger.
        server.ws.send({ type: 'full-reload' });
      });
    },

    transformIndexHtml(html) {
      const links = fontLinksHtml(fonts);
      return html.includes(FONTS_MARKER)
        ? html.replace(FONTS_MARKER, links)
        : html.replace('</head>', `    ${links}\n  </head>`);
    },
  };
}
