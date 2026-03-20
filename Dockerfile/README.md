# Dockerfiles Organization

Cette structure organise les Dockerfiles par environnement pour une meilleure clarté et maintenance.

## Structure

```
Dockerfile/
├── dev/                    # Dockerfiles de développement
│   ├── Dockerfile.api
│   ├── Dockerfile.main-dashboard
│   ├── Dockerfile.landing
│   ├── Dockerfile.chart
│   └── Dockerfile.appgen
└── prod/                   # Dockerfiles de production
    ├── Dockerfile.api
    ├── Dockerfile.main-dashboard
    ├── Dockerfile.main-dashboard.staging
    ├── Dockerfile.landing
    ├── Dockerfile.chart
    ├── Dockerfile.appgen-client
    └── Dockerfile.appgen-server
```

## Dockerfiles de Développement (`dev/`)

**Caractéristiques:**
- Hot-reload activé pour tous les services
- Volumes montés pour le code source
- Packages partagés buildés en premier
- Optimisés pour la rapidité de développement
- Pas de multi-stage build
- Utilisés par `docker-compose.dev.yml`

**Services:**
- **API** (`Dockerfile.api`): Node.js avec nodemon, port 3000
- **Main Dashboard** (`Dockerfile.main-dashboard`): Angular dev server, port 4200
- **Landing** (`Dockerfile.landing`): Angular SSR dev server, port 4201
- **Chart** (`Dockerfile.chart`): Vite dev server avec pnpm, port 3004
- **AppGen** (`Dockerfile.appgen`): Turborepo (client + server), ports 3002-3003

## Dockerfiles de Production (`prod/`)

**Caractéristiques:**
- Multi-stage build pour optimisation
- Images minimales et sécurisées
- Utilisateurs non-root
- Optimisés pour la performance
- Build AOT pour Angular
- Utilisés par les pipelines CI/CD

**Services:**
- **API** (`Dockerfile.api`): Build TypeScript + runtime optimisé
- **Main Dashboard** (`Dockerfile.main-dashboard`): Build Angular + Nginx
- **Main Dashboard Staging** (`Dockerfile.main-dashboard.staging`): Version staging
- **Landing** (`Dockerfile.landing`): Build Angular SSR + serveur Node
- **Chart** (`Dockerfile.chart`): Build Vite + serveur statique
- **AppGen Client** (`Dockerfile.appgen-client`): Build React/Vite
- **AppGen Server** (`Dockerfile.appgen-server`): Build Next.js

## Utilisation

### Développement

```bash
# Build tous les services de développement
docker compose -f docker-compose.dev.yml build

# Démarrer tous les services
docker compose -f docker-compose.dev.yml up -d

# Démarrer un service spécifique
docker compose -f docker-compose.dev.yml up -d api
```

### Production

```bash
# Build un service de production
docker build -f Dockerfile/prod/Dockerfile.api -t idem-api:prod .

# Build avec arguments
docker build -f Dockerfile/prod/Dockerfile.api --build-arg BUILD_ENV=production -t idem-api:prod .
```

## Packages Partagés

Tous les Dockerfiles buildent les packages partagés en premier:
- `@idem/shared-models`: Modèles TypeScript
- `@idem/shared-auth-client`: Service d'authentification Angular
- `@idem/shared-styles`: Design system Tailwind CSS

## Notes

- Les Dockerfiles de dev utilisent `node:20-alpine` pour la légèreté
- Les Dockerfiles de prod incluent des optimisations de sécurité
- Les volumes anonymes évitent les conflits `node_modules` en dev
- Le context de build est toujours la racine du projet (`.`)
