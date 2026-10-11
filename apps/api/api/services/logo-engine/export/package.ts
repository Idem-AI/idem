/**
 * L'EXPORT — le livrable d'un logo : fichiers vectoriels autonomes, aperçus, source rééditable.
 *
 *   logo.svg                    principal, autonome, redimensionnable, fond transparent
 *   logo-monochrome.svg         noir (fond clair) ; logo-monochrome-white.svg blanc (fond sombre)
 *   logo-inverted.svg           couleurs relevées pour fond sombre
 *   logo-symbol.svg             le symbole seul (quand il existe) ; logo-wordmark.svg le nom seul
 *   logo-<variante>.svg         les variantes dynamiques déclarées par le document
 *   previews/*.png              aperçus à plusieurs résolutions, sur fond clair et sombre, + tailles favicon
 *   logo.json                   le Logo IR source : rouvrir et modifier le concept plus tard
 *
 * Un fichier n'est écrit que s'il est valide : chaque SVG repasse par la validation technique.
 */
import JSZip from 'jszip';
import type { LogoDocument } from '../ir/logo.schema';
import { LOGO_IR_VERSION } from '../ir/logo.schema';
import type { LogoSession } from '../render/build';
import { DARK_BACKGROUND } from '../render/svg';
import { renderVariants } from '../render/variants';
import { defaultRasterizer, renderPng } from '../raster/rasterizer';
import type { Rasterizer } from '../raster/rasterizer';
import { allowedColors } from '../validate/assess';
import { validateSvgTechnical } from '../validate/technical';
import type { QualityReport } from '../validate/assess';

export interface LogoExport {
  files: Record<string, Buffer | string>;
  /** Fichiers refusés par la validation (jamais écrits). */
  skipped: { file: string; reason: string }[];
  manifest: { version: typeof LOGO_IR_VERSION; brand: string; type: string; files: string[]; quality?: { score: number; accepted: boolean } };
}

export interface ExportOptions {
  /** Largeurs des aperçus PNG (défaut : 1024 et 512). */
  previewWidths?: number[];
  rasterizer?: Rasterizer;
  report?: QualityReport;
  /** Écrit aussi les aperçus PNG (défaut : oui). */
  previews?: boolean;
}

const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function exportLogoPackage(session: LogoSession, options: ExportOptions = {}): Promise<LogoExport> {
  const rasterizer = options.rasterizer ?? defaultRasterizer();
  const doc: LogoDocument = session.doc;
  const files: LogoExport['files'] = {};
  const skipped: LogoExport['skipped'] = [];
  const palette = allowedColors(session);

  const put = async (name: string, svg: string): Promise<boolean> => {
    const check = await validateSvgTechnical(svg, { palette, rasterizer });
    if (!check.ok) {
      skipped.push({ file: name, reason: check.defects.filter((d) => d.severity === 'blocker').map((d) => d.message).join(' ') });
      return false;
    }
    files[name] = svg;
    return true;
  };

  const main = session.render();
  if (!main) throw new Error('Le logo ne produit aucune forme : rien à exporter.');
  await put('logo.svg', main.svg);

  for (const variant of renderVariants(session)) {
    const name = ({ primary: null, monochrome: 'logo-monochrome.svg', inverted: 'logo-inverted.svg', symbol: 'logo-symbol.svg', wordmark: 'logo-wordmark.svg', dynamic: `logo-${slug(variant.id)}.svg` } as const)[variant.kind];
    if (name) await put(name, variant.svg);
  }
  const white = session.render({ mode: 'mono', monoColor: '#ffffff' });
  if (white) await put('logo-monochrome-white.svg', white.svg);

  if (options.previews !== false) {
    const widths = options.previewWidths ?? [1024, 512];
    const dark = files['logo-inverted.svg'] as string | undefined;
    for (const w of widths) {
      files[`previews/logo-${w}-light.png`] = await renderPng(main.svg, w, '#ffffff', rasterizer);
      if (dark) files[`previews/logo-${w}-dark.png`] = await renderPng(dark, w, DARK_BACKGROUND, rasterizer);
    }
    const symbol = (files['logo-symbol.svg'] as string | undefined) ?? main.svg;
    for (const size of [256, 64, 32, 24]) files[`previews/symbol-${size}.png`] = await renderPng(symbol, size, null, rasterizer);
  }

  files['logo.json'] = JSON.stringify({ format: 'idem-logo-ir', version: LOGO_IR_VERSION, document: doc, ...(options.report ? { quality: { score: options.report.score, accepted: options.report.accepted, metrics: options.report.metrics } } : {}) }, null, 2);

  return {
    files,
    skipped,
    manifest: { version: LOGO_IR_VERSION, brand: doc.brief.brandName, type: doc.concept.type, files: Object.keys(files).sort(), ...(options.report ? { quality: { score: options.report.score, accepted: options.report.accepted } } : {}) },
  };
}

/** L'archive ZIP du livrable. */
export async function zipExport(exported: LogoExport): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(exported.files)) zip.file(name, content);
  zip.file('manifest.json', JSON.stringify(exported.manifest, null, 2));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/** Relit un `logo.json` : le document, prêt à être rouvert dans le moteur. */
export function readLogoJson(text: string): unknown {
  const parsed = JSON.parse(text) as { format?: string; document?: unknown };
  if (parsed.format !== 'idem-logo-ir' || !parsed.document) throw new Error('Ce fichier n\'est pas un logo.json du moteur IDEM.');
  return parsed.document;
}
