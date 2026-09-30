# @idem/shared-loader

`<idem-loader>`: the only loading indicator of the IDEM platform. One component, shared by every application, so waiting looks the same everywhere. Local spinners (`.loader`, `.spinner`, `pi-spinner pi-spin`, hand-made `animate-spin` rings) have been removed from the design system and must not come back.

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

The sizes are also exported, framework-free, from `@idem/shared-loader` (`IDEM_LOADER_SIZES`) so another renderer can share them.
