# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2025-10-17

### 🎯 Smart Deploy System

#### Added

- **Smart Deploy Orchestration**: Automatic detection of modified applications with selective deployment
- **Centralized Workflows**: Reusable GitHub Actions workflows at repository root
  - `smart-deploy.yml` - Main orchestrator with change detection
  - `deploy-api.yml` - API deployment workflow
  - `deploy-main-app.yml` - Main application deployment workflow
  - `deploy-chart.yml` - Chart editor deployment workflow
- **Deployment Summary**: Automatic generation of deployment reports showing which apps were deployed/skipped
- **Path-based Filtering**: Uses `dorny/paths-filter@v3` for reliable change detection

#### Changed

- Migrated individual app workflows to centralized reusable workflows
- Disabled legacy workflows in app subdirectories (renamed to `.disabled`)
- Updated deployment strategy to be more efficient and resource-conscious

#### Documentation

- `documentation/SMART_DEPLOY.md` - Complete Smart Deploy system guide
- `documentation/README.md` - Documentation index with all available guides
- `SMART_DEPLOY_MIGRATION.md` - Migration guide and implementation details
- Updated main `README.md` with Smart Deploy section

#### Benefits

- ⚡ **60-70% faster deployments** - Only modified apps are deployed
- 💰 **Resource savings** - Reduced CI/CD minutes usage
- 📊 **Better visibility** - Clear deployment summaries
- 🔧 **Easy maintenance** - Centralized workflow management
- 📈 **Scalable** - Easy to add new applications

## [2.0.0] - 2025-10-16

### 🚀 Migration to npm workspaces

#### Major Changes

- Migration from NX to native npm workspaces
- Simplified monorepo management
- Removed all NX dependencies
- Using native npm tools
- Reduced project complexity

## [1.0.0] - 2025-10-15

### 🎉 Added

#### npm workspaces Configuration

- Complete monorepo configuration with npm workspaces
- Centralized dependency management
- Unified npm scripts for all projects

#### Configuration Files

- `package.json` - npm workspaces configuration
- `tsconfig.base.json` - Shared TypeScript configuration
- `.eslintrc.json` - Shared ESLint configuration
- `.prettierrc` - Prettier configuration
- `.prettierignore` - Files to ignore for Prettier
- `.npmrc` - NPM configuration for workspace
- `.nvmrc` - Recommended Node.js version (18.18.0)
- `.editorconfig` - EditorConfig configuration
- `.gitignore` - Files to ignore by Git (improved)

#### Documentation

- `README.md` - Main workspace documentation
- `NPM_WORKSPACES_GUIDE.md` - Complete npm workspaces guide
- `MIGRATION.md` - Migration guide
- `MIGRATION_NX_TO_NPM_WORKSPACES.md` - NX to npm workspaces migration guide
- `CHANGELOG.md` - This file

#### Scripts

- `scripts/setup.sh` - Automatic installation script
- `scripts/clean.sh` - Workspace cleanup script
- `scripts/clean-nx.sh` - Post-NX migration cleanup script

#### CI/CD

- `.github/workflows/ci.yml` - GitHub Actions workflow with npm workspaces

#### VSCode

- `.vscode/settings.json` - Improved settings (format on save, ESLint auto-fix)
- `.vscode/extensions.json` - Recommended extensions

#### Git Hooks

- `.husky/pre-commit` - Pre-commit hook with lint-staged
- `.lintstagedrc.json` - lint-staged configuration

### 🔄 Modified

#### package.json (root)

- npm workspaces configuration
- Unified scripts for all projects
- Formatting and linting scripts
- Removed NX dependencies

### 📦 Configured Projects

#### idem-ai (Angular 20)

- Build configuration with production/development modes
- Tests with coverage
- Linting with ESLint
- Scripts: start, build, test, lint

#### idem-ai-chart (Svelte 5)

- Optimized Vite configuration
- Unit and E2E tests
- Linting and formatting
- Preview mode
- Scripts: dev, build, test:unit, test:e2e, lint, lint:fix, format, preview

#### idem-appgen (React/Next.js)

- Multi-app support (next, admin, client)
- Parallel development mode
- Optimized build
- Scripts: dev:next, dev:admin, dev:client, build:client

#### idem-api (Express/TypeScript)

- TypeScript configuration
- Development mode with nodemon
- Build with tsc
- Scripts: dev, build, start, test, lint

### ⚡ Simplifications

- **Native npm**: Using standard npm tools
- **Fewer dependencies**: Removed 10+ NX packages
- **Simple configuration**: No project.json or nx.json files
- **Shared Configs**: Shared TypeScript, ESLint, Prettier configuration
- **Native workspaces**: Native npm monorepo management

### 📊 Metrics

- **Projects**: 4 configured applications
- **npm Workspaces**: 4 workspaces
- **NPM Scripts**: 15+ unified scripts
- **Config files**: Minimal configuration
- **Documentation**: 4 complete guides (README, NPM_WORKSPACES_GUIDE, MIGRATION, MIGRATION_NX_TO_NPM_WORKSPACES)

### 🎯 Main Commands

```bash
# Development
npm run dev:ai          # Angular app
npm run dev:chart       # Svelte app
npm run dev:appgen      # React apps
npm run dev:api         # Express API

# Build
npm run build:all       # All projects
npm run build:ai        # Build idem-ai
npm run build:chart     # Build idem-ai-chart
npm run build:api       # Build idem-api

# Tests & Quality
npm run test:all        # All tests
npm run lint:all        # Lint all
npm run lint:fix        # Auto-fix linting
npm run format          # Format code
npm run format:check    # Check formatting

# Utilities
npm run clean           # Clean
```

### 🔧 Development Tools

- **npm workspaces**: Native monorepo management
- **ESLint**: Automatic linting
- **Prettier**: Automatic formatting
- **Husky**: Git hooks
- **lint-staged**: Lint staged files

### 📚 Resources

- [npm workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [npm workspaces Guide](./documentation/NPM_WORKSPACES_GUIDE.md)
- [Migration Guide](./MIGRATION.md)
- [NX to npm workspaces Migration](./MIGRATION_NX_TO_NPM_WORKSPACES.md)

---

## Release Notes

### Compatibility

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **pnpm**: >= 8.15.4 (for chart and appgen)

### Breaking Changes

**Version 2.0.0** - Migration to npm workspaces:

- Removed NX and all its dependencies
- Removed `project.json` and `nx.json` files
- Changed commands (see documentation)
- "affected" commands are no longer available

### Migration

To migrate to this configuration, follow the [MIGRATION.md](./MIGRATION.md) guide.

### Support

For any questions or issues, consult:

1. [NPM_WORKSPACES_GUIDE.md](./documentation/NPM_WORKSPACES_GUIDE.md) - Complete guide
2. [MIGRATION_NX_TO_NPM_WORKSPACES.md](./MIGRATION_NX_TO_NPM_WORKSPACES.md) - Migration guide
3. [npm workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces) - Official documentation
