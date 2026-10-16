/**
 * LA RÉFÉRENCE DU LANGAGE DONNÉE À L'AUTEUR — tout ce qu'il faut pour écrire un programme, et rien de
 * Motion Canvas : le modèle n'a pas d'API à connaître, seulement des primitives et une piste.
 */
export const DSL_REFERENCE = `# IDEM Motion Language — one scene = one JSON program

{ "bg": FILL, "enter": { "type": "fade"|"slide"|"zoom"|"none", "dir": "left"|"right"|"up"|"down", "dur": s },
  "nodes": [ NODE, … ],          // drawn in order (later = on top), or set "z"
  "timeline": [ STEP, … ] }      // what moves, when

## Units and space
- Lengths are in u = 1 % of the frame's shorter side. Origin (0, 0) = CENTER of the frame; x → right, y → DOWN.
- A length can be an expression: W, H (frame size), L, R, T, B (safe-area edges: L and T are negative), SW, SH (safe-area size), + - * / ( ), min(a,b), max(a,b), abs, sin(deg), cos(deg), and percentages ("30%" = 30 % of the frame width for x/w, of its height for y/h).
  Examples: "x": "L+4" (4u from the left margin), "y": "T+SH*0.3", "w": "SW", "h": "H".
- RESPONSIVE: the same program may be rendered vertical (story, portrait), square and horizontal (landscape). Place things as fractions of SW/SH (never a fixed y like -60 that only exists in a tall frame). Where the layout must change, use pick(vertical, horizontal) or pick(vertical, square, horizontal): "x": "pick(0, -SW*0.25)", "y": "pick(-SH*0.2, 0)", "w": "pick(SW, SW*0.45)". A stack with "dir": "auto" is a column in a vertical frame and a row otherwise.
- Texts always fit: the "size" you give is a maximum — the compiler wraps the text in its "width" (or the room left inside the safe area) and only shrinks it if it would be cut. It also pulls a text back inside the safe area. Still: give big titles a "width" and keep sizes sensible (a long sentence at size 12 in a narrow frame becomes small).
- "anchor": "center" (default) | "left" | "right" | "top" | "bottom" | "top-left" | … — which point of the node sits at (x, y). anchor "bottom" makes a bar grow upward with scaleY or h.

## Colors and fills
- Brand tokens: primary, secondary, accent, background, text; "ink" = readable text on the scene background; "on-primary" (or on-accent, on-secondary…) = readable on that color; white, black, transparent; "#RRGGBB".
- Opacity suffix: "primary/40" (40 %). Gradient FILL: { "from": "primary", "to": "accent", "angle": 90 }.

## Nodes — every node accepts: id (needed to animate it), x, y, rotation (deg), scale, scaleX, scaleY, opacity, z, anchor, blur (u), skewX, shadow { color, blur, x, y }
- text: { "text": "$KEY", font: "display"|"body", weight, size (u) or "fit" (largest size that fits "width" on "lines" lines, at most "maxSize"), width (wrap box), align: left|center|right, color, letterSpacing (u), lineHeight (×size), upper, italic, stroke, lineWidth,
  "split": "words"|"chars" → each word/letter becomes a part: animate them with target "ID.*" (all) or "ID.2" (one) }
  "text" is ALWAYS "$KEY" — a key of THIS scene's texts, shown exactly. Only a sign without letters may be literal ("→", "+", "%").
- rect: { w, h, radius, fill, stroke, lineWidth, dash: [a, b], clip: true (hides children outside it: animate w/h to reveal), children: [NODE…] }
- circle: { size (diameter), fill, stroke, lineWidth, start, end (0…1: animate "end" 0→1 to DRAW its outline), clip, children }
- line: { points: [[x, y], [x, y], …], stroke, lineWidth, radius (round corners), arrow: true, dash, start, end (animate end 0→1 to draw it), closed, fill }
- path: { d: "M0 0 C 10 -20 30 -20 40 0" (SVG path, coordinates in u), stroke, lineWidth, fill, start, end }
- polygon: { sides, size, radius, fill, stroke, lineWidth }
- image / video: { media: INDEX (scene media, 0 = first), w, h (default: whole frame), fit: "cover"|"contain", radius, zoom (1 = fitted; animate 1.15→1 for a slow push), panX, panY (u) } — the frame crops the media.
- logo: { w, on: COLOR it sits on (picks the light or dark version) } — only if the brand has a logo.
- group: { children } — move/scale/rotate several nodes together.
- stack: { dir: "row"|"column", gap, align: start|center|end, justify: start|center|end|space-between, w, h, wrap, padding, fill, radius, children } — flexbox: children are placed automatically (their x/y are ignored: animate their opacity/scale/rotation, never x/y). With fill/radius it is a box (button, tag, card).
- repeat: { count: N or data: [numbers], layout: "grid" (cols, w, h, gap) | "row" (w) | "column" (h) | "circle" (r) | "free", item: NODE }
  The item's expressions can read i (index 0…), n (count), v (data value): "h": "v*SH*0.4", "x": "i*12-18", "rotation": "i*30". Parts: "ID.*", "ID.0".

## Timeline — a STEP
{ "at": s, "target": "ID" | "ID.*" | "ID.3" | "world" | ["a", "b"], "dur": s, "ease": EASE,
  "from": { PROP: VALUE }, "to": { PROP: VALUE }, "stagger": s, "order": "forward"|"reverse"|"center", "repeat": "loop"|"yoyo" }
- PROP: x, y, rotation, scale, scaleX, scaleY, opacity, skewX, blur, w, h, size, radius, fill, stroke, lineWidth, start, end, zoom, panX, panY, letterSpacing.
- VALUE: a number/expression (absolute), a color for fill/stroke, or relative: "+=6" / "-=10".
- "from" = the state just before the step. For the FIRST step of a target it is also its state from the start of the scene (so a hidden element stays hidden until its step). A property in "from" but not in "to" goes back to the node's declared value: { "from": { "opacity": 0, "y": "+=6" }, "to": {} } = rise into place. In "from", relative values are relative to the declared value; in "to", to the current value.
- "stagger": several targets (or parts) start one after another, s apart.
- "repeat": "loop" restarts until the end of the scene (rotation 360 = endless spin), "yoyo" goes back and forth (pulse, float).
- "at"/"dur" can be expressions: D (scene duration), V (voice-over start, 0 if none), VE (voice end): "at": "V", "dur": "D".
- "world" = the whole scene: animate its scale/x/y/rotation as a camera (zoom in on a detail, slow push, pan).
- Effects on a whole text (not split): { "at", "target": "ID", "effect": "count", "dur" } (its number counts up from 0) ; "effect": "type" (typewriter).
- Sound: { "at": s, "sfx": "whoosh"|"softwhoosh"|"pop"|"click"|"tick"|"impact"|"shimmer"|"riser" } — at most 2 per scene.
- EASE: linear, in, out, inOut, outCubic, outQuart, outExpo, inOutExpo, outBack, inOutBack, outElastic, outBounce, inOutSine (default outCubic).
- The scene is cut at its duration: steps after it never play. "enter" (fade/slide/zoom) plays first, from the previous scene.

## Motion grammar (what makes it read well)
- One focal point at a time; build the scene in 2–4 beats (enter, settle, accent), not everything at once.
- A text's color must stand out from what is behind it: on the background use "ink", on a colored shape use "on-<that color>" (e.g. a text on a "primary" card is "on-primary"); never a dark text on a dark shape or photo.
- Texts are always drawn on top of shapes and images (the compiler keeps them in front): never put a text where a shape or an image sits — give it its own clear area. Split letters or words must end at their own place, never converge onto the same spot.
- Group texts that belong together in ONE stack (title + subtitle + button…): a stack never lets them overlap, in every format. Two free texts must not share the same area.
- A text must be fully visible and still long enough to be read before the scene ends. The compiler fits the whole timeline into the scene and keeps the last ~30 % (up to 1.6 s) to read; ambient moves (a slow push with "dur": "D", a loop) keep running.
- Camera ("world") moves must keep the texts on screen: zoom on a part of an image, not on the text.
- Prefer entrances that reveal (mask with clip, rise + fade, scale from 0.9, draw with "end") and an accent (count, highlight, a shape that sweeps). Avoid moving a text WHILE it must be read.

## Rules
- Never write a text of the brief in the program: always "$KEY". Never invent numbers, prices or claims.
- Only the media indexes listed in the brief exist. Every "target" must be an existing id.
- Answer with ONE \`\`\`json block containing the whole program, and nothing else.`;
