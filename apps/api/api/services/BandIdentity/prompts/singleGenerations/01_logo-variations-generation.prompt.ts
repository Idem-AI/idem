export const LOGO_VARIATIONS_GENERATION_PROMPT = `
Generate 3 professional icon variations from the provided logo with complete SVG code. Extract ONLY the icon part (no text) and adapt colors for each background. Return JSON with complete SVG content:

{
  "variations": {
    "lightBackground": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#2563EB\"/></g></svg>",
    "darkBackground": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#60A5FA\"/></g></svg>",
    "monochrome": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\" width=\"80\" height=\"80\"><g id=\"icon\"><circle cx=\"40\" cy=\"40\" r=\"30\" fill=\"#374151\"/></g></svg>"
  }
}

SVG VARIATION GENERATION RULES:
- GENERATE COMPLETE SVG CODE for each variation with proper XML structure
- Extract ONLY the icon elements from the original logo (remove all text)
- Use viewBox="0 0 80 80" for square icon format (80x80px minimum)
- Include proper xmlns="http://www.w3.org/2000/svg" declaration
- Maintain all original shape complexity and sophistication
- Preserve geometric relationships and proportional scaling
- Center the icon within the 80x80 viewBox for optimal presentation

COLOR ADAPTATION STRATEGY:
- lightBackground: Use darker versions of original colors for good contrast
  * Reduce brightness by 20-40% from original colors
  * Ensure WCAG AA contrast compliance on light backgrounds
- darkBackground: Use lighter, more vibrant versions of original colors  
  * Increase brightness by 30-50% from original colors
  * Add slight saturation boost for better visibility on dark backgrounds
- monochrome: Convert to sophisticated grayscale maintaining visual hierarchy
  * Use professional gray palette: #111827, #374151, #4B5563, #6B7280
  * Preserve opacity relationships for depth and layering

SVG STRUCTURE REQUIREMENTS:
- Proper XML declaration and namespace
- Clean <g id="icon"> grouping for organization
- Maintain all original path complexity and Bézier curves
- Preserve opacity values (0.6-1.0) for depth and visual richness
- Scale coordinates proportionally to fit 80x80 viewBox
- Center icon elements around cx="40" cy="40" reference point
- Ensure scalable design that works at any size

COLOR EXAMPLES:
- Original #3B82F6 (blue): light=#1D4ED8, dark=#60A5FA, mono=#374151
- Original #10B981 (green): light=#047857, dark=#34D399, mono=#4B5563  
- Original #F59E0B (orange): light=#D97706, dark=#FCD34D, mono=#6B7280

AVOID: Broken XML, missing namespaces, text elements, poor centering, basic shapes only
GOAL: Generate production-ready icon SVGs that are immediately usable across light/dark themes and monochrome applications.
`;
