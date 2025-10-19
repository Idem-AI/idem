# 🏗️ CI/CD Architecture

## Workflow Simplifié

Le système CI/CD a été optimisé pour éviter les builds redondants et ne traiter que les applications modifiées.

### Pipeline Principal (`ci.yml`)

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

## Jobs Détaillés

### 1. 🔍 Detect Changes

- **Durée**: ~10-15s
- **Action**: Détecte quels dossiers `apps/*/` ont été modifiés
- **Outputs**: `api`, `main-app`, `chart`, `appgen` (true/false)

### 2. 🔧 Setup

- **Durée**: ~30-60s
- **Condition**: Au moins une app modifiée
- **Action**: Installe les dépendances npm
- **Skip si**: Aucune app modifiée

### 3. ✅ Quality Checks

- **Durée**: ~30-60s
- **Condition**: Au moins une app modifiée
- **Actions**:
  - Format check (Prettier)
  - Lint (ESLint)
- **Skip si**: Aucune app modifiée

### 4. 🚀 Deploy Jobs

Chaque job de déploiement :

- **Condition**: App modifiée + push vers main/dev/master
- **Action**: Appelle le workflow de déploiement spécifique
- **Build**: Géré par Docker dans le workflow de déploiement

#### Deploy API

- Appelle `.github/workflows/deploy-api.yml`
- Build Docker sur le serveur distant
- Push vers GHCR
- Déploiement via docker-compose

#### Deploy Main App

- Appelle `.github/workflows/deploy-main-app.yml`
- Build Docker sur le serveur distant
- Push vers GHCR
- Déploiement via docker-compose

#### Deploy Chart

- Appelle `.github/workflows/deploy-chart.yml`
- Build avec pnpm + SvelteKit
- Déploiement vers GitHub Pages

### 5. 📊 Summary

- **Durée**: ~5s
- **Condition**: Toujours (si au moins une app modifiée)
- **Action**: Affiche un résumé des changements et déploiements

## Pourquoi Pas de Build Jobs ?

### ❌ Ancien Système (Redondant)

```
Quality → Build API → Deploy API
                ↓
          Build Docker (re-build!)
```

### ✅ Nouveau Système (Optimisé)

```
Quality → Deploy API
              ↓
         Build Docker (build unique)
```

**Avantages**:

- 🚀 **Plus rapide**: Un seul build au lieu de deux
- 💰 **Économie**: Moins de minutes CI/CD
- 🔧 **Simple**: Moins de jobs à maintenir
- ✅ **Fiable**: Le build Docker est celui qui sera déployé

## Temps d'Exécution Typiques

| Scénario             | Temps      | Jobs Exécutés                          |
| -------------------- | ---------- | -------------------------------------- |
| Aucun changement app | ~1 min     | detect-changes uniquement              |
| 1 app modifiée       | ~5-8 min   | detect + setup + quality + deploy (1x) |
| 2 apps modifiées     | ~8-12 min  | detect + setup + quality + deploy (2x) |
| 3 apps modifiées     | ~12-18 min | detect + setup + quality + deploy (3x) |

## Workflows Réutilisables

### `deploy-api.yml`

- **Type**: `workflow_call`
- **Jobs**: build → push → deploy
- **Serveur**: SSH vers serveur distant
- **Registry**: GHCR (GitHub Container Registry)

### `deploy-main-app.yml`

- **Type**: `workflow_call`
- **Jobs**: build → push → deploy
- **Serveur**: SSH vers serveur distant
- **Registry**: GHCR

### `deploy-chart.yml`

- **Type**: `workflow_call`
- **Jobs**: build → deploy
- **Cible**: GitHub Pages
- **Framework**: SvelteKit

### `docker-build-push.yml`

- **Type**: `workflow_call`
- **Usage**: Workflow réutilisable pour builds Docker (non utilisé actuellement)
- **Statut**: Disponible pour usage futur

### `smart-deploy.yml`

- **Statut**: ⚠️ DEPRECATED
- **Trigger**: Manual uniquement (`workflow_dispatch`)
- **Raison**: Logique intégrée dans `ci.yml`

## Déclencheurs

### Automatiques

- **Push** vers `main`, `develop`, `dev`, `master`
- **Pull Request** vers `main`, `develop`, `dev`, `master`

### Manuels

- Tous les workflows de déploiement supportent `workflow_dispatch`
- Permet de redéployer manuellement une app spécifique

## Permissions

Le workflow principal nécessite :

- `contents: read` - Lire le code
- `pages: write` - Déployer sur GitHub Pages
- `id-token: write` - Authentification GitHub Pages

## Secrets Requis

Pour les déploiements API et Main App :

- `SERVER_HOST` - Adresse du serveur
- `SERVER_USER` - Utilisateur SSH
- `SSH_PRIVATE_KEY` - Clé privée SSH

## Monitoring

### GitHub Actions UI

- Voir les workflows en cours dans l'onglet "Actions"
- Chaque workflow affiche un résumé détaillé
- Les jobs skippés sont clairement indiqués

### Summary

Chaque exécution génère un résumé :

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

### Deux workflows se lancent

- Vérifiez qu'aucun workflow dans `apps/*/` n'a de trigger automatique
- `smart-deploy.yml` doit avoir uniquement `workflow_dispatch`

### Builds échouent

- Vérifiez les logs du job spécifique
- Pour les déploiements Docker, vérifiez l'accès SSH au serveur
- Pour Chart, vérifiez les permissions GitHub Pages

### Quality checks échouent

- Exécutez localement : `npm run lint:all` et `npm run format:check`
- Corrigez les erreurs avant de pousser

## Best Practices

1. **Commits atomiques** : Un commit = une app modifiée
2. **Tests locaux** : Toujours tester avant de pousser
3. **Branches feature** : Développer sur des branches séparées
4. **Pull Requests** : Utiliser des PRs pour review avant merge

## Évolution Future

Améliorations possibles :

- Tests automatisés avant déploiement
- Rollback automatique en cas d'échec
- Notifications Slack/Discord
- Métriques de performance
- Preview deployments pour PRs
