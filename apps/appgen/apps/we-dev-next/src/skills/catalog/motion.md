---
name: motion
description: Purposeful animation - easing, timing, scroll reveals that cannot ship blank, and reduced-motion behaviour.
tier: contextual
priority: 40
triggers: [animation, animate, motion, transition, scroll, parallax, hover, interactive, micro-interaction, reveal, smooth, dynamic]
---

# Motion

Motion is part of the build, not a coat of paint at the end. It is also where generated sites betray themselves: one identical fade-up applied to every section is a reflex, not a decision.

## Timing and easing

- Micro-interactions (hover, focus, button press): 120–180 ms.
- Element transitions (dropdown, tooltip, tab): 200–280 ms.
- Layout or page-level: 320–450 ms. Beyond 500 ms it feels broken.
- Ease out with exponential curves: `cubic-bezier(0.22, 1, 0.36, 1)`. No bounce, no elastic, no `ease-in-out` on entrances.
- Animate `transform` and `opacity`. Animating `width`, `height`, `top` or `margin` costs a layout pass on every frame.

## Reveals that cannot ship blank

Never gate content visibility on a class-triggered transition. Transitions pause on hidden tabs and never fire in headless renderers, so the section ships empty.

Correct: content is visible by default, and the reveal *enhances* it.

```jsx
// The element is visible in CSS; IntersectionObserver only adds the flourish.
<section className="motion-safe:opacity-0 motion-safe:translate-y-4 motion-safe:data-[visible=true]:opacity-100 motion-safe:data-[visible=true]:translate-y-0 transition-all duration-500">
```

Under `prefers-reduced-motion`, `motion-safe:` variants drop out and the content is simply there.

## Avoid the uniform reflex

Do not apply the same entrance to every section. Staggering the items *within* one list is legitimate and reads as craft. The tell is the identical treatment repeated down the page. Each reveal should suit what it reveals: a table does not enter like a hero.

## Reduced motion is not optional

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Libraries

For anything beyond CSS transitions, `motion` (Framer Motion's successor) for component motion, `gsap` for scroll timelines, `lenis` for smooth scroll. Add them to `package.json`; do not hand-roll `requestAnimationFrame` loops.

Never animate on scroll position without throttling through `IntersectionObserver` or a scroll library.
