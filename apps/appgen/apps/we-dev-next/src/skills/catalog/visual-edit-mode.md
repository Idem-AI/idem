---
name: visual-edit-mode
description: JSX shape required by the visual Edit mode, where users click elements in the live preview and the change is written back into the source.
tier: core
priority: 80
---

# Write JSX the visual editor can edit

The generated site is edited in a visual Edit mode: the user clicks an element in the live preview to change its text, image or styles, to reorder it, or to delete it, and the edit is written back into this JSX automatically. Markup that does not map cleanly to editable elements silently loses that capability.

1. **Text in leaf elements.** Each piece of user-facing text sits directly inside one leaf element with no nested element around it. `<h1>Title</h1>`, not `<h1><span>Title</span></h1>`. A leaf whose only child is text is inline-editable; text wrapped in extra spans is not.

2. **Explicit sibling blocks.** For the small fixed set of presentational blocks a user is likely to rearrange or remove — hero, feature cards, testimonials, pricing tiers, steps, gallery items — write them as repeated sibling JSX elements, **not** `{items.map(...)}`. Elements produced by `.map()` or by `{condition && <X/>}` cannot be individually reordered or deleted. Use `.map()` only for genuinely data-driven or unbounded lists.

3. **Direct children.** Keep those blocks as direct children of a plain `<section>` or `<div>`. No extra Fragment, no one-off wrapper component around each block: the editor matches siblings by their real DOM parent.

4. **Real `<img>` tags** for content images, with a meaningful `alt`. Not CSS `background-image`, which is neither selectable nor replaceable.

5. **Plain string `className`** on presentational leaf elements. Avoid `clsx()`, `cn()` and template literals there; keep those for genuinely conditional state.

6. **One element per line, well indented.** Visual edits are written back into this source, and clean input keeps the diff clean.
