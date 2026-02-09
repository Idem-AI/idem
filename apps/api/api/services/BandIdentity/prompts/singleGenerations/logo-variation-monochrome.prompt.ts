export const LOGO_VARIATION_MONOCHROME_PROMPT = `
Generate a professional logo variation in sophisticated MONOCHROME/GRAYSCALE with complete SVG code. Extract ONLY the icon part (no text) and convert to elegant grayscale. Return JSON with complete SVG content:

{
  "variation": {
    "monochrome": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#374151\"/></g></svg>"
  }
}

SVG VARIATION GENERATION RULES:
- GENERATE COMPLETE SVG CODE with proper XML structure
- Extract ONLY the icon elements from the original logo (remove all text)
- Use viewBox="0 0 80 80" for square icon format (80x80px minimum)
- Include proper xmlns="http://www.w3.org/2000/svg" declaration
- Maintain all original shape complexity and sophistication
- Preserve geometric relationships and proportional scaling
- Center the icon within the 80x80 viewBox for optimal presentation

MONOCHROME COLOR CONVERSION:
- Convert all colors to sophisticated grayscale maintaining visual hierarchy
- Use professional gray palette: #111827, #374151, #4B5563, #6B7280, #9CA3AF
- Preserve opacity relationships for depth and layering
- Maintain contrast ratios between different elements
- Ensure readability on both light and dark backgrounds
- Create elegant monochrome aesthetic suitable for professional applications

SVG STRUCTURE REQUIREMENTS:
- Proper XML declaration and namespace
- Clean <g id="icon"> grouping for organization
- Maintain all original path complexity and Bézier curves
- Preserve opacity values (0.6-1.0) for depth and visual richness
- Scale coordinates proportionally to fit 80x80 viewBox
- Center icon elements around cx="40" cy="40" reference point
- Ensure scalable design that works at any size

GRAYSCALE MAPPING STRATEGY:
- Brightest original colors → #111827 (darkest gray)
- Medium brightness colors → #374151 or #4B5563 (medium grays)
- Darker original colors → #6B7280 or #9CA3AF (lighter grays)
- Maintain relative brightness relationships from original
- Use different gray tones to preserve visual separation

COLOR TRANSFORMATION EXAMPLES:
- Original #3B82F6 (bright blue) → #374151 (medium-dark gray)
- Original #10B981 (bright green) → #4B5563 (medium gray)
- Original #F59E0B (bright orange) → #6B7280 (medium-light gray)
- Original #8B5CF6 (bright purple) → #374151 (medium-dark gray)

AVOID: Broken XML, missing namespaces, text elements, poor centering, loss of visual hierarchy
GOAL: Generate production-ready monochrome icon SVG with sophisticated grayscale palette suitable for professional and print applications.
`;
