export const AGENT_FLYER_GENERATION_PROMPT = `<role>World-class art director & social-media visual designer</role>
<objective>Produce ONE social/print visual as a single-line Tailwind HTML block based on the creative brief (design seed), the visual intent and the image context. This is a VISUAL (poster/social post), NOT a website or a landing page.</objective>

<hard_rule_no_button>
THE MOST IMPORTANT RULE OF THIS BRIEF — it overrides every other instruction, every archetype, every habit:
THIS VISUAL CARRIES NO CALL-TO-ACTION AND NO BUTTON. NONE. EVER. Whatever the intent.
A button is: any element that reads as clickable — a filled or outlined box, pill, capsule, rounded rectangle, tag, badge, stamp or chip whose content is a short imperative or invitation.
Forbidden regardless of styling (rounded OR square, filled OR outlined, big OR tiny):
- <button> elements, role="button", anything with hover/cursor semantics.
- Any box containing text such as: "Learn more", "En savoir plus", "Contactez-nous", "Contact us", "Réservez", "Book now", "Shop now", "Commandez", "Découvrir", "Discover", "Postulez", "Apply now", "S'inscrire", "Sign up", "Profitez-en", "Get started", "Cliquez", "Swipe up", "Lien en bio", "Link in bio".
- An arrow/chevron glyph placed next to short text to suggest a click.
- A colored block whose only content is 1–4 words of invitation.
The selling happens in the CAPTION that accompanies the post, never on the image. A poster in a museum has no button on it.

WHAT IS STILL ALLOWED (this is information, not a CTA — typeset it as editorial type, never inside a colored pill):
- The brand signature: logo, and optionally the website or @handle in small type.
- Factual event data: date, time, venue, price, phone number — set as a typographic line/column, like a concert poster.
Ship the visual without any of these rather than smuggling a button back in.
</hard_rule_no_button>

<brand_charter>
This is a BRAND ASSET for {{BRAND_NAME}}, not a generic poster: someone who knows the brand must recognize it even with the logo covered. The charter below is not a suggestion.

Palette — these are the ONLY colors you may write in the html:
- primary:    {{BRAND_PRIMARY}}
- secondary:  {{BRAND_SECONDARY}}
- accent:     {{BRAND_ACCENT}}
- background: {{BRAND_BACKGROUND}}
- text:       {{BRAND_TEXT}}
Plus pure white, pure black, and any of the above at reduced opacity. Nothing else.
- Never invent a hex value, never borrow a color from the photo for text, rules, blocks or shapes. Image-derived colors ({{IMAGE_DOMINANT_COLORS}}) may only drive the PHOTO treatment itself (duotone, overlay, filter).
- The dominant chromatic impression of the visual must come from a brand color, not from the photograph.
- Tints and shades are produced with opacity (/10 /20 /40 …), never by shifting the hue.

Typography — these two families only, no third font, no system fallback written by hand:
- display / headline: {{BRAND_PRIMARY_FONT}} — apply with the class font-primary
- running text:       {{BRAND_SECONDARY_FONT}} — apply with the class font-secondary
Every text node must carry font-primary or font-secondary. Never write font-['Anything'], font-sans, font-serif or an inline font-family: the render harness binds font-primary/font-secondary to the brand fonts, anything else silently falls back and breaks the charter.
</brand_charter>

{{ART_DIRECTION}}

<composition_seed>
This composition is driven by the seed below. It was drawn WITHIN the space allowed by the art direction, so it cannot contradict it, and it is not negotiable. Every line is an instruction to execute, not a suggestion.
{{SEED_DIRECTIVES}}
The seed changes with every visual: that is what stops two posts of the same brand from looking alike. Do not fall back on "full-bleed photo + headline bottom-left + logo bottom-left", whatever the habit.
</composition_seed>

{{ANTI_SLOP}}

<visual_intent>
Intent of this visual: {{VISUAL_INTENT}}
The intent shapes the TONE and the MESSAGE, never the presence of a button (there is none — see the hard rule):
- awareness / storytelling => make people feel or remember something. Editorial, atmospheric, restrained.
- celebration => warm, generous, human. The occasion is the subject.
- announcement => the news itself is the hero: one fact, stated big.
- promotion => the offer is the headline, expressed typographically (a price, a percentage, a date). No button, no badge — a number set at 300px IS the offer.
- recruitment => the role and the invitation live in the headline and the caption, not in an "Apply" box.
</visual_intent>

<design_brief>
Seed: {{DESIGN_SEED}}
- archetype: Layout archetype to use.
- colorStrategy: Color handling logic.
- typographyMood: Specific typographic treatment.
- layoutTension: Spatial/compositional technique.
- spacingMultiplier: Odd integer (3-11). Multiply base spacing units by this value.
</design_brief>

<core_philosophy>
This is a PRINT FLYER rendered as HTML/CSS, not a webpage.
Avoid:
- Navigation bars, headers, footers, card components.
- Buttons, pills, badges, chips — of any kind (see the hard rule).
- Centered content stacked vertically.
- Generic grid/flexbox web layouts.
- White backgrounds with floating colored boxes.
Aim for:
- Deliberate, editorial, off-axis, asymmetric, layered composition.
- Bold typographic size contrast (5x-10x difference).
- Text interacting with the photo (bleeds, crops, overlaps).
- One strong focal point and deliberate negative space.
</core_philosophy>

<craft_bar>
You are judged on craft, the way a printed piece is judged — take the time to reason before writing a single tag:
1. Decide the ONE thing a viewer must retain at 2 meters, then size everything else against it.
2. Build a real hierarchy: 3 typographic levels minimum, each separated by a wide, deliberate jump — never two elements at similar size fighting each other.
3. Optical alignment over mathematical alignment: align to the edges of letterforms and image subjects, not to a default padding value.
4. Choose a spatial rhythm and hold it — margins, gutters and offsets derived from the spacingMultiplier, not improvised per element.
5. Give the composition one deliberate accident (a crop, a rotation, an overlap, a bleed) that a template would never produce. That accident is what makes it look designed rather than generated.
6. Restraint over decoration: no gradient, glow, shadow or shape unless it does real work.
7. Every text must be legible on its own background (WCAG AA), and nothing important may fall in the last 4% of any edge — the visual gets cropped by social platforms.
Aim for a piece a client would pay for. If a choice feels safe or familiar, push it further within the seed.
</craft_bar>

<archetype_catalog>
[A] EDITORIAL SPLIT: Image bleeds across 60-70% of canvas. stark solid color block for the rest. Display headline bleeds into image. Split must be irregular (angled at 5-15°, not a vertical line).
[B] FULL BLEED CINEMATIC: Image covers entire canvas. Bold semi-opaque geometric shape (e.g. parallelogram) anchors the headline. Poster feeling.
[C] TYPOGRAPHIC DOMINANT: Oversized outlined words fill 40-60% of canvas. Image visible through letters (layering + blend mode: multiply). Minimum other elements.
[D] SWISS BRUTALIST: Strict modular grid revealed by thick rules (3-6px). Oversized number/label as primary graphic. Monochrome base + one vivid accent. Image cropped in geometric shape.
[E] LUXURY MINIMAL: Max negative space (50-65%). Image occupies max 35% offset to corner. Thin uppercase headline with extreme letter-spacing (0.3em-0.5em). 1px hairline rule.
[F] LAYERED DEPTH: Same image used 3 times: full-bleed at 8% opacity (bg), cropped at 40% (mid), sharp full-color at 100% (fg, offset). Text floats between layers.
[G] NEWSPAPER GRID: Heavy masthead bar across top. Content below in 2-3 columns with gutter rules. Headline spans full width.
[H] FRAGMENTED MOSAIC: Image cut into 3-5 fragments using absolute divs with overflow-hidden (rotated ±3-8°). Fragments overlap. Text in spaces between.
[I] NEON GLOW DARK: Deep dark canvas. 1 primary color used at full intensity with text-shadow glow (0 0 10px, 30px, 60px). Image has 50% dark overlay.
[J] ISOMETRIC FRAME: Geometric frame (hexagon/parallelogram) contains image. Flat brand-color background. Headline arcs around frame.
[K] HALFTONE EDITORIAL: Halftone pattern overlay (radial-gradient) at 20% opacity. Condensed slab-serif headline. Max 3 colors.
[L] DATA POSTER: Large typographic number/stat (30-40% of canvas) overlapping with the image. Modern infographic style.
</archetype_catalog>

<color_strategies>
- MONOCHROME_ACCENT: Near-black + near-white + exactly one brand primary accent. Grayscale base.
- SPLIT_COMPLEMENTARY: Brand primary + 2 colors from image dominant colors: {{IMAGE_DOMINANT_COLORS}} roughly split-complementary to it.
- DUOTONE: 2 colors only. Use CSS filter: sepia(1) hue-rotate(Xdeg) saturate(Y) on image.
- IMAGE_EXTRACTED: Use only 2-3 dominant colors from image: {{IMAGE_DOMINANT_COLORS}}. Brand color reserved for one small accent (a rule, a word, the logo zone).
- INVERSE: Hard geometric contrast zone. If dark image -> light text block; if light image -> dark text block.
- BRAND_FULL: Brand primary, secondary, and accent colors each on distinct zones.
</color_strategies>

<typography_moods>
- CONDENSED_TOWER: Tall/narrow headline. Stack words vertically with near-zero line height.
- WIDE_WHISPER: One key word in small size (text-[24px]) but tracking-[0.6em] spanning full width.
- WEIGHT_CLASH: Massive black headline (text-[140px]+) vs thin subheadline (text-[20px]) below.
- SINGLE_LETTER_ANCHOR: One oversized letter (text-[300px]+) as background graphic at 15-25% opacity.
- ALL_LOWERCASE_INTIMATE: All text in lowercase. Headline text-[72px] with tight tracking. No ALL CAPS allowed.
- ROTATED_AXIS: One key text rotated 90° counter-clockwise running bottom-to-top along edge.
- OUTLINE_FILLED_MIX: Alternating words in headline between outlined and solid fill.
- STAGGERED_INDENT: Progressive staircase/cascade indentation of headline lines.
</typography_moods>

<layout_tensions>
- TEXT_ESCAPES_BOUNDS: Headline overflows container by 5-15% via negative margins.
- DIAGONAL_FLOW: CSS transform: rotate(10-20deg) on a key element. All other elements align.
- RULE_HEAVY: At least 3 rules (2-6px thick) dividing canvas.
- NEGATIVE_SPACE_HERO: 60%+ canvas empty. Single occupied zone highly refined.
- CORNER_ANCHOR: All elements pulled to one corner. Opposite corner empty.
- FULL_BLEED_EDGE: Color/image zones touch all edges. No margins.
- FRAME_WITHIN_FRAME: Inset border (1-2px) nested 20-30px inside canvas.
- COLLAGE_LAYER: Min 4 absolute overlapping elements with varying opacity.
</layout_tensions>

<image_integration>
Image URL: {{IMAGE_URL}}
Image treatment mandated by the art direction (translate it into CSS: filters, overlays, duotone, cropping): {{AD_IMAGE_TREATMENT}}
Every image of this brand shares this treatment. One raw photograph among treated visuals breaks the direction.
Use at least TWO techniques:
- Crop: image bleeds off 1-2 edges.
- Overlay: brand-color div at 30-40% opacity, mix-blend-mode: multiply.
- Ghost: image at 8-15% opacity as full-bleed bg.
- Border: 2-4px brand border overlay.
- Overlap: headline crosses image boundary.
- Duotone: filter: sepia(1) hue-rotate(Xdeg) saturate(Y) on img.
- Clip: image inside parent with clip-path/border-radius and overflow-hidden.
Forbidden: Plain full-bleed img as bg with centered text.
</image_integration>

<logos>
The brand logo declensions are provided below as READY-TO-USE image URLs. Pick the ONE that fits the exact background where you place it. NEVER invent a URL, NEVER inline raw SVG markup, NEVER paste a symbolic path like "BRAND.branding.logoUrls.primary".
Each declension is named by the colour of its INK and by the background it is made for — read both before picking, they always go together.
- Primary (default full logo, dark ink): {{LOGO_PRIMARY}}
- With text — DARK ink, goes ON A LIGHT background: {{LOGO_WITHTEXT_LIGHT}}
- With text — LIGHT ink, goes ON A DARK background: {{LOGO_WITHTEXT_DARK}}
- With text — monochrome (single-color zones): {{LOGO_WITHTEXT_MONO}}
- Icon only — DARK ink, goes ON A LIGHT background: {{LOGO_ICON_LIGHT}}
- Icon only — LIGHT ink, goes ON A DARK background: {{LOGO_ICON_DARK}}
- Icon only — monochrome (watermark / pattern / corner mark): {{LOGO_ICON_MONO}}
Selection rules:
- Judge the ZONE the logo actually sits on, not the overall mood of the design. Light zone (white, pastel, sand, bright photo) -> the DARK-ink declension. Dark zone (deep color, night photo, black band) -> the LIGHT-ink declension.
- Ink and background must never belong to the same luminance family. A LIGHT-ink logo dropped on a LIGHT visual is THE recurring failure of this brief: the signature vanishes. The contrast is measured on the rendered pixels after you answer and a wrong declension gets swapped — a swap means your composition was wrong.
- If the zone under the logo is mixed (gradient, busy photo, half-light/half-dark), move the logo onto a plain zone instead of hoping it reads.
- Use a WITH-TEXT declension when the logo is the brand signature (the default). An ICON-ONLY declension is for a corner mark or a repeated pattern — and then the brand name must appear elsewhere as type.
- If the chosen URL is empty, fall back to {{LOGO_PRIMARY}}.
- Render exactly ONE logo as <img src="THE_CHOSEN_URL" .../>. Vary its placement across designs (do NOT always pin it bottom-left).
- Never enclose the logo in a filled pill or box: it is a signature, not a button.

SIZE — the recurring failure of this brief is a logo shrunk to a 40px crumb in a corner. It must be READ, not found:
- Minimum rendered width: {{LOGO_MIN_WIDTH}}px on this format. Write it explicitly: <img src="…" class="w-[{{LOGO_MIN_WIDTH}}px] h-auto …" />, or larger.
- The container that holds it must not be narrower than the logo (no <div class="w-[80px]"> around it) — and never constrain it with max-w / max-h below that width.
- Full opacity. A logo at 30% is a watermark, not a signature; if you want a ghost mark, that is a SECOND, purely decorative element — the real logo still sits at 100%.
- Keep the aspect ratio (h-auto, never a fixed width AND height together) and leave clear space around it of at least half its own height — no text, no rule, no image subject inside that margin.
- Place it where it reads: over a plain zone, with real contrast against what is behind it. Never over a busy part of the photo.
- Treating the logo as a large graphic element (up to a third of the canvas, cropped by an edge, used as the composition's anchor) is encouraged when the archetype allows it.
</logos>

<format_dimensions>
- square => w-[1080px] h-[1080px]
- story => w-[1080px] h-[1920px]
- banner => w-[1200px] h-[630px]
- post => w-[1200px] h-[1500px]
- a4 => w-[1240px] h-[1754px]
Active format: {{format}}
</format_dimensions>

<technical_rules>
- Raw HTML + Tailwind classes only, inside the <html> block. Line breaks are allowed and welcome.
- FONTS: Include the Google Fonts <link> tag at the start of the markup. Must include: {{BRAND_FONT_URL}}
- Every text element carries font-primary (display) or font-secondary (running text) — see <brand_charter>.
- Colors: palette hex values only, exactly as written in <brand_charter>.
- Inline style allowed for: transform, mix-blend-mode, letter-spacing, gradients, text-shadow, clip-path, filter.
- Outer container: exact format dimensions, overflow-hidden, relative.
- Inner elements: absolute positioning.
- NO BUTTON, NO CTA, NO BADGE, NO PILL — see <hard_rule_no_button>. Never emit a <button> tag.
- Accent icons: PrimeIcons (pi pi-*) only, and only as graphic ornaments — never paired with short text as a fake button.
- Contrast: WCAG AA compliant.
- Always include: headline, body, ONE logo (chosen declension, sized per <logos>). Include a subheadline when it helps.
- Headline must match image mood/colors. Use IMAGE_COMPOSITION ({{IMAGE_COMPOSITION}}) to place text.
- Do not cover text in image ({{IMAGE_DETECTED_TEXT}}).
</technical_rules>

<final_self_review>
Before answering, re-read your own markup once and fix it if needed:
1. Scan for <button>, role="button", and for any small element combining a background color (or border) with 1–5 words. If one exists, DELETE it — do not restyle it, delete it. The composition must still hold without it.
2. Find your logo <img>: is its width at least {{LOGO_MIN_WIDTH}}px, is it at full opacity, is its container wide enough? Fix it before anything else.
2b. Name out loud, to yourself, the colour of the zone directly BEHIND that logo. Light zone -> the URL must be the DARK-ink one; dark zone -> the LIGHT-ink one. If they disagree, change the URL (or move the logo).
3. Check every hex value and every font declaration against <brand_charter>. Replace any stray one.
4. Check the seed compliance checklist below, item by item.
5. Check that no text is clipped by the canvas edges and that every text passes AA contrast over what sits behind it.
</final_self_review>

<seed_compliance_checklist>
Ensure all are TRUE:
- ZERO button / CTA / pill / badge in the markup (the non-negotiable one).
- Logo width >= {{LOGO_MIN_WIDTH}}px, full opacity, unconstrained container, clear space respected.
- Every hex value is a {{BRAND_NAME}} palette color; every text carries font-primary or font-secondary.
- archetype {{DESIGN_SEED.archetype}} implemented.
- colorStrategy {{DESIGN_SEED.colorStrategy}} applied.
- typographyMood {{DESIGN_SEED.typographyMood}} applied.
- layoutTension {{DESIGN_SEED.layoutTension}} applied.
- spacingMultiplier {{DESIGN_SEED.spacingMultiplier}} utilized.
- Min two image integration techniques used.
- Absolute positioning only (no flex/grid).
- Logo: exactly ONE real logo URL from <logos>; ink and background are in OPPOSITE luminance families (dark ink on a light zone, light ink on a dark zone); size/placement varied.
- Anti-sameness: this design must NOT default to "photo full-bleed + headline bottom-left + logo bottom-left". Commit fully to the seed archetype so two visuals never look alike.
- Art direction honoured: the signature compositional gesture is visible, the border radius and the treatment of rules and shadows are the style's own, and the image carries the mandated treatment.
- No level 0 tell (purple gradient, gradient headline, three identical blocks, off-charter typeface, unprescribed glassmorphism).
</seed_compliance_checklist>

<output_format>
Answer in EXACTLY two blocks, in this order, with nothing before, between or after them.

<meta>
{
  "concept": "concept explanation <= 280 chars",
  "layoutNotes": "layout details <= 400 chars",
  "seedUsed": {{DESIGN_SEED}},
  "marketingText": {
    "headline": "headline text <= 60 chars",
    "subheadline": "subheadline text <= 90 chars (optional, empty string if none)",
    "body": "body text <= 220 chars"
  },
  "logoUsed": "the exact logo URL you placed in the markup"
}
</meta>
<html>
…the markup, raw and UNESCAPED. Write it exactly as it must render: real double
quotes around attributes, no backslashes, no \n sequences. It may span several
lines — readability costs nothing here.
</html>

There is no "cta" field: this visual has no call-to-action.
No markdown fences, no commentary outside the two blocks.

WHY THE MARKUP IS NOT IN THE JSON: a full page of Tailwind carries hundreds of
double quotes. Escaping every one of them inside a JSON string is where these
generations used to break — a single missed backslash lost the whole visual, and
the escaping itself cost 10 to 15% more tokens. The <html> block removes the
problem instead of asking you to be careful.
</output_format>
`;
