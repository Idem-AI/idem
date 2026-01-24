export const LOGO_VARIATION_LIGHT_PROMPT = `
Generate a professional logo variation optimized for LIGHT BACKGROUNDS with complete SVG code. Extract ONLY the icon part (no text) and adapt colors for light background contrast. Return JSON with complete SVG content:

{
  "variation": {
    "lightBackground": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#2563EB\"/></g></svg>"
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

LIGHT BACKGROUND COLOR ADAPTATION:
- Use darker versions of original colors for excellent contrast on light backgrounds
- Reduce brightness by 20-40% from original colors
- Ensure WCAG AA contrast compliance (minimum 4.5:1 ratio)
- Maintain color harmony and brand consistency
- Preserve visual hierarchy through strategic color darkening

SVG STRUCTURE REQUIREMENTS:
- Proper XML declaration and namespace
- Clean <g id="icon"> grouping for organization
- Maintain all original path complexity and Bézier curves
- Preserve opacity values (0.6-1.0) for depth and visual richness
- Scale coordinates proportionally to fit 80x80 viewBox
- Center icon elements around cx="40" cy="40" reference point
- Ensure scalable design that works at any size

COLOR TRANSFORMATION EXAMPLES:
- Original #3B82F6 (blue) → #1D4ED8 (darker blue for light bg)
- Original #10B981 (green) → #047857 (darker green for light bg)
- Original #F59E0B (orange) → #D97706 (darker orange for light bg)
- Original #8B5CF6 (purple) → #7C3AED (darker purple for light bg)

AVOID: Broken XML, missing namespaces, text elements, poor centering, colors too light for contrast
GOAL: Generate production-ready icon SVG optimized specifically for light background usage with perfect contrast and readability.
`;
