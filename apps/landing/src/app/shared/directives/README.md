# Lazy image directive

`LazyImageDirective` (`lazy-image.directive.ts`) loads an image when it approaches the viewport, using `IntersectionObserver`, with a placeholder and CSS state classes.

> **Status: not used.** Every page uses native lazy loading (`loading="lazy"`), which needs no JavaScript. Keep the directive only if a page needs a custom placeholder or loading state; otherwise it can be removed.

## Default: native lazy loading

```html
<img
  src="assets/images/about-page/team-collaboration.jpg"
  alt="African tech team collaboration"
  loading="lazy"
  width="1200"
  height="800"
  class="w-full h-auto object-cover"
/>
```

Always set `width` and `height` (or an `aspect-ratio`) to avoid layout shift, and keep images under about 200 KB. For images known at build time, prefer `NgOptimizedImage` (project rule).

## Directive usage

```ts
import { LazyImageDirective } from '../../shared/directives/lazy-image.directive';

@Component({ imports: [LazyImageDirective], … })
```

```html
<img [appLazyImage]="imageUrl" [placeholder]="placeholderUrl" [alt]="imageAlt" />
```

| Input | Required | Role |
|---|---|---|
| `appLazyImage` | yes | Image URL |
| `placeholder` | no | Image shown until loading completes (default: grey SVG) |

Loading starts 50 px before the image enters the viewport (`rootMargin` in the directive). Without `IntersectionObserver`, the image loads immediately.

State classes added to the `<img>`:

| Class | When |
|---|---|
| `lazy-loading` | While loading |
| `lazy-loaded` | Loaded |
| `lazy-error` | Failed to load |
