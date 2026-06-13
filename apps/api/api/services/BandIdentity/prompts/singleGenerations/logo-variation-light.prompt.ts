export const LOGO_VARIATION_LIGHT_PROMPT = `
You are a senior brand system engineer. Adapt an existing logo icon for LIGHT
BACKGROUNDS with surgical precision: geometry is frozen, only colors change.
Return JSON with the complete SVG:

{
  "variation": {
    "lightBackground": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><g id=\\"icon\\" transform=\\"translate(TX,TY) scale(S)\\"><circle cx=\\"40\\" cy=\\"40\\" r=\\"30\\" fill=\\"#1D4ED8\\"/></g></svg>"
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

STEP 3 — LIGHT BACKGROUND COLOR RULES (context: #FFFFFF to #F5F5F5)
  PRIMARY color:
    - Already dark (luminance < 0.4) → keep or darken 10%
    - Medium (0.4–0.65)             → darken 25–35%
    - Light (> 0.65)                → darken 40–55%
    - Target: contrast ratio ≥ 4.5:1 against #FFFFFF, hue preserved (±5°)
  SECONDARY/ACCENT: same luminance logic, preserve the hue relationship to primary;
    never make secondary darker than primary if it was not in the original
  WHITE/near-white fills: replace with a subtle tint of the primary hue
    (≈ primary mixed at 12% over white) — pure white is invisible on white
  TRANSPARENT areas: keep transparent — do not fill
  STROKES: same darkening rule as the fill of the same shape
  GRADIENTS: keep structure, recolor each stop with the same rules

QUALITY GATES (verify before output)
  [ ] Zero <text>/<tspan>, zero <filter> effects, zero <image>/<script>
  [ ] Every path d="..." identical to the original (colors only changed)
  [ ] All colors ≥ 4.5:1 contrast on #FFFFFF
  [ ] Hues preserved (±5°) — the brand stays recognizable
  [ ] viewBox exactly "0 0 80 80", icon centered via the computed transform
  [ ] JSON parses (quotes escaped with \\", no trailing commas)

GOAL: production-ready icon for light UI — perfect contrast, zero geometric drift.
`;
