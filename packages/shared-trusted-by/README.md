# @idem/shared-trusted-by

The scrolling "They trust us" band — IDEM's tech communities and partners — shared by the landing pages of the monorepo.

One partner list, one stylesheet, one renderer per framework. A partner is added in one place.

## Contents

| File | Role |
| --- | --- |
| `partners.json` | The partner list. **The source of truth.** |
| `assets/` | The logos, in `kebab-case` (spaces break some URLs). |
| `src/trusted-by.css` | The stylesheet, shared by the renderers. |
| `src/angular/` | The Angular component, `<idem-trusted-by>`. |
| `src/react/` | The React component, `<TrustedBy />`. |
| `src/index.ts` | The data only, no framework. |

The renderers have separate entry points so a React app does not bundle Angular, and the other way round.

## Usage

### Angular

```ts
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';

@Component({
  imports: [TrustedByComponent],
  template: `<idem-trusted-by [label]="'landing.trustedBy' | translate" />`,
})
```

### React

```tsx
import { TrustedBy } from '@idem/shared-trusted-by/react';

<TrustedBy label={t('landing.trustedBy')} />;
```

Without `label`, no heading is rendered — that is what the main landing does, where the band closes the hero.

## The logos must be copied

A shared component is not enough: each application serves its own static files, so the logos must exist in each app's `public/`, under `/assets/images/trust-by`.

```bash
npm run sync:trusted-by     # copy the logos into every application
npm run check:trusted-by    # check without copying (for CI)
```

An application that serves its images elsewhere says so: `<idem-trusted-by basePath="/static/partners" />`.

## Adding a partner

1. Put the logo in `assets/`, in `kebab-case`.
2. Add the entry to `partners.json`.
3. Run `npm run sync:trusted-by` at the repository root and commit the result.

No application needs to change.

## Applications using it

`landing`, `ideploy-web`, `simulation` and the AppGen client.

Intentionally absent: `chart` and `main-dashboard`, which have no landing page.

## A note on Angular versions

The package is consumed as source, outside `node_modules`: its `import … from '@angular/core'` resolves up to the monorepo root. An application whose Angular version differs from the one hoisted there must pin its own, otherwise two copies of the framework end up in the bundle:

```jsonc
// apps/<app>/tsconfig.json
"paths": { "@angular/*": ["./node_modules/@angular/*"] }
```

This is what `simulation` does (Angular 22, against Angular 20 at the root). On the React side, AppGen gets the same result with Vite's `resolve.dedupe`.
