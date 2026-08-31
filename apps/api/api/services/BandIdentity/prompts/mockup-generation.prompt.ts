import { SelectedMockupSupport } from '../mockupAnalyzer.service';

/**
 * Système de prompts dynamiques pour la génération de mockups photoréalistes
 */

export const MOCKUP_GENERATION_PROMPT = {
  logoInstructions: (brandName: string) => ({
    withLogo: `<logo_rules>
- An image of this brand's exact logo is supplied.
- Study every detail of the supplied logo image and reproduce it EXACTLY in the scene.
- Preserve all original shapes, colours, typography and proportions.
- Place the logo visibly and legibly on the support. Do not alter or translate the text inside the logo.
- Choose a balanced size (neither invisible nor overwhelming).
</logo_rules>`,

    withoutLogo: `<logo_rules>
- No logo image is supplied.
- Set the brand name "${brandName}" in a clean, professional typographic style using the brand colours.
</logo_rules>`,
  }),

  buildDynamicPrompt: (params: {
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string };
    projectDescription: string;
    hasLogo: boolean;
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
      hasLogo,
      selectedSupport,
      pdfFormat,
      artDirectionModifier,
      artDirectionNegative,
      artDirectionName,
    } = params;

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

    const logoInstruction = hasLogo
      ? MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withLogo
      : MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withoutLogo;

    const supportExamples = selectedSupport.examples
      .map((ex, idx) => `  - ${ex}`)
      .join('\n');

    const priorityText =
      selectedSupport.priority === 'primary'
        ? 'PRIMARY SUPPORT (the most iconic one for this brand)'
        : 'SECONDARY SUPPORT (complementary but relevant)';

    return `<role>Elite commercial photographer and art director specialised in staging brands.</role>
<objective>Create one photorealistic, high-end professional mockup photograph.</objective>

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

${logoInstruction}

Supports to create, as examples:
${supportExamples}

Staging:
${selectedSupport.context}
</mockup_mission>

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
2. LIGHTING: realistic studio or natural light, soft shadows, reflections on glass, metal or plastic.
3. COMPOSITION: rule of thirds, cinematic depth of field (blurred background). The branded support is the hero and is clearly visible.
4. TEXTURES: visible fabric fibres, paper grain, metallic sheen, slight natural wear.
5. COLOUR: subtle, harmonious integration of the brand colours (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent}) into the scene.
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
- The generic mockup cliché: "a business card lying at an angle on a white marble desk next to a green plant" is THE default render of every generator. Compose something else.
- Artificial, plastic, over-lit 3D renders.
- Any logo other than the one supplied.
- An overloaded scene: one hero support, one context, nothing else.
- Watermarks, distorted text, generation artefacts, oversaturated HDR.
${artDirectionNegative ? `- ${artDirectionNegative}` : ''}
</forbidden>

GENERATE THE PHOTOREALISTIC IMAGE ONLY. NO TEXT RESPONSE.`;
  },
};
