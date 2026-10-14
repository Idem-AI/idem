/**
 * LA RÉFÉRENCE D'API DONNÉE À L'AUTEUR — courte, exacte, vérifiée contre la version installée.
 *
 * Jamais la documentation complète de Motion Canvas : ce qu'il faut pour écrire une scène, les
 * signatures, les règles du temps et ce qui est interdit. `MC_SYMBOLS` liste chaque nom cité ;
 * `npm run check:motion` compile une scène qui les importe TOUS depuis les paquets installés :
 * un nom qui n'existe plus (montée de version) fait échouer le contrôle, pas une vidéo.
 */

/** Version de Motion Canvas que décrit cette référence (doit être celle de `package.json`). */
export const MOTION_CANVAS_VERSION = '3.17.2';

/** Les noms cités, par module — importés tous ensemble par le contrôle. */
export const MC_SYMBOLS = {
  '@motion-canvas/2d': ['View2D', 'Node', 'Rect', 'Circle', 'Line', 'Txt', 'Img', 'Video', 'Layout', 'Path', 'Polygon', 'SVG', 'Gradient', 'blur', 'brightness', 'grayscale', 'saturate'],
  '@motion-canvas/core': [
    'all', 'any', 'chain', 'sequence', 'delay', 'loop', 'waitFor', 'spawn',
    'createRef', 'createRefArray', 'createSignal', 'createComputed', 'Vector2', 'Color', 'Direction',
    'linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutBack', 'easeInOutBack', 'easeOutExpo', 'easeInOutExpo', 'easeOutElastic', 'easeOutBounce', 'easeInOutSine', 'easeOutQuart',
    'slideTransition', 'fadeTransition', 'zoomInTransition', 'zoomOutTransition', 'BBox',
    'tween', 'map', 'useThread',
  ],
  '@idem/motion': ['safeArea', 'grid', 'circlePoints', 'fitMedia', 'measureText', 'fitFontSize', 'words', 'readableOn', 'contrast', 'mix', 'alpha', 'beatTime', 'sceneTime', 'waitUntilTime', 'random', 'lerp', 'clamp'],
} as const;

export const API_REFERENCE = `# Motion Canvas ${MOTION_CANVAS_VERSION} — what a scene can use

## File shape (exactly this)
\`\`\`tsx
import { Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, easeOutCubic, waitFor } from '@motion-canvas/core';
import { SceneContext, safeArea, readableOn, sceneTime, waitUntilTime } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  // build nodes with view.add(<…/>), then animate with yield*
}
\`\`\`
Only these three modules can be imported. No React, no DOM, no fetch, no async/await, no Math.random, no Date.

## Coordinates and size
- Origin (0, 0) is the CENTER of the frame. x grows right, y grows DOWN.
- Frame size: ctx.width × ctx.height (story 1080×1920, square 1080×1080, portrait 1080×1350, landscape 1920×1080).
- ctx.unit = 1 % of the shorter side: write sizes as ctx.unit * N so every format works.
- safeArea(ctx) → { left, right, top, bottom, width, height } inside the margins: keep text inside it.
- A node is positioned by its center. offsetX / offsetY (−1…1) move the anchor: offsetX={-1} anchors the left edge, offsetY={1} the bottom.

## The context (never hardcode texts, media or colors)
- ctx.texts.KEY — the exact texts of this scene (keys are given in the brief). Show them EXACTLY.
- ctx.media[i] — { id, kind: 'image' | 'video', url, width, height, note }. Use url as given.
- ctx.brand — { name, colors: { primary, secondary, accent, background, text }, fonts: { display, body }, logo?: { light?, dark?, svg?, width, height } }.
- ctx.duration (seconds), ctx.voice? { text, at, duration }, ctx.beat? { bpm, first }.
- ctx.sfx(kind) — plays a sound now: 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser'. At most 2 per scene.
- The scene is cut at ctx.duration: end with \`yield* waitFor(ctx.duration)\` (extra time is trimmed, it never runs over).

## Nodes (@motion-canvas/2d) — JSX, props are optional
- Every node: x, y, position={[x, y]}, rotation (deg), scale (number or [x, y]), opacity, zIndex, skewX, skewY, offsetX, offsetY, filters={[blur(8)]}, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, ref, children.
- Shapes add: fill (color string or new Gradient(…)), stroke, lineWidth, lineCap ('round'), lineDash={[20, 10]}, lineDashOffset.
- <Rect width height radius clip />  — radius: number or [tl, tr, br, bl]; clip hides children outside it.
- <Circle size startAngle endAngle />  — size = diameter; startAngle/endAngle (deg) draw an arc.
- <Line points={[[x1, y1], [x2, y2], …]} radius stroke lineWidth start end />  — animate end 0→1 to draw it.
- <Path data="M0 0 L100 0" stroke start end />, <Polygon sides={6} size fill />.
- <Txt text fontFamily fontSize fontWeight fill letterSpacing lineHeight textAlign textWrap width />  — textWrap needs a width. Animate text: txt().text('new', 0.6).
- <Img src width height radius />, <Video src width height loop />  (then video().play()).
- <SVG svg={ctx.brand.logo.svg} width />  — vector logo.
- <Layout layout direction="row|column" gap padding alignItems justifyContent wrap width>…</Layout>  — flexbox; children of a layout ignore x/y. Rect with \`layout\` is also a flex box.
- new Gradient({ type: 'linear', from: [-400, 0], to: [400, 0], stops: [{ offset: 0, color: '#…' }, { offset: 1, color: '#…' }] }).
- Filters: blur(px), brightness(v), grayscale(v), saturate(v).

## Refs
const box = createRef<Rect>();  <Rect ref={box} … />  then box().x(200, 0.5).
const items = createRefArray<Txt>();  <Txt ref={items} … /> in a map, then items.map(…).
view.add(<>…</>) adds nodes; box().remove() removes one; view.fill(color) sets the background.

## Time (the core rule)
- node().prop(value, seconds, easing?) returns an animation. \`yield* anim\` WAITS for it; \`yield anim\` starts it in the background.
- node().prop(value) with no duration sets it instantly. Chain: node().scale(1.2, 0.3).to(1, 0.3).
- all(a, b, c) together; sequence(0.1, a, b, c) staggered; chain(a, b) one after another; delay(0.4, a); loop(() => anim) forever (start it with \`yield\`, not \`yield*\`).
- waitFor(seconds). Easings: linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeOutExpo, easeInOutExpo, easeOutBack, easeInOutBack, easeOutElastic, easeOutBounce, easeInOutSine.
- tween(seconds, (t) => { … }) runs a function every frame (t: 0→1); map(a, b, t) interpolates.
- Signals: const n = createSignal(0); <Txt text={() => Math.round(n()).toString()} />; yield* n(1250, 1.2).
- createComputed(() => …) derives a value from signals.
- sceneTime() = seconds since the scene started; waitUntilTime(t) waits until that time (sync with ctx.voice.at). BOTH come from @idem/motion, NOT from @motion-canvas/core.

## Transitions between scenes (call FIRST in the scene, before anything else is awaited)
yield* slideTransition(Direction.Left, 0.6);  // Direction.Left | Right | Top | Bottom
yield* fadeTransition(0.5);
yield* zoomInTransition(new BBox(x, y, w, h), 0.8);  yield* zoomOutTransition(new BBox(x, y, w, h), 0.8);
Or draw your own entrance (a mask Rect that grows, a wipe, a shape that fills the frame).

## Kit helpers (@idem/motion) — tools, not layouts
fitFontSize(text, { maxWidth, max, min?, lines?, fontFamily, fontWeight? }) → largest font size that fits.
measureText(text, size, fontFamily, weight?) → width. words(text) → string[].
fitMedia(media, boxW, boxH, 'cover' | 'contain') → { width, height } (put it inside a Rect with clip).
grid(cols, rows, { width, height, x?, y? }, gap?) → cells { x, y, width, height }. circlePoints(n, r) → points.
readableOn(bg, preferred?) → a text color readable on bg. contrast(a, b), mix(a, b, t), alpha(color, opacity).
beatTime(ctx, n) → time of the n-th music beat in this scene. random(seed) → deterministic random numbers. lerp, clamp.

## Never
- Never type a text of the brief in the code: use ctx.texts.KEY. Never invent prices, numbers or claims.
- Never use Math.random(), Date, setTimeout, fetch, document, window, async/await, React, CSS.
- Never use the <Icon> or <Latex> nodes (they need the network).
`;
