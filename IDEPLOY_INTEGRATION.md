# Intégration iDeploy → Main Dashboard

## Vue d'ensemble

Le module **Déploiement** du `main-dashboard` se connecte à l'API REST d'**iDeploy** (basé sur Ideploy v4) pour afficher un aperçu global des ressources déployées : applications, bases de données, services Docker et serveurs.

---

## Fichiers créés / modifiés

### 1. Configuration d'environnement

| Fichier                                                           | Rôle                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/main-dashboard/src/environments/environment.ts`             | Config prod — URL + token iDeploy                            |
| `apps/main-dashboard/src/environments/environment.development.ts` | Config dev — URL localhost + token dev                       |
| `apps/main-dashboard/mynode.js`                                   | Script CI/CD — génère `environment.ts` depuis les vars d'env |

**Variables iDeploy :**

```typescript
ideploy: {
  url: 'https://ideploy.idem.africa',   // prod
  apiToken: '<SANCTUM_TOKEN>',
}
```

Variables CI/CD (à définir dans le pipeline) :

```
IDEPLOY_URL=https://ideploy.idem.africa
IDEPLOY_API_TOKEN=<token_sanctum_prod>
```

---

### 2. Modèles TypeScript

**`apps/main-dashboard/src/app/modules/dashboard/models/ideploy.model.ts`**

Interfaces reflétant l'API iDeploy :

- `IDeployApplication` — application déployée (nom, statut, fqdn, build_pack, git_branch…)
- `IDeployDatabase` — base de données managée (type, statut…)
- `IDeployDockerService` — service Docker Compose
- `IDeployServer` — serveur SSH (ip, is_reachable…)
- `IDeployProject` — projet iDeploy
- `IDeploySummary` — agrégat global avec `stats`

---

### 3. Service Angular

**`apps/main-dashboard/src/app/modules/dashboard/services/ideploy.service.ts`**

- Appels HTTP vers `GET /api/v1/applications`, `/databases`, `/services`, `/servers`, `/projects`
- En-tête `Authorization: Bearer <token>` sur chaque requête
- `getSummary()` : `forkJoin` de tous les endpoints → retourne un `IDeploySummary` trié
- `getIDeployUrl()` : retourne l'URL de la plateforme

---

### 4. Intercepteur HTTP (fix critique)

**`apps/main-dashboard/src/app/shared/interceptors/auth.interceptor.ts`**

Modification : si la requête porte déjà un en-tête `Authorization` (token iDeploy), l'intercepteur Firebase **ne le remplace pas**.

```typescript
// Skip Firebase token injection if request already has its own Authorization header
if (req.headers.has('Authorization')) {
  return next(req);
}
```

Sans ce fix, le token Firebase Firebase écrasait le token Sanctum d'iDeploy → erreur 401.

---

### 5. Composant iDeploy Overview

**`apps/main-dashboard/src/app/modules/dashboard/pages/ideploy-overview/`**

| Fichier                 | Contenu                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `ideploy-overview.ts`   | Composant Angular standalone, signals, computed             |
| `ideploy-overview.html` | Template : hero + resource cards + table apps + DBs/Servers |
| `ideploy-overview.css`  | Thème dark premium : grille CSS, icônes circulaires, glow   |

**Signaux exposés :**

```typescript
loading; // boolean
error; // string | null
summary; // IDeploySummary | null
stats; // computed — summary.stats
servers; // computed — summary.servers
appsWithUrl; // computed — apps ayant un fqdn
recentDatabases; // computed — 5 premières DBs
```

**Règle UI :** le bouton d'accès URL n'est affiché **que pour les apps avec statut `Running`** :

```html
@if (app.fqdn && getStatusClass(app.status) === 'status-running') { ... }
```

---

### 6. Route Angular

**`apps/main-dashboard/src/app/app.routes.ts`**

```typescript
{
  path: 'project/ideploy',
  loadComponent: () => import('./modules/dashboard/pages/ideploy-overview/ideploy-overview')
    .then(m => m.IDeployOverview),
}
```

---

### 7. Sidebar

**`apps/main-dashboard/src/app/modules/dashboard/components/sidebar-dashboard/sidebar-dashboard.ts`**

Item "Déploiement" activé et pointant vers `/project/ideploy`.
Clé i18n : `dashboard.sidebar.deployment`

---

## Architecture des appels API

```
main-dashboard (Angular)
       │
       │  GET /api/v1/applications
       │  GET /api/v1/databases        Bearer: <sanctum_token>
       │  GET /api/v1/services    ───►
       │  GET /api/v1/servers
       │  GET /api/v1/projects
       │
       ▼
iDeploy (Laravel 12 + Sanctum)
  https://ideploy.idem.africa
```

Toutes les requêtes sont parallélisées via `forkJoin`. En cas d'erreur individuelle, `catchError(() => of([]))` renvoie un tableau vide pour ne pas bloquer les autres.

---

## Setup production

### Prérequis iDeploy (prod)

1. **Token Sanctum** — généré via tinker sur le serveur prod :

   ```bash
   docker exec -it <container_ideploy_prod> php artisan tinker
   ```

   ```php
   $user = \App\Models\User::first();
   echo $user->createToken('main-dashboard-prod', ['read'])->plainTextToken;
   ```

2. **`allowed_ips`** — doit être `null` pour autoriser l'accès depuis le dashboard :
   ```php
   \App\Models\InstanceSettings::first()->update(['allowed_ips' => null]);
   ```

### Push requis ?

| Application        | Push nécessaire ? | Raison                                                                       |
| ------------------ | ----------------- | ---------------------------------------------------------------------------- |
| **main-dashboard** | ✅ Oui            | Token prod ajouté, nouveau composant, fix intercepteur                       |
| **iDeploy**        | ❌ Non            | Aucun changement de code iDeploy — fix `allowed_ips` fait via DB directement |

### Build production

```bash
# Depuis la racine du monorepo
nx build main-dashboard --configuration=production

# Ou directement
cd apps/main-dashboard && ng build --configuration=production
```

---

## Design UI

Thème dark premium inspiré du style grid/glow :

- **Fond** : grille CSS `rgba(99,102,241,.045)` 52×52px
- **Hero** : icône circulaire avec double anneau de glow, titre gradient, pills de stats
- **Resource cards** : icônes circulaires dégradées (indigo / cyan / vert / ambre), chiffre 2.8rem
- **Table applications** : colonnes Application / Statut / URL / Mis à jour — bordure gauche colorée selon statut
- **Chips de statut** : Running (vert animé), Stopped (rouge), Building (ambre)
- **URL** : affichée uniquement sur les apps `Running`

---

## États gérés

| État                | Rendu                                              |
| ------------------- | -------------------------------------------------- |
| Chargement          | Skeleton cards + rows avec animation pulse         |
| Erreur réseau       | Banner ambre avec bouton Réessayer                 |
| Aucune ressource    | Empty state avec icône circulaire + CTA            |
| Données disponibles | Hero + 4 resource cards + table apps + bottom grid |
