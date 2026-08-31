/**
 * Prompts de génération du HTML d'affichage des mockups.
 *
 * Rédigés en anglais comme tous les prompts du projet ; la langue du CONTENU
 * produit (français) est une consigne parmi les autres.
 */

interface MockupHtmlGenerationParams {
  projectName: string;
  projectDescription: string;
  industry: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  mockups: Array<{
    url: string;
    title: string;
    description: string;
    supportType: string;
    priority: 'primary' | 'secondary';
  }>;
  logoUrl?: string;
  typography?: {
    primaryFont?: string;
    secondaryFont?: string;
  };
}

export const MOCKUP_HTML_GENERATION_PROMPT = {
  buildSingleMockupPrompt: (
    params: MockupHtmlGenerationParams & {
      mockup: {
        url: string;
        title: string;
        description: string;
        supportType: string;
        priority: 'primary' | 'secondary';
      };
      mockupIndex: number;
      totalMockups: number;
      typography?: {
        primaryFont?: string;
        secondaryFont?: string;
      };
    }
  ): string => {
    const {
      projectName,
      projectDescription,
      industry,
      brandColors,
      mockup,
      mockupIndex,
      totalMockups,
      typography,
    } = params;

    const primaryFont = typography?.primaryFont || 'Inter';
    const secondaryFont = typography?.secondaryFont || 'Inter';

    return `<objective>Generate a modern, one-off HTML page displaying the mockup "${mockup.title}" full-page, in 16:9 landscape.</objective>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
- Project: ${projectName}
- Description: ${projectDescription}
- Industry: ${industry}
- Brand colours: primary ${brandColors.primary}, secondary ${brandColors.secondary}, accent ${brandColors.accent}
- Typography: headings='${primaryFont}', body='${secondaryFont}'
- Mockup: ${mockup.title} (${mockup.supportType}, ${mockupIndex}/${totalMockups})
- Image URL: ${mockup.url}
</project_context>

<creative_guidelines>
1. BRAND CHARTER: use the brand colours (${brandColors.primary}, ${brandColors.secondary}) in the background gradient (no generic black). Apply the project typefaces.
2. DESCRIPTION: write a one-off description (15-25 words, in French) fitted to the industry and to the support (${mockup.supportType}).
3. DESIGN: bottom overlay with a transparent gradient. Main title + description + number. Balanced spacing.
</creative_guidelines>

<technical_structure>
- Container: width:100%, height:100%, position:relative, overflow:hidden, margin:0, padding:0.
- Mockup image: width:100%, height:100%, object-fit:cover.
- Description section: position:absolute, bottom:0, left:0, right:0.
- Typography: style="font-family: '${primaryFont}', '${secondaryFont}'".
- Contrast: WCAG AA compliant.
- Format: 16:9 LANDSCAPE (297mm × 167mm).
</technical_structure>

<rules>
- Inline CSS only (no external classes).
- No JavaScript.
- Output ONLY the HTML, with no markdown and no explanation.
</rules>`;
  },

  buildPrompt: (params: MockupHtmlGenerationParams): string => {
    const { projectName, projectDescription, industry, brandColors, mockups } = params;

    return `<role>Expert in visual identity design and web development.</role>
<objective>Generate a professional, elegant HTML page (210mm × 297mm A4) displaying the mockups of a brand guidelines document.</objective>

<project_context>
- Project: ${projectName}
- Description: ${projectDescription}
- Industry: ${industry}
- Brand colours: primary ${brandColors.primary}, secondary ${brandColors.secondary}, accent ${brandColors.accent}
- Mockups to display:
${mockups
  .map(
    (m, i) => `  ${i + 1}. ${m.title} (${m.priority}) - Type: ${m.supportType}, URL: ${m.url}`
  )
  .join('\n')}
</project_context>

<design_principles>
- A style fitted to the "${industry}" industry (e.g. tech = minimal, finance = sober and elegant, food = warm and vibrant, fashion = avant-garde).
- The mockups are the heroes of the page.
- Balanced layout (with 2 mockups: an asymmetric 60/35 split or a 50/50 vertical split).
- Elements: a "BRAND MOCKUPS" tag, a main title, a subtitle, a visible colour palette, border-radius (8-16px) and shadows on the images.
</design_principles>

<technical_rules>
- Container dimensions: A4 (w-[210mm] h-[297mm]), overflow-hidden, position relative, no min-h-screen.
- Inline CSS only. No external CSS classes. No JavaScript.
- All visible text in French. WCAG AA compliant.
</technical_rules>

<output_format>
Output ONLY the complete HTML (from <div style="..."> to </div>), with no markdown and no explanation.
</output_format>`;
  },

  systemPrompt: `You are an expert in modern design and visual identity. You generate inline-CSS HTML for mockups in FULL-PAGE 16:9 LANDSCAPE format, respecting the brand charter.

FULL-PAGE rules:
• Modern, striking, full-page design
• 16:9 LANDSCAPE format (297mm × 167mm)
• The mockup image covers 100% of the height AND the width (width:100%, height:100%, object-fit:cover)
• Container: position:relative, overflow:hidden, margin:0, padding:0

BRAND CHARTER rules:
• Overlay gradient built from the BRAND COLOURS (never generic black)
• Use the project TYPOGRAPHY (the specified typefaces)
• Text colours chosen for optimal contrast
• A UNIQUE, contextual description for each mockup
• A design that reflects the project's visual identity

TECHNICAL rules:
• Description section: position:absolute, bottom:0
• Gradient built from the brand colours with transparency
• Title: bold, large (24px), in the display typeface
• Description: short, sharp, contextual
• Project info and page number
• Inline CSS only
• No explanation, HTML only
• IMPORTANT: the image must COVER the whole page with object-fit:cover`,
};
