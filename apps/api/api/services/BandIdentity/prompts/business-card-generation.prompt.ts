import { BusinessCardOrientation } from '../../../models/businessCard.model';

export interface BusinessCardPromptParams {
  projectName: string;
  projectDescription: string;
  industry: string;
  orientation: BusinessCardOrientation;
  /** Dimensions physiques exactes de la carte (mm). */
  width: number;
  height: number;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: { primaryFont: string; secondaryFont: string };
  /** URLs PNG des déclinaisons du logo (vides si non générées). */
  logos: {
    primary: string;
    withTextLight: string;
    withTextDark: string;
    withTextMono: string;
    iconLight: string;
    iconDark: string;
    iconMono: string;
  };
  /** Direction artistique libre saisie par l'utilisateur (optionnelle). */
  styleBrief?: string;
}

/**
 * Prompt de génération du TEMPLATE de carte de visite (recto + verso).
 *
 * Différence clé avec les autres visuels : la sortie n'est pas une carte finie
 * mais un gabarit réutilisable. Les informations personnelles sont des
 * marqueurs `{{champ}}` posés dans des blocs porteurs de `data-field="champ"`,
 * pour que le rendu par personne soit une simple interpolation et que
 * l'édition du template se répercute sur toutes les cartes.
 */
export function buildBusinessCardPrompt(params: BusinessCardPromptParams): string {
  const {
    projectName,
    projectDescription,
    industry,
    orientation,
    width,
    height,
    colors,
    typography,
    logos,
    styleBrief,
  } = params;

  return `<role>Senior brand designer specialised in print stationery (business cards)</role>
<objective>Design ONE business card TEMPLATE (front + back) for the brand below, as two self-contained HTML fragments styled with Tailwind utility classes.</objective>

<brand_context>
- Brand / project: ${projectName}
- What it does: ${projectDescription}
- Industry: ${industry}
- Colors: primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}, background ${colors.background}, text ${colors.text}
- Fonts: headings '${typography.primaryFont}', body '${typography.secondaryFont}'
- Logo PNG urls (use as <img src="...">, pick the declension that CONTRASTS with your background):
  · full logo: ${logos.primary || '(none)'}
  · with text on light bg: ${logos.withTextLight || '(none)'}
  · with text on dark bg: ${logos.withTextDark || '(none)'}
  · with text monochrome: ${logos.withTextMono || '(none)'}
  · icon on light bg: ${logos.iconLight || '(none)'}
  · icon on dark bg: ${logos.iconDark || '(none)'}
  · icon monochrome: ${logos.iconMono || '(none)'}
${styleBrief ? `- Art direction requested by the user (MUST be honoured): ${styleBrief}` : ''}
</brand_context>

<card_format>
- Physical size: ${width} mm × ${height} mm (${orientation}), the international standard.
- Each face's OUTERMOST element MUST be exactly: <div class="w-[${width}mm] h-[${height}mm] overflow-hidden relative ..."> plus your own styling classes.
- Keep a safety margin of at least 4mm on every edge: nothing important (text, logo) may sit closer to the trim.
- Print reality: the render is rasterised at 300 dpi. Use solid colors, real Tailwind classes and arbitrary values (bg-[#112233], text-[9pt], tracking-[0.18em]); no CSS variables, no external stylesheet, no <style> block, no @font-face.
</card_format>

<placeholders>
Personal data is NOT written literally: it is templated. Use EXACTLY these markers where the information belongs:
- {{fullName}}    person's full name (always present)
- {{jobTitle}}    role / position
- {{email}}       email address
- {{phone}}       landline / office phone
- {{mobile}}      mobile phone
- {{website}}     website url
- {{address}}     postal address (may be 1-2 lines)
- {{linkedin}}    LinkedIn handle or url
- {{companyName}} the brand name — you MAY hardcode "${projectName}" instead
- {{tagline}}     brand tagline — you MAY hardcode a short one you invent

RULES:
1. Every element that carries an OPTIONAL marker must also carry the matching attribute, e.g.
   <p data-field="mobile" class="...">{{mobile}}</p>
   The renderer removes those blocks when the person left the field empty, so the layout must stay balanced without them (use flex/grid with gap, never absolute stacking that leaves holes).
2. Never put two different markers in the same data-field element.
3. Icons before contact lines are allowed ONLY as inline <svg> (no icon font, no emoji). Put the <svg> INSIDE the data-field element so it disappears with it.
4. Do not invent extra markers beyond the list above.
</placeholders>

<composition_rules>
- FRONT: brand-first. Logo + brand name + optional tagline, and the person's identity ({{fullName}}, {{jobTitle}}). Strong, calm, generous whitespace.
- BACK: contact-first. The contact block ({{email}}, {{phone}}, {{mobile}}, {{website}}, {{address}}, {{linkedin}}) with a discreet brand reminder (icon or monogram).
- The two faces must obviously belong to the same system (shared color logic, shared type scale, mirrored margins).
- Typographic scale suited to print: name 11-14pt, job title 7-9pt, contact lines 7-8pt. Never below 6pt.
- Contrast: WCAG AA minimum on every text over its background.
- No placeholder photography, no stock image, no QR code, no lorem ipsum.
</composition_rules>

<editor_compatibility>
The template is edited afterwards in a visual (Figma-like) editor:
- put visible text in leaf elements (h1..h6, p, span, li), not split across nested wrappers;
- clear block structure (header / identity / contact), no inline event handlers, no <script>, no <style>;
- one line of HTML per face, no comments.
</editor_compatibility>

<output_format>
Return the four blocks below, in this exact order, each introduced by its marker alone on its line.
Output NOTHING else: no JSON, no markdown fence, no commentary before or after.

===NAME===
short name of the design direction, max 4 words
===CONCEPT===
2 sentences explaining the design rationale, written in the same language as the project description
===FRONT===
the complete front face, as ONE line of HTML starting with <div class="w-[${width}mm] h-[${height}mm] overflow-hidden relative …">
===BACK===
the complete back face, as ONE line of HTML, same outer container rules

Write the HTML raw — plain double quotes around attribute values, no backslash escaping of any kind.
</output_format>`;
}
