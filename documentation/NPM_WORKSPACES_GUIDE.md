# npm Workspaces Guide - Idem Monorepo

## Overview

This project uses **npm workspaces** to manage a monorepo containing multiple applications.

## Project Structure

```
idem/
├── apps/
│   ├── main-app/           # Angular Application
│   ├── chart/     # Svelte Application (uses pnpm)
│   ├── appgen/       # Generation Application
│   └── api/        # Express API
├── package.json           # Workspace Configuration
└── documentation/
```

## Configuration

The root `package.json` file defines the workspaces:

```json
{
  "workspaces": [
    "apps/main-app",
    "apps/chart",
    "apps/appgen",
    "apps/api"
  ]
}
```

## Available Commands

### Development

```bash
# Start a specific application
npm run dev:ai        # main-app (Angular)
npm run dev:chart     # chart (Svelte)
npm run dev:appgen    # appgen
npm run dev:api       # api (Express)
```

### Build

```bash
# Build a specific application
npm run build:ai
npm run build:chart
npm run build:appgen
npm run build:api

# Build all applications
npm run build:all
```

### Tests and Quality

```bash
# Tests
npm run test:all

# Linting
npm run lint:all
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

### Cleanup

```bash
npm run clean
```

## Dependency Management

### Global Installation

```bash
# Install all workspace dependencies
npm install
```

### Add a Dependency to a Specific Workspace

```bash
# Add a dependency to main-app
npm install <package> --workspace=idem

# Add a dev dependency
npm install <package> -D --workspace=idem
```

### Add a Dependency to All Workspaces

```bash
npm install <package> --workspaces
```

### Run a Command in a Specific Workspace

```bash
npm run <script> --workspace=<workspace-name>
```

### Run a Command in All Workspaces

```bash
npm run <script> --workspaces --if-present
```

## Specifics

### chart (Svelte)

This application uses **pnpm** as its package manager. npm workspace commands still work, but for local development, you can use pnpm directly:

```bash
cd apps/chart
pnpm install
pnpm dev
```

## CI/CD

The CI/CD workflow has been simplified and no longer uses NX. See `.github/workflows/ci.yml` for details.

### Available Workflows

- **ci.yml**: Tests, linting, and build for all projects
- **deploy-nx.yml**: ⚠️ To be deleted or renamed (still contains NX references)

## Migration from NX

This project was migrated from NX to npm workspaces. Main differences:

### Before (NX)
```bash
nx run main-app:serve
nx run-many --target=build --all
nx affected --target=test
```

### After (npm workspaces)
```bash
npm run start --workspace=idem
npm run build --workspaces --if-present
npm run test --workspaces --if-present
```

## Advantages of npm workspaces

- ✅ Simplicity: No complex configuration
- ✅ Standard: Natively integrated into npm
- ✅ Lightweight: No additional dependencies
- ✅ Compatible: Works with all npm tools

## Limitations

- ❌ No intelligent build cache like NX
- ❌ No automatic detection of affected projects
- ❌ No visual dependency graph

## Resources

- [npm workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [npm CLI Guide](https://docs.npmjs.com/cli/v8/commands/npm)
