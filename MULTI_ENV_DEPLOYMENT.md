# Guide de Déploiement Multi-Environnements

Ce guide explique comment utiliser la nouvelle architecture multi-environnements pour IDEM, permettant de gérer les environnements de production et de staging.

## Architecture

### Vue d'ensemble

L'architecture utilise :
- **Un seul nginx** partagé pour tous les environnements
- **Docker Compose séparés** pour chaque environnement
- **Réseaux Docker isolés** pour la sécurité
- **Configurations SSL distinctes** pour chaque domaine

### Structure des fichiers

```
├── docker-compose.nginx.yml     # Nginx et Certbot partagés
├── docker-compose.prod.yml      # Services de production
├── docker-compose.staging.yml   # Services de staging
├── .env                         # Variables d'environnement production
├── .env.staging                 # Variables d'environnement staging
├── data/nginx/                  # Configurations nginx
│   ├── idem-ai.com.conf        # Production existante
│   ├── api.idem-ai.com.conf    # Production existante
│   ├── staging.idem-ai.com.conf
│   └── staging-api.idem-ai.com.conf
├── scripts/
│   ├── setup-environments.sh   # Configuration initiale
│   └── deploy-staging.sh       # Déploiement staging
└── staging-letsencrypt.sh      # SSL pour staging
```

## Configuration Initiale

### 1. Configuration des environnements

```bash
# Rendre le script exécutable et l'exécuter
chmod +x scripts/setup-environments.sh
./scripts/setup-environments.sh
```

### 2. Configuration des variables d'environnement

Éditez les fichiers `.env.dev` et `.env.staging` avec vos valeurs :

```bash
# Pour l'environnement de développement
nano .env.dev

# Pour l'environnement de staging
nano .env.staging
```

**Variables importantes à configurer :**
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`
- `FIREBASE_*` (toutes les variables Firebase)
- `JWT_SECRET` et `SESSION_SECRET` (utilisez des valeurs différentes pour chaque env)

## Déploiement

### Environnement de Développement

```bash
# Déployer l'environnement de développement
./scripts/deploy-dev.sh

# Configurer les certificats SSL
./dev-letsencrypt.sh
```

**Services disponibles :**
- Frontend: https://dev.idem-ai.com
- API: https://dev-api.idem-ai.com
- WebGen: https://dev-webgen.idem-ai.com
- AppGen: https://dev-appgen.idem-ai.com
- Chart: https://dev-chart.idem-ai.com

### Environnement de Staging

```bash
# Déployer l'environnement de staging
./scripts/deploy-staging.sh

# Configurer les certificats SSL
./staging-letsencrypt.sh
```

**Services disponibles :**
- Frontend: https://staging.idem-ai.com
- API: https://staging-api.idem-ai.com
- WebGen: https://staging-webgen.idem-ai.com
- AppGen: https://staging-appgen.idem-ai.com
- Chart: https://staging-chart.idem-ai.com

## Gestion des Services

### Commandes utiles

```bash
# Voir le statut de tous les services
docker-compose -f docker-compose.nginx.yml ps
docker-compose -f docker-compose.dev.yml ps
docker-compose -f docker-compose.staging.yml ps

# Redémarrer un environnement
docker-compose -f docker-compose.dev.yml restart
docker-compose -f docker-compose.staging.yml restart

# Voir les logs
docker-compose -f docker-compose.dev.yml logs -f
docker-compose -f docker-compose.staging.yml logs -f

# Arrêter un environnement
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.staging.yml down

# Arrêter nginx (attention : affecte tous les environnements)
docker-compose -f docker-compose.nginx.yml down
```

### Mise à jour d'un service

```bash
# Reconstruire et redéployer un service spécifique
docker-compose -f docker-compose.dev.yml build idem-api-dev
docker-compose -f docker-compose.dev.yml up -d idem-api-dev
```

## Sécurité

### Bonnes pratiques implémentées

1. **Utilisateurs non-root** dans tous les conteneurs
2. **Réseaux isolés** pour chaque environnement
3. **Headers de sécurité** dans nginx
4. **Certificats SSL** automatiques avec Let's Encrypt
5. **Health checks** pour tous les services
6. **Variables d'environnement séparées**

### Configuration DNS

Assurez-vous que les domaines suivants pointent vers votre serveur :

**Développement :**
- dev.idem-ai.com
- dev-api.idem-ai.com
- dev-webgen.idem-ai.com
- dev-appgen.idem-ai.com
- dev-chart.idem-ai.com

**Staging :**
- staging.idem-ai.com
- staging-api.idem-ai.com
- staging-webgen.idem-ai.com
- staging-appgen.idem-ai.com
- staging-chart.idem-ai.com

## Dépannage

### Problèmes courants

1. **Erreur de réseau Docker**
   ```bash
   docker network create idem-shared
   docker network create idem-dev
   docker network create idem-staging
   ```

2. **Problème de certificat SSL**
   ```bash
   # Vérifier les certificats
   docker-compose -f docker-compose.nginx.yml exec nginx ls -la /etc/letsencrypt/live/
   
   # Renouveler les certificats
   docker-compose -f docker-compose.nginx.yml exec certbot certbot renew
   ```

3. **Service qui ne démarre pas**
   ```bash
   # Voir les logs détaillés
   docker-compose -f docker-compose.dev.yml logs service-name
   
   # Reconstruire le service
   docker-compose -f docker-compose.dev.yml build --no-cache service-name
   ```

### Logs

Les logs sont stockés dans :
- `logs/nginx/` - Logs nginx
- `logs/certbot/` - Logs certbot
- `logs/dev/` - Logs environnement dev
- `logs/staging/` - Logs environnement staging

## Migration depuis l'ancienne configuration

Si vous migrez depuis l'ancien `docker-compose.yml` :

1. Sauvegardez vos données existantes
2. Arrêtez les anciens services : `docker-compose down`
3. Suivez la configuration initiale ci-dessus
4. Restaurez vos données si nécessaire

## Support

Pour toute question ou problème, consultez :
- Les logs des services
- La documentation Docker Compose
- Les issues GitHub du projet
