export const LOGO_VARIATION_MONOCHROME_PROMPT = `
You are a senior brand system engineer. Convert an existing logo icon to a
sophisticated MONOCHROME version (print, embossing, stamp, watermark, B&W).
Geometry is frozen, only colors change. Return JSON with the complete SVG:

{
  "variation": {
    "monochrome": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 80 80\\"><g id=\\"icon\\" transform=\\"translate(TX,TY) scale(S)\\"><circle cx=\\"40\\" cy=\\"40\\" r=\\"30\\" fill=\\"#111827\\"/></g></svg>"
  }
}

STEP 1 — PARSE THE ORIGINAL SVG (before any output)
  - Inventory every shape with its exact fill and stroke values
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

STEP 3 — MONOCHROME CONVERSION (perceptual, hierarchy-preserving)
  Compute perceptual luminance for every original color:
    L = 0.2126 × R + 0.7152 × G + 0.0722 × B   (R, G, B in 0–1)

  Map luminance to this professional tonal palette ONLY (LIGHT stays light,
  DARK stays dark — never invert the hierarchy):
    L > 0.75    → #F3F4F6  (very light — shapes that were white/light)
    L 0.55–0.75 → #9CA3AF  (medium light)
    L 0.35–0.55 → #6B7280  (medium)
    L 0.15–0.35 → #374151  (medium dark)
    L < 0.15    → #111827  (near black — shapes that were darkest)

  HIERARCHY RULES:
    - The brand's PRIMARY/dominant shape maps to the darkest used tone
      (#111827 or #374151), regardless of its bucket, so the mark keeps its anchor
    - Secondary shapes sit at least 2 tonal steps lighter than the primary
    - If two shapes land on the same tone, shift the secondary one step lighter
    - The result must mirror the original visual weight distribution

  STROKES: same luminance mapping as their parent fill;
    strokes on very light fills → #6B7280 for visibility
  GRADIENTS: flatten each gradient to the tone of its average luminance
    (print compatibility — no gradients in monochrome)

  FORBIDDEN:
    - Flat single #000000 for everything (destroys hierarchy)
    - Only black + white with no mid-tone (no depth)
    - Any chromatic color (every fill must be one of the 5 tones above)

QUALITY GATES (verify before output)
  [ ] Zero <text>/<tspan>, zero <filter> effects, zero <image>/<script>
  [ ] Every path d="..." identical to the original (colors only changed)
  [ ] At least 3 distinct tones used; primary shape uses the darkest tone
  [ ] Light/dark relationships of the original are preserved (no inversion)
  [ ] viewBox exactly "0 0 80 80", icon centered via the computed transform
  [ ] JSON parses (quotes escaped with \\", no trailing commas)

GOAL: production-ready monochrome icon with a tonal hierarchy faithful to the
original — suitable for print, engraving and single-color reproduction.
`;
