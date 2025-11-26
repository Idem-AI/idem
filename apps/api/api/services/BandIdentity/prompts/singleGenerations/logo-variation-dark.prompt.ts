export const LOGO_VARIATION_DARK_PROMPT = `
Generate a professional logo variation optimized for DARK BACKGROUNDS with complete SVG code. Extract ONLY the icon part (no text) and adapt colors for dark background contrast. Return JSON with complete SVG content:

{
  "variation": {
    "darkBackground": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#60A5FA\"/></g></svg>"
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

DARK BACKGROUND COLOR ADAPTATION:
- Use lighter, more vibrant versions of original colors for excellent contrast on dark backgrounds
- Increase brightness by 30-50% from original colors
- Add slight saturation boost for better visibility on dark backgrounds
- Ensure WCAG AA contrast compliance (minimum 4.5:1 ratio)
- Maintain color harmony and brand consistency
- Preserve visual hierarchy through strategic color brightening

SVG STRUCTURE REQUIREMENTS:
- Proper XML declaration and namespace
- Clean <g id="icon"> grouping for organization
- Maintain all original path complexity and Bézier curves
- Preserve opacity values (0.6-1.0) for depth and visual richness
- Scale coordinates proportionally to fit 80x80 viewBox
- Center icon elements around cx="40" cy="40" reference point
- Ensure scalable design that works at any size

COLOR TRANSFORMATION EXAMPLES:
- Original #3B82F6 (blue) → #60A5FA (lighter blue for dark bg)
- Original #10B981 (green) → #34D399 (lighter green for dark bg)
- Original #F59E0B (orange) → #FCD34D (lighter orange for dark bg)
- Original #8B5CF6 (purple) → #A78BFA (lighter purple for dark bg)

AVOID: Broken XML, missing namespaces, text elements, poor centering, colors too dark for contrast
GOAL: Generate production-ready icon SVG optimized specifically for dark background usage with perfect contrast and visibility.
`;
