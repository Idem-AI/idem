# @idem/shared-loader

`<idem-loader>`: the only loading indicator of the IDEM platform. It draws the sowing of awalé: eight lozenge seeds set in a circle like the board's pits, lit one after the other in the brand gradient, the way a player drops one seed in each pit before starting the round again. One loader, shared by every application and rendered for each framework (Angular, React, Svelte), so waiting looks the same everywhere. Local spinners (`.loader`, `.spinner`, `pi-spinner pi-spin`, hand-made `animate-spin` rings) have been removed from the design system and must not come back.

## Usage (Angular)

```ts
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
```

```html
<!-- inside a button -->
<button type="button" class="inner-button" [disabled]="saving()">
  @if (saving()) { <idem-loader size="xs" /> }
  {{ 'common.save' | translate }}
</button>

<!-- a page or section that is loading -->
<idem-loader size="lg" [label]="'common.loading' | translate" />
```

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` (16, 20, 32, 48 px) | `md` | Diameter |
| `label` | `string \| null` | `null` | Visible text under the loader, also read by screen readers |
| `block` | boolean attribute | `false` | Takes the full width and centres itself, with space above and below |
| `overlay` | boolean attribute | `false` | Sits over its positioned parent's content instead of replacing it |
| `fullscreen` | boolean attribute | `false` | Covers the whole window |

## Usage (React — iCode / AppGen)

```tsx
import { IdemLoader } from '@idem/shared-loader/react';

<button disabled={saving}>{saving && <IdemLoader size="xs" />} Enregistrer</button>
<IdemLoader fullscreen size="lg" label="Loading..." />
```

## Usage (Svelte 5 — Chart)

```svelte
<script lang="ts">
  import { IdemLoader } from '@idem/shared-loader/svelte';
</script>

<IdemLoader block size="lg" label="Loading diagrams..." />
```

Same props as the Angular inputs (`size`, `label`, `block`, `overlay`, `fullscreen`, `ariaLabel`), plus `className` (React) / `class` (Svelte) on the host. Both renderers import `src/loader.css`, the same rules as the Angular component's styles.

The sizes and the seed geometry are exported, framework-free, from `@idem/shared-loader` (`IDEM_LOADER_SIZES`, `idemLoaderSeeds`) so every renderer draws exactly the same seeds. A page that shows a loader before its framework boots (Chart's `app.html`) inlines the same SVG.
