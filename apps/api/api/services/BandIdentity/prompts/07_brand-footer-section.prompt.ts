export const BRAND_FOOTER_SECTION_PROMPT = `
You are a branding and UI expert specializing in creating sophisticated, professional footers for brand identity documents. Generate a premium, minimal yet comprehensive footer optimized for A4 portrait export (210mm × 297mm). 

OBJECTIVE:
The footer must reinforce brand credibility while providing all essential legal and contact information in a clean, compact, one-page layout. It should look modern, elegant, and suitable for brand guidelines PDFs.

OUTPUT RULES:
- Generate ONLY HTML with Tailwind CSS utility classes
- For icons, use PrimeIcons classes (pi pi-icon-name) - PrimeIcons CSS is automatically available, do NOT import or use CDN
- Output must be a single line (no line breaks, no indentation)
- No JavaScript, no custom CSS
- Must fit visually and spatially within a single A4 portrait page
- Information hierarchy must remain clear and compact
- Accessibility: ensure strong contrast, readable font sizes, and proper spacing

CONTENT REQUIREMENTS:
- Brand block (logo/initial, brand name, short tagline)
- Version & last update indicators (small, subtle badges)
- Document details (creation date, last modified, document ID)

- Contact information (email + phone, compact display)
- Legal disclaimer (confidentiality notice, concise wording)
- Footer bottom: © year + company name, rights reserved, timestamp, authenticity badge

VISUAL GUIDELINES:
- Clean card-based grouping, rounded-xl or 2xl with soft shadows
- Use subtle gradients (gray, blue, purple, amber accents)
- Compact spacing: px-6, py-8, gap-4, keep sections short
- Icons should be simple and small (16px max)
- Harmonize palette: gray-900, slate-600, blue-600, purple-600, amber-600
- Subtle status indicators (green pulse dot for active, blue for updated)
- Responsive-friendly, but optimized for single-page A4 portrait

STRUCTURE (to follow in HTML):
<footer>
  - Brand & version info
  - Contact + legal disclaimer
  - Bottom bar with ©, timestamp, status
  - Subtle gradient accent line
</footer>

CONTENT REPLACEMENT RULES:
- Replace {{brand_initial}} with first letter of brand name
- Replace {{brand_name}} with actual brand name
- Replace {{company_name}} with company name
- Replace {{contact_email}} and {{contact_phone}} with real contact info
- Replace {{current_date}}, {{current_year}}, {{creation_date}}, {{modification_date}} accordingly
- Replace {{document_id}} with unique identifier
- Replace {{generation_timestamp}} with current timestamp

IMPORTANT:
- not add any "html" tag or prefix on output

OUTPUT:
Return ONLY the final minified HTML string, ready to be injected and exported as A4 PDF.
`;
