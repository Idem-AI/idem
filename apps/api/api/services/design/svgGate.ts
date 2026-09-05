/**
 * Grille DÉTERMINISTE sur un SVG de logo.
 *
 * Même principe que `quality-gate.ts` pour le HTML : avant de payer un modèle
 * pour juger un autre modèle, on regarde ce que du code constate tout seul.
 *
 * Un SVG non parsable, sans `viewBox`, saturé de chemins, bourré de texte non
 * vectorisé ou peint hors palette n'a pas besoin d'un critique : le défaut est
 * FACTUEL. L'envoyer quand même à la critique IA coûte un aller-retour complet
 * (10 à 20 s, un appel facturé) pour un verdict qu'une expression régulière
 * rendait gratuitement — et le verdict IA revient parfois « pass » sur un SVG
 * cassé, ce qui est le pire des deux mondes.
 *
 * Cette grille ne juge JAMAIS l'esthétique : elle ne dit pas si le logo est
 * beau, seulement s'il est exploitable. La critique IA garde tout le reste.
 */

export type SvgDefectCode =
  | 'empty'
  | 'not_svg'
  | 'unparsable'
  | 'no_viewbox'
  | 'raster_embedded'
  | 'live_text'
  | 'path_explosion'
  | 'off_palette';

export interface SvgDefect {
  code: SvgDefectCode;
  message: string;
}

export interface SvgGateReport {
  ok: boolean;
  defects: SvgDefect[];
  /** Résumé d'une ligne, réinjectable dans un prompt de révision. */
  summary: string;
}

/**
 * Au-delà, le tracé n'est plus une construction paramétrique mais un calque
 * vectorisé à main levée : illisible en petit, impossible à décliner.
 */
const MAX_PATHS = 60;

/** Balises qui trahissent une image matricielle déguisée en vectoriel. */
const RASTER_RE = /<image\b|xlink:href\s*=\s*["']data:image\/(png|jpe?g|webp)/i;

/**
 * Un `<text>` vivant dépend d'une police installée : il se rendra différemment
 * partout, et disparaîtra à l'export. Le wordmark doit être vectorisé.
 */
const LIVE_TEXT_RE = /<text\b/i;

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

function normaliseHex(hex: string): string {
  const value = hex.toLowerCase();
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

/** Noir, blanc et gris neutres : légitimes dans toute déclinaison. */
const NEUTRALS = new Set([
  '#000000',
  '#ffffff',
  '#fafafa',
  '#f5f5f5',
  '#eeeeee',
  '#cccccc',
  '#999999',
  '#666666',
  '#333333',
  '#111111',
]);

export interface SvgGateOptions {
  /** Valeurs hexadécimales de la charte. Vide ⇒ le contrôle de palette est ignoré. */
  palette?: string[];
}

/**
 * Inspecte un SVG. Ne lève jamais : un contrôle qui plante ne doit pas casser
 * une génération par ailleurs valide.
 */
export function inspectSvg(svg: string, options: SvgGateOptions = {}): SvgGateReport {
  const defects: SvgDefect[] = [];
  const source = (svg ?? '').trim();

  const add = (code: SvgDefectCode, message: string) => defects.push({ code, message });

  if (source.length === 0) {
    add('empty', 'SVG vide.');
    return finalize(defects);
  }

  if (!/<svg[\s>]/i.test(source)) {
    add('not_svg', "La sortie ne contient pas de balise <svg>.");
    return finalize(defects);
  }

  // Balise ouvrante non refermée, ou racine non close : troncature nette.
  const opened = (source.match(/<svg\b/gi) || []).length;
  const closed = (source.match(/<\/svg>/gi) || []).length;
  if (opened !== closed || /<[^>]*$/.test(source)) {
    add('unparsable', 'SVG tronqué : la balise racine n\'est pas refermée.');
  }

  if (!/viewBox\s*=\s*["'][^"']+["']/i.test(source)) {
    add(
      'no_viewbox',
      'viewBox absent : le logo ne peut pas être mis à l\'échelle ni décliné proprement.'
    );
  }

  if (RASTER_RE.test(source)) {
    add('raster_embedded', 'Image matricielle embarquée : ce n\'est pas un logo vectoriel.');
  }

  if (LIVE_TEXT_RE.test(source)) {
    add(
      'live_text',
      'Texte non vectorisé (<text>) : le rendu dépendra de la police installée et disparaîtra à l\'export.'
    );
  }

  const pathCount = (source.match(/<path\b/gi) || []).length;
  if (pathCount > MAX_PATHS) {
    add(
      'path_explosion',
      `${pathCount} tracés (maximum ${MAX_PATHS}) : construction à main levée plutôt que paramétrique, illisible en petit format.`
    );
  }

  const palette = (options.palette ?? []).map(normaliseHex).filter(Boolean);
  if (palette.length > 0) {
    const stray = new Set<string>();
    for (const raw of source.match(HEX_RE) || []) {
      const hex = normaliseHex(raw);
      if (!palette.includes(hex) && !NEUTRALS.has(hex)) stray.add(hex);
    }
    if (stray.size > 0) {
      add(
        'off_palette',
        `Couleurs hors charte : ${[...stray].slice(0, 6).join(', ')}.`
      );
    }
  }

  return finalize(defects);
}

function finalize(defects: SvgDefect[]): SvgGateReport {
  return {
    ok: defects.length === 0,
    defects,
    summary:
      defects.length === 0
        ? 'Aucun défaut mécanique.'
        : defects.map((d) => `[${d.code}] ${d.message}`).join(' | '),
  };
}
