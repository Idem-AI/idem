/**
 * Les illustrations simples, dessinées par le modèle de texte en SVG.
 *
 * Une illustration à plat (une scène, un objet, un geste) n'a pas besoin d'un
 * modèle d'image : un SVG de quelques formes, aux couleurs exactes de la
 * charte, est plus net, plus léger, gratuit, et s'affiche à toutes les tailles.
 * Le modèle le dessine ; le code vérifie qu'il n'y a ni script, ni texte, ni
 * ressource externe, et qu'il y a bien un dessin.
 */

import { ModelCaller, Verdict } from '../modelCaller.js';

export interface DrawingRequest {
  subject: string;
  /** Couleurs autorisées, la première est la couleur de marque. */
  palette: string[];
  /** Fond du panneau où le dessin s'affiche. */
  ground: string;
  aspect: '16:9' | '4:3' | '1:1' | '3:4';
  /** Indication de style tirée de la charte. */
  style: string;
}

const VIEWBOX: Record<DrawingRequest['aspect'], [number, number]> = {
  '16:9': [640, 360],
  '4:3': [480, 360],
  '1:1': [400, 400],
  '3:4': [360, 480],
};

const MAX_BYTES = 40_000;
const FORBIDDEN = /<script|<foreignObject|<image|<iframe|<text|<use\b|\son\w+\s*=|javascript:|data:|@import|xlink:href\s*=\s*["'](?!#)|\shref\s*=\s*["'](?!#)/i;
const SHAPES = /<(path|circle|ellipse|rect|polygon|polyline|line)\b/gi;

/** Le dessin, s'il est sûr et réel ; une raison de refus sinon. */
export function sanitizeSvg(text: string): { svg: string } | { problem: string } {
  const start = text.search(/<svg[\s>]/i);
  const end = text.lastIndexOf('</svg>');
  if (start === -1 || end <= start) return { problem: 'Aucun élément <svg> complet dans la réponse.' };

  let svg = text.slice(start, end + '</svg>'.length).trim();
  if (svg.length > MAX_BYTES) return { problem: 'Le dessin est trop lourd : simplifie-le (moins de 60 formes).' };
  if (FORBIDDEN.test(svg)) {
    return { problem: 'Le dessin contient un élément interdit (texte, image, script, lien ou ressource externe). Formes simples uniquement.' };
  }
  const shapes = svg.match(SHAPES)?.length ?? 0;
  if (shapes < 6) return { problem: 'Le dessin est presque vide : au moins une dizaine de formes qui composent une scène lisible.' };
  if (!/viewBox\s*=/.test(svg)) return { problem: "L'élément <svg> doit porter un viewBox." };

  if (!/xmlns\s*=/.test(svg)) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  // La taille est donnée par la mise en page, pas par le dessin.
  svg = svg.replace(/(<svg[^>]*?)\s(width|height)\s*=\s*["'][^"']*["']/gi, '$1');
  return { svg };
}

export async function drawIllustration(caller: ModelCaller, request: DrawingRequest, label: string): Promise<string | null> {
  const [width, height] = VIEWBOX[request.aspect];
  const system =
    'Tu es illustrateur. Tu dessines des illustrations à plat, simples et élégantes, directement en SVG. Tu réponds UNIQUEMENT par le code SVG, sans bloc de code ni commentaire.';
  const prompt = `Dessine : ${request.subject}

Contraintes :
- <svg viewBox="0 0 ${width} ${height}"> ; fond plein ${request.ground} sur tout le cadre (un <rect> en premier).
- Couleurs : uniquement ${request.palette.join(', ')} et le fond, avec leurs nuances par opacité (fill-opacity).
- Style : ${request.style}. Formes géométriques nettes, aplats, quelques traits (stroke-linecap="round"), composition centrée avec de l'air autour.
- 15 à 60 formes : path, circle, ellipse, rect, polygon, polyline, line, g. Pas de texte, pas de lettres, pas d'image, pas de dégradé complexe, pas de filtre.
- Une scène qui se comprend d'un coup d'œil, sans légende.`;

  const outcome = await caller.call(
    label,
    system,
    prompt,
    (text): Verdict<string> => {
      const result = sanitizeSvg(text);
      return 'svg' in result ? { value: result.svg } : { problem: `${result.problem} Renvoie UNIQUEMENT le SVG corrigé.` };
    },
    6000,
    0.6
  );
  return outcome.value;
}
