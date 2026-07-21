# iDeploy Web (Angular 20)

Angular rewrite of the Laravel/Livewire iDeploy UI. Talks to `ideploy-api`
(Node) and shares the `@idem/shared-styles` design system so the look matches
the original Livewire screens.

Conventions mirror `apps/main-dashboard`: standalone components, signals,
`OnPush`, native control flow, reactive forms, functional auth interceptor
(Firebase token), lazy-loaded routes, Tailwind 4 + PrimeNG.

## Vertical slice screens

- `modules/servers` — list, create, validate (SSH), install Docker
- `modules/projects` — list
- `modules/applications` — list + **Deploy** button
- `modules/deploy/deployment-logs` — **live build logs** streamed from Soketi
  (`deployment.{uuid}` channel) — the end-to-end showcase

## Run (dev)

```bash
npm install          # from the monorepo root (workspaces)
npm run start --workspace=ideploy-web   # http://localhost:4202
```

> The remaining ~200 Livewire screens are migrated screen-by-screen per the
> roadmap in `~/.claude/plans/au-niveau-de-ideploy-async-spring.md`. Each ported
> screen reuses the same `ApiService` + design tokens, so it stays visually
> identical to the Laravel original.
```
