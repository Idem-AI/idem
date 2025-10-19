# 🏗️ CI/CD Architecture

## Simplified Workflow

The CI/CD system has been optimized to avoid redundant builds and only process modified applications.

### Main Pipeline (`ci.yml`)

```
┌─────────────────────────────────────────────────────────────┐
│                    Push to main/dev/master                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │  🔍 Detect Changes   │
            │  (paths-filter)      │
            └──────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    API changed?  Main App?     Chart?
         │             │             │
         └─────────────┴─────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  🔧 Setup            │
            │  (npm ci)            │
            └──────────┬───────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  ✅ Quality Checks   │
            │  (lint, format)      │
            └──────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Deploy  │  │ Deploy  │  │ Deploy  │
   │   API   │  │Main App │  │  Chart  │
   └─────────┘  └─────────┘  └─────────┘
         │             │             │
         └─────────────┴─────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  📊 Summary          │
            └─────────────────────┘
```

## Detailed Jobs

### 1. 🔍 Detect Changes

- **Duration**: ~10-15s
- **Action**: Detects which `apps/*/` folders have been modified
- **Outputs**: `api`, `main-app`, `chart`, `appgen` (true/false)

### 2. 🔧 Setup

- **Duration**: ~30-60s
- **Condition**: At least one app modified
- **Action**: Installs npm dependencies
- **Skip if**: No app modified

### 3. ✅ Quality Checks

- **Duration**: ~30-60s
- **Condition**: At least one app modified
- **Actions**:
  - Format check (Prettier)
  - Lint (ESLint)
- **Skip if**: No app modified

### 4. 🚀 Deploy Jobs

Each deployment job:

- **Condition**: App modified + push to main/dev/master
- **Action**: Calls the specific deployment workflow
- **Build**: Handled by Docker in the deployment workflow

#### Deploy API

- Calls `.github/workflows/deploy-api.yml`
- Docker build on remote server
- Push to GHCR
- Deployment via docker-compose

#### Deploy Main App

- Calls `.github/workflows/deploy-main-app.yml`
- Docker build on remote server
- Push to GHCR
- Deployment via docker-compose

#### Deploy Chart

- Calls `.github/workflows/deploy-chart.yml`
- Build with pnpm + SvelteKit
- Deployment to GitHub Pages

### 5. 📊 Summary

- **Duration**: ~5s
- **Condition**: Always (if at least one app modified)
- **Action**: Displays a summary of changes and deployments

## Why No Build Jobs?

### ❌ Old System (Redundant)

```
Quality → Build API → Deploy API
                ↓
          Build Docker (re-build!)
```

### ✅ New System (Optimized)

```
Quality → Deploy API
              ↓
         Build Docker (single build)
```

**Advantages**:

- 🚀 **Faster**: One build instead of two
- 💰 **Savings**: Fewer CI/CD minutes
- 🔧 **Simple**: Fewer jobs to maintain
- ✅ **Reliable**: The Docker build is the one that will be deployed

## Typical Execution Times

| Scenario        | Time       | Jobs Executed                          |
| --------------- | ---------- | -------------------------------------- |
| No app changes  | ~1 min     | detect-changes only                    |
| 1 app modified  | ~5-8 min   | detect + setup + quality + deploy (1x) |
| 2 apps modified | ~8-12 min  | detect + setup + quality + deploy (2x) |
| 3 apps modified | ~12-18 min | detect + setup + quality + deploy (3x) |

## Reusable Workflows

### `deploy-api.yml`

- **Type**: `workflow_call`
- **Jobs**: build → push → deploy
- **Server**: SSH to remote server
- **Registry**: GHCR (GitHub Container Registry)

### `deploy-main-app.yml`

- **Type**: `workflow_call`
- **Jobs**: build → push → deploy
- **Server**: SSH to remote server
- **Registry**: GHCR

### `deploy-chart.yml`

- **Type**: `workflow_call`
- **Jobs**: build → deploy
- **Target**: GitHub Pages
- **Framework**: SvelteKit

### `docker-build-push.yml`

- **Type**: `workflow_call`
- **Usage**: Reusable workflow for Docker builds (not currently used)
- **Status**: Available for future use

### `smart-deploy.yml`

- **Status**: ⚠️ DEPRECATED
- **Trigger**: Manual only (`workflow_dispatch`)
- **Reason**: Logic integrated into `ci.yml`

## Triggers

### Automatic

- **Push** to `main`, `develop`, `dev`, `master`
- **Pull Request** to `main`, `develop`, `dev`, `master`

### Manual

- All deployment workflows support `workflow_dispatch`
- Allows manual redeployment of a specific app

## Permissions

The main workflow requires:

- `contents: read` - Read the code
- `pages: write` - Deploy to GitHub Pages
- `id-token: write` - GitHub Pages authentication

## Required Secrets

For API and Main App deployments:

- `SERVER_HOST` - Server address
- `SERVER_USER` - SSH user
- `SSH_PRIVATE_KEY` - SSH private key

## Monitoring

### GitHub Actions UI

- View running workflows in the "Actions" tab
- Each workflow displays a detailed summary
- Skipped jobs are clearly indicated

### Summary

Each execution generates a summary:

```
📊 CI/CD Summary

Changes Detected:
- API: ✅ Changed
- Main App: ⏭️ No changes
- Chart: ⏭️ No changes
- AppGen: ⏭️ No changes

Deployments:
- API: ✅ Deployed
- Main App: ⏭️ Skipped
- Chart: ⏭️ Skipped
```

## Troubleshooting

### Two workflows are running

- Check that no workflow in `apps/*/` has automatic triggers
- `smart-deploy.yml` must only have `workflow_dispatch`

### Builds fail

- Check the specific job logs
- For Docker deployments, check SSH access to the server
- For Chart, check GitHub Pages permissions

### Quality checks fail

- Run locally: `npm run lint:all` and `npm run format:check`
- Fix errors before pushing

## Best Practices

1. **Atomic commits**: One commit = one app modified
2. **Local tests**: Always test before pushing
3. **Feature branches**: Develop on separate branches
4. **Pull Requests**: Use PRs for review before merge

## Future Evolution

Possible improvements:

- Automated tests before deployment
- Automatic rollback on failure
- Slack/Discord notifications
- Performance metrics
- Preview deployments for PRs
