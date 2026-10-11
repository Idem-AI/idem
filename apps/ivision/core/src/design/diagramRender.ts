/**
 * LE RENDU D'UN SCHÉMA — Mermaid, dans le Chromium qu'on fait déjà tourner.
 *
 * Marché : l'agent écrit UNE LIGNE de texte (« flowchart LR; Collecte --> Tri --> Granulés »),
 * le code dessine le schéma aux couleurs de la marque. 78 signes contre 10 Ko de SVG écrit à la
 * main — et un résultat qu'un modèle n'atteint pas en dessinant lui-même.
 *
 * Mermaid est vendu comme les autres bibliothèques du rendu (`public/scripts/tailwind.js`,
 * `chart.js`) : un paquet construit une fois, injecté dans la page. Il n'y a donc ni réseau, ni
 * version qui bouge sous les pieds d'un document déjà validé.
 *
 * Trois garde-fous : seules les familles thémées passent (`DIAGRAM_KINDS`), le SVG produit est
 * nettoyé de tout ce qui exécuterait du code, et un échec ne casse jamais la page — l'appelant
 * garde son bloc de repli.
 */
import fs from 'fs';
import path from 'path';
import logger from '../runtime/logger';
import { brandMermaidTheme, diagramKindOf, type DiagramPalette } from './diagramTheme';

/** Le paquet Mermaid construit (`npm run build:mermaid --prefix apps/api`). */
const CANDIDATES = [
  path.join(process.cwd(), 'public', 'scripts', 'mermaid.js'),
  path.join(process.cwd(), 'apps', 'api', 'public', 'scripts', 'mermaid.js'),
  path.resolve(__dirname, '../../../../api/public/scripts/mermaid.js'),
];

let bundle: string | null | undefined;
export function mermaidBundle(): string | null {
  if (bundle === undefined) {
    const found = CANDIDATES.find((file) => fs.existsSync(file));
    bundle = found ? fs.readFileSync(found, 'utf8') : null;
    if (!found) logger.warn('[Diagram] paquet Mermaid absent : les schémas retombent sur leur repli', { looked: CANDIDATES.length });
  }
  return bundle;
}

/** Ce qui ne doit jamais survivre dans un SVG inséré dans une page ou un PDF. */
function cleanSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*(?!#)[a-z]+:[^"']*\2/gi, '')
    // Mermaid pose une largeur d'écran ; dans une page, c'est la colonne qui commande.
    .replace(/<svg([^>]*?)\sstyle="[^"]*"/i, '<svg$1')
    .replace(/<svg([^>]*?)\swidth="[^"]*"/i, '<svg$1')
    .replace(/<svg /i, '<svg style="width:100%;height:auto;display:block" ');
}

export interface DiagramRequest {
  /** La source Mermaid, telle que l'agent l'a écrite. */
  source: string;
  /** Identifiant unique dans la page (Mermaid l'emploie pour ses styles). */
  id: string;
}

export interface DiagramResult {
  id: string;
  svg: string | null;
  /** Pourquoi le schéma n'a pas été dessiné (famille refusée, erreur de syntaxe, paquet absent). */
  error?: string;
}

/**
 * Dessine un lot de schémas dans UNE page (le paquet n'est injecté qu'une fois : c'est ce qui
 * coûte, pas le rendu). `withPage` est fourni par l'hôte — le même navigateur que les visuels.
 */
export async function renderDiagrams(
  requests: DiagramRequest[],
  palette: DiagramPalette,
  withPage: <T>(width: number, height: number, run: (page: any) => Promise<T>) => Promise<T>
): Promise<DiagramResult[]> {
  const refused: DiagramResult[] = [];
  const accepted: DiagramRequest[] = [];
  for (const req of requests) {
    if (!diagramKindOf(req.source)) refused.push({ id: req.id, svg: null, error: `unsupported diagram type (first word of the source)` });
    else accepted.push(req);
  }
  if (!accepted.length) return refused;

  const lib = mermaidBundle();
  if (!lib) return [...refused, ...accepted.map((r) => ({ id: r.id, svg: null, error: 'mermaid bundle missing' }))];

  const theme = brandMermaidTheme(palette);
  const started = Date.now();
  let drawn: { id: string; svg?: string; error?: string }[] = [];
  try {
    drawn = await withPage(1200, 900, async (page) => {
      await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>', { waitUntil: 'load', timeout: 30000 });
      await page.addScriptTag({ content: lib });
      // Chaîne de promesses écrite à la main : la page ne connaît pas les helpers de compilation.
      return (await page.evaluate(`(function () {
        var m = window.mermaid;
        if (!m) return [];
        m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: ${JSON.stringify(theme)}, flowchart: { useMaxWidth: true, htmlLabels: false }, timeline: { useMaxWidth: true }, journey: { useMaxWidth: true } });
        var jobs = ${JSON.stringify(accepted.map((r) => ({ id: r.id, source: r.source })))};
        var out = [];
        var chain = Promise.resolve();
        jobs.forEach(function (job) {
          chain = chain.then(function () {
            return m.render('mmd-' + job.id, job.source).then(
              function (res) { out.push({ id: job.id, svg: res.svg }); },
              function (err) { out.push({ id: job.id, error: String((err && err.message) || err).slice(0, 160) }); }
            );
          });
        });
        return chain.then(function () { return out; });
      })()`)) as { id: string; svg?: string; error?: string }[];
    });
  } catch (error) {
    logger.warn('[Diagram] rendu en échec', { error: (error as Error)?.message });
    return [...refused, ...accepted.map((r) => ({ id: r.id, svg: null, error: 'render failed' }))];
  }

  const byId = new Map(drawn.map((d) => [d.id, d]));
  logger.info('[Diagram] schémas dessinés', { asked: requests.length, drawn: drawn.filter((d) => d.svg).length, ms: Date.now() - started });
  return [
    ...refused,
    ...accepted.map((r) => {
      const d = byId.get(r.id);
      return d?.svg ? { id: r.id, svg: cleanSvg(d.svg) } : { id: r.id, svg: null, error: d?.error || 'not rendered' };
    }),
  ];
}

export { DIAGRAM_KINDS, DIAGRAM_GUIDE, diagramKindOf, brandMermaidTheme } from './diagramTheme';
export type { DiagramKind, DiagramPalette } from './diagramTheme';
