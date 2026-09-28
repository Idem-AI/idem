# @idem/shared-tour

A framework-agnostic guided-tour engine shared by the IDEM applications (dashboard, simulator, iDeploy web). It builds plain DOM; the host application supplies translated texts and the selectors of its own elements.

## Usage

```ts
import { startTour, isTourActive } from '@idem/shared-tour';

const handle = startTour({
  id: 'dashboard-first-visit',            // stable id, used by the host to remember the tour
  labels: { next, back, skip, finish, stepOf: 'Step {current} of {total}', dialogLabel },
  steps: [
    { target: '#new-project', title: 'Create a project', body: '…', placement: 'bottom' },
    { title: 'You are ready', body: '…' }, // no target: centred on screen
  ],
  onFinish: (completed) => { /* false when skipped or closed */ },
});
```

| Step field | Meaning |
| --- | --- |
| `target` | CSS selector of the element to highlight. Missing or not found: the step is centred |
| `title`, `body` | Texts, already translated |
| `placement` | `top`, `bottom`, `left`, `right` or `auto` |
| `illustration` | SVG markup inserted above the title. It is set with `innerHTML`: it must come from the application's code, never from user input |
| `celebrate` | Adds a small confetti burst to the bubble (e.g. the last step) |
| `before` | Hook run before the step is shown (open a panel, scroll…) |

`startTour` returns a handle with `stop()`, `next()`, `back()` and `currentIndex()`. `isTourActive()` tells whether a tour is running. The styles are injected by the package (`TOUR_STYLES`).

## Remembering tours

The package does not persist anything. The dashboard stores the tours a user has seen on the account, through the API (`GET` / `POST /auth/tours`), so a tutorial is not replayed on another device.
