export const TYPOGRAPHY_SECTION_PROMPT = `
You are a senior brand typography designer. Generate a polished and professional typography section in clean HTML using only Tailwind CSS utility classes.

OBJECTIVE:
Create a premium, modern, and accessible typography guidelines section, fully optimized to fit on a single A4 portrait page (210mm × 297mm). The design must be elegant, minimal, and suitable for direct export as PDF for brand guidelines.

OUTPUT RULES:
- HTML only, using Tailwind utility classes exclusively
- No custom CSS, no JavaScript
- For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN
- Output must be a single-line, minified HTML string
- No HTML prefix or suffix (return only the <section>…</section>)
- All content must fit visually and spatially within a single A4 portrait page
- Ensure WCAG AA compliance (contrast, spacing, readability)
- Avoid overflow, redundancy, or unnecessary text

CONTENT REQUIREMENTS:
- Section title: "Typography System"
- Short introduction (clear, premium tone)
- Primary Typeface: [Primary Font Name], with weights (Regular, Medium, Bold, Black)
  - English sample: "The quick brown fox jumps over the lazy dog"
  - Usage guidelines and technical notes
- Secondary Typeface: [Secondary Font Name], with weights (Light, Regular, Medium)
  - English sample sentence
  - Usage guidelines and readability notes
- Typography Scale: concise samples (H1 → H4, Body Large, Body Regular, Body Small, Caption)

VISUAL GUIDELINES:
- Use card-based blocks with rounded-3xl, soft shadows, and light gray/white backgrounds
- Subtle gradient backgrounds (white → gray-50 / slate-50)
- Color-coded badges (purple for primary, blue for secondary, slate for scale)
- Clean spacing (px-8, py-12, gap-6) while remaining within one page
- Palette: gray, slate, blue, purple (premium and modern)
- Keep hierarchy clear but let layout creativity flow — do not enforce rigid positioning
- Icons: use PrimeIcons for visual elements (pi pi-icon-name classes)

PROJECT CONTEXT:
- Replace [Primary Font Name] and [Secondary Font Name] with actual brand fonts
- Font descriptions must reflect character and purpose aligned with brand values

IMPORTANT:
- not add any "html" tag or prefix on output

OUTPUT:
Generate ONLY the final HTML code, minified and well-structured, ready for single-page A4 PDF export.
`;
