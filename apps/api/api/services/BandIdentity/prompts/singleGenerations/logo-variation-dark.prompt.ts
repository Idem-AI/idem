export const LOGO_VARIATION_DARK_PROMPT = `
You are a senior brand system engineer. Adapt an existing logo icon for DARK
BACKGROUNDS with surgical precision: geometry is frozen, only colors change.
Return JSON with the complete SVG:

{
  "variation": {
    "darkBackground": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><g id=\\"icon\\" transform=\\"translate(TX,TY) scale(S)\\"><circle cx=\\"40\\" cy=\\"40\\" r=\\"30\\" fill=\\"#60A5FA\\"/></g></svg>"
  }
}

STEP 1 — PARSE THE ORIGINAL SVG (before any output)
  - Inventory every shape (path, circle, rect, ellipse, polygon) with its exact
    fill and stroke values
  - Identify all <text>/<tspan> elements → they will be REMOVED
  - Record every transform and the original viewBox

STEP 2 — ICON EXTRACTION (fidelity rules)
  - REMOVE all text elements and text-only groups
  - KEEP every geometric attribute byte-for-byte: d, cx, cy, r, rx, ry, x, y,
    width, height, transform, stroke-width, stroke-linecap, stroke-linejoin,
    fill-rule, opacity — do NOT redraw, simplify or "improve" any path
  - CENTER mathematically in viewBox="0 0 80 80": from the icon bounding box
    (bx, by, bw, bh) compute S = 56 / max(bw, bh), TX = 40 − S×(bx + bw/2),
    TY = 40 − S×(by + bh/2) − 1 (optical centering). Apply on the root <g>.

STEP 3 — DARK BACKGROUND COLOR RULES (context: #111827 to #1E1E1E)
  PRIMARY color:
    - Already light (luminance > 0.6) → keep or brighten 10%
    - Medium (0.35–0.6)              → brighten 30–45%, saturation +10%
    - Dark (< 0.35)                  → brighten 50–70%, saturation +15%
    - Target: contrast ratio ≥ 4.5:1 against #111827, hue preserved (±5°)
  SECONDARY/ACCENT: same brightening logic, preserve hue relationship to primary;
    never let secondary become brighter than primary if it was not in the original
  WHITE/near-white fills: keep white (#FFFFFF) — reads perfectly on dark
  DARK fills (#111–#333 range): invert to white or a very light tint of the
    primary hue — dark-on-dark is invisible
  TRANSPARENT areas: keep transparent
  STROKES: same brightening rule as the fill of the same shape
  GRADIENTS: keep structure, recolor each stop with the same rules
  NO NEON: saturation gain capped at +20% from original, HSL saturation ≤ 85% —
    bright must never become fluorescent

QUALITY GATES (verify before output)
  [ ] Zero <text>/<tspan>, zero <filter> effects, zero <image>/<script>
  [ ] Every path d="..." identical to the original (colors only changed)
  [ ] All colors ≥ 4.5:1 contrast on #111827
  [ ] No hue with HSL saturation > 85% (no neon, no glow)
  [ ] viewBox exactly "0 0 80 80", icon centered via the computed transform
  [ ] JSON parses (quotes escaped with \\", no trailing commas)

GOAL: production-ready icon for dark UI — perfect contrast, zero geometric drift.
`;
