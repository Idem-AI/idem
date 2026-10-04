/**
 * LOGO VECTORIEL pour l'animation : nettoyage et analyse.
 *
 * Le SVG est posé EN LIGNE dans la page (pour animer chaque forme) : il passe
 * donc par SVGO avec une règle de sécurité maison — plus de script, d'objet
 * étranger, d'animation SMIL, d'attribut on*, de lien externe — et ses
 * identifiants sont préfixés (aucune collision avec la page). L'analyse dit au
 * graphe de capacités quelles animations le logo supporte.
 */
import { optimize } from 'svgo';

export interface LogoSvgInfo {
  /** SVG nettoyé, prêt à poser en ligne. */
  svg: string;
  /** Formes géométriques (path, circle, rect, ellipse, polygon, polyline, line). */
  shapes: number;
  /** Textes <text> (police dépendante : ni tracé ni morphose). */
  texts: number;
  /** Images matricielles embarquées (ni tracé ni morphose). */
  images: number;
  /** Dégradés et motifs. */
  paints: number;
  /** Le SVG n'est qu'un symbole (le nom sera écrit par le moteur). */
  isIcon: boolean;
}

const DANGEROUS = new Set(['script', 'foreignObject', 'iframe', 'object', 'embed', 'animate', 'animateMotion', 'animateTransform', 'set', 'audio', 'video', 'handler', 'listener']);

const idemSafe = {
  name: 'idemSafe',
  fn: () => ({
    element: {
      enter: (node: any, parent: any) => {
        if (DANGEROUS.has(node.name)) {
          parent.children = parent.children.filter((c: any) => c !== node);
          return;
        }
        for (const name of Object.keys(node.attributes)) {
          const value = String(node.attributes[name]);
          const isLink = name === 'href' || name === 'xlink:href';
          if (/^on/i.test(name) || (isLink && !value.startsWith('#') && !/^data:image\/(png|jpe?g|webp|gif);/i.test(value)) || /javascript:|url\(\s*['"]?(https?:|\/\/)/i.test(value)) {
            delete node.attributes[name];
          }
        }
        // <style> avec import ou URL distante : retiré.
        if (node.name === 'style' && node.children?.some((c: any) => /@import|url\(\s*['"]?(https?:|\/\/)/i.test(c.value || ''))) {
          parent.children = parent.children.filter((c: any) => c !== node);
        }
      },
    },
  }),
};

/** Nettoie un SVG pour l'insérer dans la page ; null s'il n'en reste rien d'utilisable. */
export function sanitizeLogoSvg(raw: string | undefined): string | null {
  if (!raw || !raw.includes('<svg')) return null;
  try {
    const out = optimize(raw, {
      multipass: false,
      plugins: [
        'removeXMLProcInst',
        'removeDoctype',
        'removeComments',
        'removeMetadata',
        'removeEditorsNSData',
        // Les couleurs portées par un bloc <style> passent dans les attributs (sinon tout noir).
        'inlineStyles',
        'convertStyleToAttrs',
        'removeDimensions',
        { name: 'prefixIds', params: { prefix: 'idemlogo', delim: '-' } },
        idemSafe as any,
      ],
    }).data;
    return /<(path|circle|rect|ellipse|polygon|polyline|line|text|image)\b/.test(out) && out.includes('viewBox') ? out : null;
  } catch {
    return null;
  }
}

const count = (svg: string, re: RegExp) => (svg.match(re) || []).length;

/** Nettoie et décrit le logo. Préfère le logo complet ; le symbole seul si le logo porte du texte. */
export function analyzeLogo(full: string | undefined, icon: string | undefined): LogoSvgInfo | null {
  const describe = (svg: string, isIcon: boolean): LogoSvgInfo => ({
    svg,
    shapes: count(svg, /<(path|circle|rect|ellipse|polygon|polyline|line)\b/g),
    texts: count(svg, /<text\b/g),
    images: count(svg, /<image\b/g),
    paints: count(svg, /<(linearGradient|radialGradient|pattern)\b/g),
    isIcon,
  });
  const f = sanitizeLogoSvg(full);
  const i = sanitizeLogoSvg(icon);
  const fullInfo = f ? describe(f, false) : null;
  const iconInfo = i ? describe(i, true) : null;
  // Un <text> dépend d'une police qui n'est peut-être pas chargée : le symbole + le nom
  // écrit par le moteur dans la police de la charte est plus fidèle.
  if (fullInfo && (fullInfo.texts === 0 || !iconInfo)) return fullInfo;
  return iconInfo || fullInfo;
}
