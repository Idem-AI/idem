import { SelectedMockupSupport } from '../mockupAnalyzer.service';

/**
 * Les deux prompts de la mise en situation de marque, et une seule idée : le
 * modèle d'image ne dessine JAMAIS le logo.
 *
 * Il photographie un support NU en réservant une zone de marquage ; le vrai
 * logo y est incrusté ensuite par composition (cf. `brandMockup.service.ts`).
 * Décrire le logo au modèle lui faisait dessiner un logo approchant — sur un
 * livrable de marque, où le logo doit être exact au pixel près, c'est
 * inacceptable.
 *
 * Le second prompt est celui de la vision : il relit la scène produite pour
 * dire OÙ poser le logo. Sans lui, l'incrustation retombait au centre
 * géométrique de l'image, c'est-à-dire à côté du support une fois sur deux.
 */
export const MOCKUP_GENERATION_PROMPT = {
  /**
   * Consigne de vision : localiser la zone de marquage sur la scène générée.
   *
   * La réponse attendue est un JSON minuscule (une zone normalisée + le ton de
   * la surface + son inclinaison), parce que c'est exactement ce dont la
   * composition a besoin : où, à quelle taille, quelle encre, quel angle.
   */
  brandingZoneVision: `You are given a photograph of an UNBRANDED product staged for a brand mockup.
Locate the ONE area where the brand logo should be printed: the flat, evenly lit,
unobstructed part of the product that faces the camera, and where a real logo
would actually go on this kind of support.

Answer with ONE JSON object and nothing else — no prose, no markdown fence:
{"x":0.34,"y":0.28,"width":0.30,"height":0.18,"surface":"light","rotation":-3,"confidence":0.86}

- x, y: top-left corner of that area, as fractions of image width and height (0-1).
- width, height: its size, as fractions of image width and height (0-1).
- surface: "light" if that area is bright, so dark ink reads on it; "dark" if that
  area is dark, so light ink reads on it.
- rotation: apparent tilt of that area in degrees, positive clockwise, between -45
  and 45. Use 0 when it faces the camera squarely.
- confidence: 0-1, how sure you are that this is the right place to print.

Rules:
- The area must be INSIDE the product. Never on the background, never on a prop.
- Keep it to the part that is genuinely flat and unobstructed: exclude seams, folds,
  buttons, handles, straps, curved edges and strong specular highlights.
- If the product offers no usable printing area, answer exactly {"confidence":0}.`,

  buildDynamicPrompt: (params: {
    /**
     * `blank` : la scène sort VIERGE, le logo est incrusté après (fournisseurs
     * sans image en entrée). `attached` : le logo est joint à l'appel et le
     * modèle le pose lui-même. Le défaut est `blank`, qui était le seul
     * comportement.
     */
    logoMode?: 'blank' | 'attached';
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string };
    projectDescription: string;
    selectedSupport: SelectedMockupSupport;
    pdfFormat?: string;
    /** Fragment de rendu issu de la direction artistique (anglais, rendu uniquement). */
    artDirectionModifier?: string;
    /** Prompt négatif du style retenu. */
    artDirectionNegative?: string;
    /** Nom lisible du style, pour situer la consigne. */
    artDirectionName?: string;
  }) => {
    const {
      brandName,
      brandColors,
      projectDescription,
      selectedSupport,
      pdfFormat,
      artDirectionModifier,
      artDirectionNegative,
      artDirectionName,
      logoMode = 'blank',
    } = params;

    // ── DEUX CHEMINS, DEUX CONSIGNES ─────────────────────────────────────────
    //
    // Ce prompt a été écrit pour un fournisseur qui n'accepte PAS d'image en
    // entrée : la scène y sort vierge, et le vrai logo est incrusté ensuite au
    // pixel près. D'où « BLANK, UNBRANDED », répété dans l'objectif, dans une
    // règle dédiée et dans les interdits.
    //
    // Le chemin Gemini, lui, REÇOIT le logo en pièce jointe et doit le poser
    // lui-même. Il recevait pourtant ce même prompt, suivi d'un « place le logo
    // joint » ajouté à la fin. Le modèle lisait donc trois fois « aucun logo »
    // et une fois « pose le logo » : il produisait un support nu, ce qui est
    // exactement ce qu'on lui demandait le plus fort.
    //
    // Les deux modes sont donc rendus explicites ici, dans le fichier qui
    // possède le texte, plutôt que rafistolés par une phrase ajoutée en aval.
    const branded = logoMode === 'attached';

    const formatSpecs =
      pdfFormat === 'A4_PORTRAIT'
        ? {
            orientation: 'PORTRAIT (VERTICAL)',
            dimensions: '210mm × 297mm',
            aspectRatio: '1:1.414 (A4 portrait)',
            imageSize: '2480px × 3508px',
            description: 'Vertical format. The image MUST be vertical.',
            criticalInstructions:
              'CRITICAL: PORTRAIT orientation is mandatory. Ratio 1:1.414. Tight vertical framing so the subject fills the full height.',
          }
        : {
            orientation: 'LANDSCAPE (HORIZONTAL)',
            dimensions: '297mm × 167mm',
            aspectRatio: '16:9 (landscape)',
            imageSize: '2480px × 1395px',
            description: 'Horizontal format. The image MUST be horizontal.',
            criticalInstructions:
              'CRITICAL: LANDSCAPE orientation is mandatory. Ratio 16:9. Wide horizontal framing so the subject fills the full width.',
          };

    const supportExamples = selectedSupport.examples.map((ex) => `  - ${ex}`).join('\n');

    const priorityText =
      selectedSupport.priority === 'primary'
        ? 'PRIMARY SUPPORT (the most iconic one for this brand)'
        : 'SECONDARY SUPPORT (complementary but relevant)';

    return `<role>Elite commercial photographer and art director specialised in staging brands.</role>
<objective>Create one photorealistic, high-end professional mockup photograph of ${
      branded
        ? 'a support CARRYING THE ATTACHED BRAND LOGO, printed on it as it would really be produced'
        : 'a BLANK, UNBRANDED support, ready to receive a printed logo'
    }.</objective>

<brand_context>
- Name: "${brandName}"
- Industry: ${selectedSupport.industryContext}
- Colours: primary ${brandColors.primary}, secondary ${brandColors.secondary}, accent ${brandColors.accent}
- Description: ${projectDescription}
</brand_context>

<mockup_mission>
Mockup index: #${selectedSupport.mockupIndex}
Priority: ${priorityText}
Support name: ${selectedSupport.supportName}

Supports to create, as examples:
${supportExamples}

Staging:
${selectedSupport.context}
</mockup_mission>

${branded ? `<logo_placement_rule>
THE ATTACHED IMAGE IS THE BRAND LOGO. It is printed on the support in this
photograph — reproduce it EXACTLY as supplied: same shapes, same proportions,
same colours, same spacing. Do not redraw it, restyle it, simplify it, add an
outline, or invent any element of it. It is the one thing in the frame that must
be literally correct.

Print it where the mark genuinely goes on this kind of support (chest of a
garment, front face of a box, door panel of a vehicle, front of a card…), on a
surface that is:
- flat and unbroken: no seam, fold, button, zip, strap or curved edge across it;
- facing the camera as squarely as the staging allows;
- evenly lit: no hard specular highlight, no cast shadow, no reflection over it;
- one plain uniform tone, so the mark reads clearly.

The logo follows the perspective and the lighting of the scene, at the size a
real print would have — roughly a quarter of the support's visible face. It is
the ONLY mark on the support: no second logo, no invented wordmark, no slogan,
no legible text of any kind beside it.

Everything AROUND it stays a full photograph: material, texture, wear, depth of
field, real environment.
</logo_placement_rule>` : `<blank_support_rule>
The support carries NO branding at all: no logo, no monogram, no wordmark, no brand
name, no initial, no slogan, no printed pattern, no label, no sticker, no legible
text of any kind on it. The real logo is composited onto this photograph afterwards
at pixel accuracy — anything you draw in its place collides with it and ruins the
image.

Instead, RESERVE one printing area on the support, and stage the shot around it:
- It sits where the brand mark genuinely goes on this kind of support (chest of a
  garment, front face of a box, door panel of a vehicle, front of a card…).
- It is flat and unbroken: no seam, fold, button, zip, strap, handle or curved edge
  crossing it.
- It faces the camera as squarely as the staging allows.
- It is evenly lit: no hard specular highlight, no cast shadow, no reflection over it.
- It is one plain uniform tone, chosen so a logo reads clearly on it.
- It is large and unmistakable — roughly a third of the frame — and near the centre.

Everything AROUND that area stays a full photograph: material, texture, wear,
depth of field, real environment.
</blank_support_rule>`}

${
      artDirectionModifier
        ? `<art_direction>
This brand has a settled art direction${artDirectionName ? `: ${artDirectionName}` : ''}. It decides the RENDER of this photograph — light, material, grading, framing — and overrides the generic photographic settings below wherever they diverge. The subject, however, stays the support being shown.
Expected render (apply literally): ${artDirectionModifier}
${artDirectionNegative ? `Keep out of the image: ${artDirectionNegative}` : ''}
This photograph will be seen next to the brand's other supports: it must carry the SAME light and the SAME grading as they do.
</art_direction>

`
        : ''
    }<photographic_rules>
1. ABSOLUTE PHOTOGRAPHIC REALISM: a real commercial photograph (no digital illustration, no artificial 3D render). Subtle grain, natural imperfections.
2. LIGHTING: realistic studio or natural light, soft shadows, reflections on glass, metal or plastic — but the printing area stays evenly lit.
3. COMPOSITION: rule of thirds, cinematic depth of field (blurred background). The support is the hero, sharp, and clearly visible.
4. TEXTURES: visible fabric fibres, paper grain, metallic sheen, slight natural wear.
5. COLOUR: subtle, harmonious integration of the brand colours (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent}) into the scene and the material of the support.
6. CONTEXT: a coherent environment (${selectedSupport.industryContext}). No visual distraction.
</photographic_rules>

<format_rules>
- Orientation: ${formatSpecs.orientation}
- Dimensions: ${formatSpecs.dimensions}
- Ratio: ${formatSpecs.aspectRatio}
- Resolution: ${formatSpecs.imageSize}
- Rule: ${formatSpecs.description}
- ${formatSpecs.criticalInstructions}
- The image must cover 100% of the height and width (FULL-PAGE, no white borders).
</format_rules>

<forbidden>
${
      branded
        ? '- Any SECOND mark: an invented wordmark, a slogan, a made-up brand name, or readable text other than the supplied logo.'
        : '- ANY logo, wordmark, brand name, monogram, initial or readable text printed on the support. The support is blank.'
    }
- The generic mockup cliché: "a business card lying at an angle on a white marble desk next to a green plant" is THE default render of every generator. Compose something else.
- Artificial, plastic, over-lit 3D renders.
- An overloaded scene: one hero support, one context, nothing else.
- Watermarks, distorted text, generation artefacts, oversaturated HDR.
${artDirectionNegative ? `- ${artDirectionNegative}` : ''}
</forbidden>

GENERATE THE PHOTOREALISTIC IMAGE ONLY. NO TEXT RESPONSE.`;
  },
};
