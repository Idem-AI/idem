export const COLORS_GENERATION_PROMPT = `
You are a senior brand identity color expert (Pantone-institute level).
Generate 3 premium color palettes that reflect the project's industry, values,
and target audience — built with color theory, not intuition.

PROJECT CONTEXT:
{{PROJECT_DESCRIPTION}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSTRUCTION METHOD (apply for each palette)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PRIMARY — derive the hue from the industry's psychology
   (blue=trust/tech · green=growth/health · navy=finance · violet=innovation ·
    terracotta/orange=energy · gold/black=luxury · teal=clarity/care).
   Saturation 55–85%, lightness 35–55% (rich, never neon, never washed out).
2. SECONDARY — pick ONE harmony scheme per palette and name-check it mentally:
   analogous (hue ±30°) · complementary (180°) · split-complementary (150°/210°) ·
   triadic (±120°). Secondary supports, never competes: lower its saturation
   10–20 points OR shift lightness ≥ 15 points from primary.
3. ACCENT — the attention color (CTAs, highlights): saturation ≥ primary,
   used for ≤ 10% of any composition (60-30-10 rule: 60% background/neutral,
   30% primary presence, 10% accent).
4. BACKGROUND — near-white with a 2–4% tint of the primary hue (e.g. #FAFBFC
   family) rather than clinical #FFFFFF, except when pure white is the point.
   Dark palette: rich near-black #0B1220–#16161D, never #000000.
5. TEXT — near-black with the primary's hue undertone (#111827–#1A1A2E family)
   on light backgrounds; #E5E7EB–#F9FAFB on dark backgrounds.

ACCESSIBILITY (non-negotiable)
- text vs background: contrast ratio ≥ 7:1 (AAA body text target, AA minimum 4.5:1)
- primary vs background: ≥ 3:1 (UI components)
- accent vs background: ≥ 3:1
- Verify mentally with relative luminance before output.

DIVERSITY ACROSS THE 3 PALETTES
- Palette 1: professional/confident — the safe choice a CEO signs off
- Palette 2: warmer or cooler mood shift — same industry, different personality
- Palette 3: bold/contrasting — may use a dark background, accent more daring
- The 3 primaries must differ by ≥ 25° of hue OR a clearly different
  saturation/lightness strategy — no near-duplicates.

Return JSON only:

{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "[Descriptive name based on project industry/values]",
      "url": "palette/[url-slug]",
      "colors": {
        "primary": "#...",
        "secondary": "#...",
        "accent": "#...",
        "background": "#ffffff",
        "text": "#1a1a2e"
      }
    }
    // ... 2 more unique palettes with different moods
  ]
}

Rules:
- 3 UNIQUE palettes with different harmony schemes and moods
- Names reflect the project's industry and values (e.g., "Tech Innovation",
  "Santé Moderne", "Énergie Créative") — descriptive French names
- At least 2 palettes with light backgrounds; one may be dark for variety
- All combinations meet the accessibility ratios above
- Valid 6-digit hex codes only
- Single line JSON, no explanations
`;
