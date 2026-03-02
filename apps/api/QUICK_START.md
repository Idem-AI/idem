# Guide de Démarrage Rapide - IDEM API

## Stack Technique

- **Base de données :** MongoDB
- **Authentification :** Casdoor (open-source)
- **Stockage :** MinIO (S3-compatible)
- **Cache :** Redis
- **Backend :** Node.js + Express + TypeScript

## Démarrage en 3 étapes

### 1. Prérequis

```bash
# Vérifier Node.js (>= 18)
node --version

# Vérifier Docker
docker --version
docker-compose --version
```

### 2. Installation

```bash
# Cloner et naviguer
cd apps/api

# Démarrer TOUT (Docker + API)
./start.sh
```

Le script `start.sh` va :
- ✅ Démarrer Casdoor, MinIO, MongoDB, Redis (Docker)
- ✅ Créer le fichier `.env` si nécessaire
- ✅ Installer les dépendances npm
- ✅ Démarrer l'API en mode dev

### 3. Vérification

Ouvrir dans le navigateur :

| Service | URL | Credentials |
|---------|-----|-------------|
| **API** | http://localhost:3001 | - |
| **Casdoor** | http://localhost:8000 | admin / 123 |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin123 |

## Configuration Casdoor (Première fois)

1. Ouvrir http://localhost:8000
2. Login : `admin` / `123`
3. Créer une organisation : `idem`
4. Créer une application : `idem-api`
5. Copier le **Client ID** et **Client Secret**
6. Mettre à jour `.env` :

```bash
CASDOOR_CLIENT_ID=<votre-client-id>
CASDOOR_CLIENT_SECRET=<votre-client-secret>
```

7. Redémarrer l'API : `npm run dev`

## Commandes Utiles

### Docker

```bash
# Démarrer les services
docker-compose up -d

# Arrêter les services
docker-compose down

# Voir les logs
docker-compose logs -f

# Redémarrer un service
docker-compose restart casdoor
```

### API

```bash
# Mode développement
npm run dev

# Build
npm run build

# Production
npm start
```

### Base de données

```bash
# MongoDB Shell
mongosh mongodb://admin:admin123@localhost:27017/idem?authSource=admin

# Commandes MongoDB
> show dbs
> use idem
> show collections
> db.users.find().limit(5)
```

### MinIO

```bash
# Installer MinIO Client
brew install minio/stable/mc

# Configurer
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Lister buckets
mc ls local/

# Lister fichiers
mc ls local/idem-storage/
```

## Test de l'API

### Health Check

```bash
curl http://localhost:3001/
```

### Authentification

```bash
# 1. Obtenir l'URL d'authentification
curl http://localhost:3001/auth/url

# 2. Ouvrir l'URL dans le navigateur et se connecter

# 3. Vérifier la session
curl http://localhost:3001/auth/profile \
  -H "Cookie: session=YOUR_JWT_TOKEN"
```

## Structure du Projet

```
apps/api/
├── api/
│   ├── config/
│   │   ├── casdoor.config.ts      # Configuration Casdoor
│   │   ├── minio.config.ts        # Configuration MinIO
│   │   └── mongodb.config.ts      # Configuration MongoDB
│   ├── controllers/
│   │   └── auth.controller.ts     # Authentification Casdoor
│   ├── services/
│   │   └── auth.service.ts        # Middleware JWT
│   ├── schemas/                   # Schémas Mongoose
│   └── index.ts                   # Point d'entrée
├── docker-compose.yml             # Services Docker
├── .env                           # Variables d'environnement
└── start.sh                       # Script de démarrage
```

## Variables d'Environnement

Fichier `.env` :

```bash
# MongoDB
MONGODB_URI=mongodb://admin:admin123@localhost:27017/idem?authSource=admin

# Casdoor
CASDOOR_ENDPOINT=http://localhost:8000
CASDOOR_CLIENT_ID=<votre-client-id>
CASDOOR_CLIENT_SECRET=<votre-client-secret>
CASDOOR_ORGANIZATION=idem
CASDOOR_APPLICATION=idem-api

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=idem-storage

# JWT
JWT_SECRET=<générer-une-clé-secrète>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
```

## Troubleshooting

### Erreur : "Cannot connect to MongoDB"

```bash
# Vérifier que MongoDB est démarré
docker-compose ps

# Redémarrer MongoDB
docker-compose restart mongodb
```

### Erreur : "Casdoor SDK not initialized"

```bash
# Vérifier que Casdoor est accessible
curl http://localhost:8000

# Vérifier les credentials dans .env
cat .env | grep CASDOOR
```

### Erreur : "MinIO bucket not found"

```bash
# Le bucket est créé automatiquement au démarrage
# Si problème, créer manuellement :
docker exec -it idem-minio mc mb /data/idem-storage
```

### Port déjà utilisé

```bash
# Vérifier les ports utilisés
lsof -i :3001  # API
lsof -i :8000  # Casdoor
lsof -i :9000  # MinIO

# Tuer le processus
kill -9 <PID>
```

## Documentation Complète

- **Migration :** `CASDOOR_MINIO_MIGRATION.md` - Guide complet de migration
- **MongoDB :** `MONGODB_ONLY.md` - Documentation MongoDB
- **Firestore :** `FIRESTORE_REMOVAL_SUMMARY.md` - Résumé suppression Firestore

## Support

Pour toute question :

1. Vérifier les logs : `docker-compose logs -f`
2. Vérifier l'API : `npm run dev` (voir les logs)
3. Consulter la documentation complète

## Prochaines Étapes

1. ✅ Configurer Casdoor avec vos OAuth providers (Google, GitHub)
2. ✅ Tester l'authentification end-to-end
3. ✅ Migrer les utilisateurs existants (si nécessaire)
4. ✅ Configurer MinIO pour la production
5. ✅ Déployer sur votre infrastructure

---

**Stack 100% Open Source - Aucune dépendance Firebase** 🎉
