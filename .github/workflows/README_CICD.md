# CI/CD Pipeline - Idem Project

## 📋 Vue d'ensemble

Le projet Idem utilise GitHub Actions pour automatiser le build, les tests et le déploiement de ses différents services.

## 🏗️ Structure

```
.github/workflows/
├── ci.yml                      # Pipeline principal (détection + déploiements)
├── deploy-landing.yml          # Déploiement Landing Page
├── deploy-main-dashboard.yml   # Déploiement Dashboard
├── deploy-api.yml              # Déploiement API
└── deploy-chart.yml            # Déploiement Chart
```

## 🔄 Workflow Principal (ci.yml)

### Déclencheurs

- **Push** sur `main` ou `dev`
- **Pull Request** vers `main` ou `dev`

### Étapes

#### 1️⃣ Détection des Changements

Détecte automatiquement quels services ont été modifiés :

- `apps/api/**` → API
- `apps/landing/**` → Landing Page
- `apps/main-dashboard/**` → Dashboard
- `apps/chart/**` → Chart
- `apps/appgen/**` → AppGen
- `packages/**` → Packages partagés

#### 2️⃣ Quality Checks

- Installation des dépendances (npm)
- Vérification du formatage (Prettier)
- Linting (ESLint)

#### 3️⃣ Déploiements Conditionnels

Déploie uniquement les services modifiés :

- ✅ Changements détectés → Déploiement
- ⏭️ Pas de changements → Skip

#### 4️⃣ Résumé

Affiche un résumé des changements et déploiements

## 🚀 Workflows de Déploiement

### Architecture Simplifiée

Chaque workflow de déploiement suit le même pattern :

```yaml
1. Checkout du code
2. Récupération du commit ID
3. SSH vers le serveur
├── Pull du code
├── Build de l'image Docker
├── Push vers GHCR
├── Mise à jour docker-compose.yml
└── Redémarrage du service
```

### Landing Page (deploy-landing.yml)

**Image:** `ghcr.io/idem-ai/idem-landing`
**Dockerfile:** `Dockerfile.landing`
**Service:** `idem-landing`

```bash
# Déploiement manuel
gh workflow run deploy-landing.yml
```

### Main Dashboard (deploy-main-dashboard.yml)

**Image:** `ghcr.io/idem-ai/idem-main-dashboard`
**Dockerfile:** `Dockerfile.main-dashboard`
**Service:** `idem` (dans docker-compose.yml)

```bash
# Déploiement manuel
gh workflow run deploy-main-dashboard.yml
```

## 🔐 Secrets Requis

Configurez ces secrets dans GitHub Settings → Secrets and variables → Actions :

| Secret            | Description                             |
| ----------------- | --------------------------------------- |
| `SERVER_HOST`     | IP ou domaine du serveur de déploiement |
| `SERVER_USER`     | Utilisateur SSH (ex: root)              |
| `SSH_PRIVATE_KEY` | Clé privée SSH pour l'authentification  |
| `GITHUB_TOKEN`    | Token pour push vers GHCR (auto-généré) |

## 📦 Images Docker

Toutes les images sont publiées sur GitHub Container Registry :

```
ghcr.io/idem-ai/idem-landing:latest
ghcr.io/idem-ai/idem-landing:<commit-id>

ghcr.io/idem-ai/idem-main-dashboard:latest
ghcr.io/idem-ai/idem-main-dashboard:<commit-id>

ghcr.io/idem-ai/idem-api:latest
ghcr.io/idem-ai/idem-api:<commit-id>

ghcr.io/idem-ai/idem-chart:latest
ghcr.io/idem-ai/idem-chart:<commit-id>
```

## 🌍 Environnements

### Production (`main` branch)

- Déploiement automatique sur push
- Utilise `docker-compose.yml`
- URL: https://idem-ai.com

### Staging (`dev` branch)

- Déploiement automatique sur push
- Utilise `docker-compose.yml` (même fichier)
- URL: https://dev.idem-ai.com (si configuré)

## 🛠️ Configuration Serveur

### Prérequis sur le Serveur

```bash
# Docker & Docker Compose
apt-get update
apt-get install -y docker.io docker-compose

# Git
apt-get install -y git

# Clone du repository
cd /root
git clone https://github.com/Idem-AI/idem/idem.git
cd idem
```

### Structure sur le Serveur

```
/root/idem/
├── docker-compose.yml
├── Dockerfile.landing
├── Dockerfile.main-dashboard
├── apps/
├── packages/
└── .env
```

## 📊 Monitoring

### Vérifier le Status des Workflows

```bash
# Via GitHub CLI
gh run list --workflow=ci.yml

# Voir les logs
gh run view <run-id> --log
```

### Vérifier les Déploiements sur le Serveur

```bash
# SSH vers le serveur
ssh root@<SERVER_HOST>

# Voir les conteneurs
docker ps

# Voir les logs
docker logs idem-landing
docker logs idem

# Voir les images
docker images | grep idem
```

## 🐛 Debugging

### Workflow échoue au build

```bash
# SSH vers le serveur
cd /root/idem
git pull
docker build -f Dockerfile.landing -t test .
```

### Workflow échoue au push

```bash
# Vérifier l'authentification GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin
```

### Service ne démarre pas

```bash
# Voir les logs
docker-compose logs idem-landing

# Redémarrer manuellement
docker-compose up -d idem-landing
```

## 🔄 Rollback

### Revenir à une version précédente

```bash
# Sur le serveur
cd /root/idem

# Lister les images disponibles
docker images | grep idem-landing

# Modifier docker-compose.yml
sed -i "s|image: ghcr.io/idem-ai/idem-landing:.*|image: ghcr.io/idem-ai/idem-landing:<old-commit-id>|" docker-compose.yml

# Redémarrer
docker-compose pull idem-landing
docker-compose up -d idem-landing
```

## 📈 Optimisations

### Cache Docker

Les workflows utilisent le cache Docker du serveur pour accélérer les builds.

### Builds Conditionnels

Seuls les services modifiés sont buildés et déployés.

### Cleanup Automatique

Les anciennes images Docker sont nettoyées automatiquement après chaque déploiement.

## 🎯 Bonnes Pratiques

1. **Toujours tester localement** avant de push
2. **Utiliser des branches** pour les nouvelles fonctionnalités
3. **Créer des Pull Requests** pour review
4. **Vérifier les logs** après déploiement
5. **Monitorer les ressources** du serveur

## 📝 Changelog

### v2.0 (Actuel)

- ✅ Workflows simplifiés (1 job au lieu de 3)
- ✅ Utilisation de npm au lieu de pnpm
- ✅ Chemins corrigés (/root/idem)
- ✅ Résolution des conflits de merge
- ✅ Noms d'images cohérents
- ✅ Cleanup automatique des images

### v1.0 (Ancien)

- ❌ 3 jobs séparés (build, push, deploy)
- ❌ Conflits de merge non résolus
- ❌ Chemins incohérents
- ❌ Utilisation de pnpm (non installé)

## 🆘 Support

En cas de problème :

1. Vérifier les logs GitHub Actions
2. SSH vers le serveur et vérifier les logs Docker
3. Consulter ce README
4. Contacter l'équipe DevOps
