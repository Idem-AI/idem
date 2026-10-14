import { supportScene } from '../../../config/mockup.config';
import type { SelectedMockupSupport } from '../mockupAnalyzer.service';

/**
 * Les deux prompts de la mise en situation de marque, et une seule idée : le
 * modèle d'image ne lit JAMAIS un mot qui l'invite à écrire.
 *
 * Il photographie un support NU ; le vrai logo y est incrusté ensuite par
 * composition (cf. `brandMockup.service.ts`). L'ancienne consigne répétait une
 * dizaine de fois « no logo, no wordmark, no brand name, no text » et parlait
 * de « mockup » : un modèle d'image retient le mot, pas la négation. Il écrivait
 * donc un nom sur le support — pour la marque Light, un « LIGGTH » tiré de
 * « side light » — et le logo incrusté se posait dessus. Le prompt décrit
 * désormais un objet LISSE, en termes positifs, sans la description du projet
 * ni aucun mot du champ de l'écrit.
 *
 * Le second prompt est celui de la vision : il relit la scène produite, dit si
 * elle porte malgré tout des lettres ou une marque — elle est alors régénérée —
 * et où poser le logo.
 */

/**
 * Les mots qui font écrire un modèle d'image. Aucun ne doit l'atteindre, pas
 * même nié (vérifié par `checkPromptConformity`).
 */
export const TEXT_INVITING_WORDS =
  /\b(logos?|logotypes?|brands?|branded|branding|wordmarks?|monograms?|emblems?|mock-?ups?|slogans?|texts?|typography|typographic|typefaces?|fonts?|letters?|lettering|labels?|stickers?|signage|captions?|headlines?|names?)\b/i;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Garde d'un fragment ce qui décrit l'image, et rien de ce qui la ferait écrire.
 *
 * Les fragments de direction artistique sont écrits pour un designer : ils
 * parlent volontiers de typographie ou de logo, et citent la marque. Chaque
 * segment qui le fait est retiré ENTIER — le couper au mot laisserait une
 * phrase boiteuse, que le modèle compléterait à sa façon.
 *
 * Le nom est cherché tel qu'écrit, capitalisé ou en capitales : « Light » est
 * retiré, la « side light » d'un éclairage est gardée.
 */
function keepImageWords(fragment: string | undefined, brandName: string | undefined, max: number): string {
  const name = (brandName ?? '').trim();
  const spellings = [name, name.charAt(0).toUpperCase() + name.slice(1), name.toUpperCase()];
  const namePattern =
    name.length >= 2
      ? new RegExp(`(?<![\\p{L}\\p{N}])(${[...new Set(spellings)].map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'u')
      : null;

  const kept: string[] = [];
  let length = 0;
  for (const segment of (fragment ?? '').split(/[,;.\n]+/)) {
    const part = segment.trim();
    if (!part || TEXT_INVITING_WORDS.test(part) || namePattern?.test(part)) continue;
    if (length + part.length > max) break;
    kept.push(part);
    length += part.length + 2;
  }
  return kept.join(', ');
}

/** La scène du support (nue) : commune à la photo nue et à la photo imprimée du logo. */
const buildScene = (params: {
    brandColors: { primary: string; secondary: string; accent: string };
    selectedSupport: SelectedMockupSupport;
    pdfFormat?: string;
    /** Sert à retirer les fragments qui citent la marque. Jamais écrit dans le prompt. */
    brandName?: string;
    /** Fragment de rendu issu de la direction artistique (anglais, rendu uniquement). */
    artDirectionModifier?: string;
    /** Prompt négatif du style retenu. */
    artDirectionNegative?: string;
    /** Sujets de la direction artistique : photographie d'univers seulement. */
    imagerySubjects?: string;
    /** La photo portera l'œuvre jointe en référence (scène IMPRIMÉE) : seules les AUTRES surfaces restent nues. */
    printed?: boolean;
  }): string => {
    const { brandColors, selectedSupport, pdfFormat, brandName } = params;

    // La photographie d'univers n'a pas de support à marquer : elle montre le
    // sujet, la matière et la lumière de la marque.
    const imagery = Boolean(selectedSupport.skipLogo);
    const world = selectedSupport.industryContext;
    const frame = pdfFormat === 'A4_PORTRAIT' ? 'vertical 3:4 frame' : 'wide horizontal 16:9 frame';

    const subjects = keepImageWords(params.imagerySubjects, brandName, 200);
    const setting = '';
    const subject = imagery
      ? `a candid lifestyle photograph ${setting ? `in ${setting}` : `from the world of ${world}`}${subjects ? `, showing ${subjects}` : ''}`
      : (supportScene(selectedSupport.supportType) ?? 'a plain object with smooth, uniform surfaces');
    // Style du catalogue.
    const render = keepImageWords(params.artDirectionModifier, brandName, 560);
    const avoid = [
      keepImageWords(params.artDirectionNegative, brandName, 200),
      'watermark, illustration, 3D render, plastic look, oversaturated HDR, extra fingers',
    ]
      .filter(Boolean)
      .join(', ');

    const lines = [
      `Photorealistic commercial photograph, ${frame}, full bleed.`,
      '',
      `Subject: ${subject}.`,
      `Setting: ${setting || `a real place from the world of ${world}`}; one hero subject, shallow depth of field.`,
    ];
    if (!imagery) {
      lines.push(
        'The hero object faces the camera. Its main face is flat, evenly lit, a single uniform colour, large in the frame and near the centre.'
      );
    }
    lines.push(`Colours: ${brandColors.primary}, ${brandColors.secondary} and ${brandColors.accent}, carried by the materials and the set.`);
    if (render) lines.push(`Render: ${render}.`);
    lines.push(
      '',
      imagery
        ? 'Clothes, walls and objects are plain and undecorated, with nothing written or drawn on them. Books, papers, screens and shopfronts stay out of the frame.'
        : params.printed
          ? 'Apart from that single print on the main face, every surface is plain and undecorated: bare material and uniform colour.'
          : 'Every surface is plain and undecorated: bare material and uniform colour, with nothing written or drawn on it.',
      `Avoid: ${avoid}.`
    );

    return lines.join('\n');
  };

export const MOCKUP_GENERATION_PROMPT = {
  /**
   * Consigne de vision : la scène porte-t-elle des lettres ou une marque, et où
   * imprimer le logo ?
   *
   * La zone est demandée en BOÎTE, en coordonnées entières de 0 à 1000. Les
   * deux formes précédentes échouaient : en fractions avec un exemple chiffré,
   * la vision recopiait l'exemple (le logo tombait au même endroit sur chaque
   * photo, en travers d'une anse) ; en fractions sans exemple, elle rendait des
   * zéros. En boîte 0–1000, mesuré sur quatre scènes : quatre boîtes posées sur
   * le produit.
   */
  sceneReadingVision: `You are given a product photograph.
1. Is there ANY lettering, number, logo, monogram, emblem or brand mark visible anywhere in the photograph (on the product, on a prop, on a sign, a screen, a book or in the background), even small, blurred or misspelled? Stitching, seams, hardware and material texture do not count.
2. Find the largest flat, evenly lit, unobstructed area on ONE face of the hero product: the place where a printed mark would go. It lies inside that single face, never across an edge or a corner between two faces, and clear of handles, ropes, straps, folds, tape, flaps and highlights.

Answer with ONE JSON object and nothing else, no prose, no markdown fence:
{"markings": true or false, "box": [x1, y1, x2, y2], "surface": "light" or "dark", "rotation": degrees}
- box: top-left and bottom-right corners of that area, as integers from 0 to 1000 relative to the photograph's width and height; null when the product offers no such area.
- surface: "light" when the area is bright, so dark ink reads on it; "dark" when it is dark, so light ink reads on it.
- rotation: apparent tilt of that area in degrees, positive clockwise, from -45 to 45; 0 when it faces the camera.`,

  /**
   * Relecture d'une mise en situation faite AVEC le logo : à gauche l'œuvre de référence, à droite la photo.
   * Le logo doit y être reconnaissable (formes, caractères, couleurs) et rien d'autre ne doit être écrit.
   */
  logoCheckVision: `You are given ONE image made of two panels. LEFT panel: a reference artwork (a brand mark). RIGHT panel: a product photograph.
1. Is the LEFT artwork reproduced on the product in the RIGHT photograph, and how faithfully: same shapes, same characters spelled the same way, same colours, same proportions? Score 0 (absent or unrecognisable) to 10 (identical, as if printed from the file).
2. Is there ANY OTHER lettering, number, mark or emblem in the RIGHT photograph, besides that reproduction?
Answer with ONE JSON object and nothing else: {"faithful": 0-10, "otherMarkings": true or false}`,

  /**
   * La scène AVEC le logo : la référence jointe à l'appel est l'œuvre de la marque, à reproduire telle quelle
   * sur la face principale du support. Le prompt reste sans mot qui invite à écrire : seule la référence porte
   * des caractères, le modèle les recopie au lieu d'en inventer.
   */
  buildPrintedScenePrompt: (params: Parameters<typeof buildScene>[0]): string => {
    const scene = buildScene({ ...params, printed: true });
    return [
      scene,
      '',
      'The attached reference image is the exact artwork to print on the main face of the hero object: reproduce it faithfully — identical shapes, identical characters, identical colours and proportions, nothing redrawn or reinterpreted — as a real print suited to the material (ink, embroidery, emboss or engraving), centred on that face, about one third of its width, following its perspective, lighting and texture.',
      'It is the ONLY mark in the photograph: every other surface stays bare.',
    ].join('\n');
  },

  buildDynamicPrompt: (params: Parameters<typeof buildScene>[0]): string => buildScene(params),
};
