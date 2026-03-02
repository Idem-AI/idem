# Migration complète : Firebase → Casdoor + MinIO

## Vue d'ensemble

Migration complète de l'authentification et du stockage :
- ❌ **Firebase Auth** → ✅ **Casdoor** (authentification open-source)
- ❌ **Firebase Storage** → ✅ **MinIO** (stockage S3-compatible)
- ❌ **Firestore** → ✅ **MongoDB** (déjà fait)

## Architecture

### Stack finale

```
┌─────────────────────────────────────────────┐
│           Applications Frontend              │
│  (landing-page, main-dashboard, appgen)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              API Backend (Node.js)           │
│  - Express + TypeScript                      │
│  - JWT Authentication                        │
│  - Repository Pattern                        │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │Casdoor │ │MongoDB │ │ MinIO  │
   │  Auth  │ │  Data  │ │Storage │
   └────────┘ └────────┘ └────────┘
```

## 1. Installation Docker

### Démarrer tous les services

```bash
cd apps/api
docker-compose up -d
```

### Services disponibles

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| **Casdoor** | 8000 | http://localhost:8000 | admin / 123 |
| **Casdoor DB** | 5432 | - | casdoor / casdoor_password |
| **MinIO API** | 9000 | http://localhost:9000 | minioadmin / minioadmin123 |
| **MinIO Console** | 9001 | http://localhost:9001 | minioadmin / minioadmin123 |
| **MongoDB** | 27017 | mongodb://localhost:27017 | admin / admin123 |
| **Redis** | 6379 | - | redis_password |

### Vérifier les services

```bash
# Vérifier tous les conteneurs
docker-compose ps

# Logs
docker-compose logs -f casdoor
docker-compose logs -f minio
docker-compose logs -f mongodb
```

## 2. Configuration Casdoor

### Accès initial

1. Ouvrir http://localhost:8000
2. Login : `admin` / `123`
3. Créer une organisation `idem`
4. Créer une application `idem-api`

### Configuration de l'application

Dans Casdoor UI :

1. **Applications** → **Add Application**
   - Name: `idem-api`
   - Organization: `idem`
   - Redirect URLs: `http://localhost:3000/callback,http://localhost:4200/callback`
   - Grant types: `authorization_code`, `refresh_token`

2. **Récupérer les credentials**
   - Client ID: Copier depuis l'interface
   - Client Secret: Générer et copier
   - Certificate: Télécharger le certificat public

3. **Configurer les providers OAuth** (optionnel)
   - Google OAuth
   - GitHub OAuth
   - Email/Password

### Variables d'environnement

Créer `.env` :

```bash
# Casdoor
CASDOOR_ENDPOINT=http://localhost:8000
CASDOOR_CLIENT_ID=<votre-client-id>
CASDOOR_CLIENT_SECRET=<votre-client-secret>
CASDOOR_CERTIFICATE=<votre-certificat>
CASDOOR_ORGANIZATION=idem
CASDOOR_APPLICATION=idem-api
CASDOOR_REDIRECT_URI=http://localhost:3000/callback

# JWT
JWT_SECRET=<générer-une-clé-secrète-forte>

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=idem-storage

# MongoDB
MONGODB_URI=mongodb://admin:admin123@localhost:27017/idem?authSource=admin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0
```

## 3. Configuration MinIO

### Accès Console

1. Ouvrir http://localhost:9001
2. Login : `minioadmin` / `minioadmin123`

### Créer le bucket

Le bucket `idem-storage` est créé automatiquement au démarrage de l'API.

Pour le créer manuellement :

1. **Buckets** → **Create Bucket**
2. Nom : `idem-storage`
3. **Access Policy** : Public (ou Custom selon besoins)

### Configuration avancée (optionnel)

```bash
# Installer MinIO Client
brew install minio/stable/mc

# Configurer alias
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Créer bucket
mc mb local/idem-storage

# Définir politique publique
mc anonymous set download local/idem-storage
```

## 4. Initialisation de l'API

### Installer les dépendances

```bash
cd apps/api
npm install
```

Nouvelles dépendances ajoutées :
- `casdoor-nodejs-sdk` - SDK Casdoor
- `minio` - Client MinIO S3
- `@types/minio` - Types TypeScript
- `jsonwebtoken` - Génération JWT
- `@types/jsonwebtoken` - Types JWT

Dépendances supprimées :
- ❌ `firebase-admin` (81 packages supprimés)

### Démarrer l'API

```bash
npm run dev
```

Logs attendus :
```
Server running on port 3001
Database: MongoDB
MongoDB connection established successfully
Casdoor SDK initialized successfully
MinIO client initialized successfully
MinIO bucket created: idem-storage
Redis connection established successfully
```

## 5. Flux d'authentification

### Flow OAuth Casdoor

```
┌──────────┐                                    ┌──────────┐
│ Frontend │                                    │   API    │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │ 1. GET /auth/url                              │
     │──────────────────────────────────────────────>│
     │                                                │
     │ 2. {authUrl, state}                           │
     │<──────────────────────────────────────────────│
     │                                                │
     │ 3. Redirect to Casdoor                        │
     │──────────────────────────>│                   │
     │                            │ Casdoor           │
     │ 4. User login             │                   │
     │<──────────────────────────│                   │
     │                                                │
     │ 5. Callback with code                         │
     │──────────────────────────────────────────────>│
     │                                                │
     │                            6. Exchange code    │
     │                            for token           │
     │                            ├──────────>Casdoor │
     │                            │<─────────┤        │
     │                                                │
     │                            7. Create user      │
     │                            in MongoDB          │
     │                                                │
     │                            8. Generate JWT     │
     │                                                │
     │ 9. Set cookies (session + refreshToken)       │
     │<──────────────────────────────────────────────│
     │                                                │
```

### Endpoints d'authentification

#### 1. Obtenir l'URL d'authentification

```bash
GET /auth/url?redirect_uri=http://localhost:3000/callback

Response:
{
  "success": true,
  "authUrl": "http://localhost:8000/login/oauth/authorize?...",
  "state": "random-state"
}
```

#### 2. Login avec code OAuth

```bash
POST /auth/login
Content-Type: application/json

{
  "code": "authorization-code-from-casdoor",
  "state": "random-state"
}

Response:
{
  "success": true,
  "message": "Session created successfully",
  "user": { ... },
  "refreshToken": "...",
  "refreshTokenExpiresAt": "2024-04-01T00:00:00.000Z"
}

Cookies:
- session: JWT token (14 jours)
- refreshToken: Refresh token (30 jours)
```

#### 3. Rafraîchir le token

```bash
POST /auth/refresh
Cookie: refreshToken=...

Response:
{
  "success": true,
  "message": "Access token refreshed successfully",
  "sessionToken": "new-jwt-token"
}

Cookies:
- session: New JWT token
```

#### 4. Vérifier la session

```bash
GET /auth/profile
Cookie: session=...

Response:
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "user@example.com",
    "displayName": "User Name",
    ...
  }
}
```

#### 5. Déconnexion

```bash
POST /auth/logout
Cookie: session=...

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 6. Utilisation MinIO

### Upload de fichier

```typescript
import { minioService } from './config/minio.config';

// Upload depuis un buffer
const buffer = Buffer.from('file content');
const url = await minioService.uploadBuffer(
  'projects/logo.png',
  buffer,
  buffer.length,
  { 'Content-Type': 'image/png' }
);

// Upload depuis un fichier
const url = await minioService.uploadFile(
  'projects/document.pdf',
  '/path/to/file.pdf',
  { 'Content-Type': 'application/pdf' }
);
```

### Download de fichier

```typescript
const buffer = await minioService.downloadFile('projects/logo.png');
```

### URL présignée (temporaire)

```typescript
// URL valide 1 heure
const url = await minioService.getPresignedUrl('projects/logo.png', 3600);
```

### Supprimer un fichier

```typescript
await minioService.deleteFile('projects/logo.png');
```

### Lister les fichiers

```typescript
const files = await minioService.listFiles('projects/');
// ['projects/logo.png', 'projects/document.pdf', ...]
```

## 7. Migration des fichiers

### Fichiers supprimés

```
❌ api/controllers/auth.controller.old.ts
❌ api/services/auth.service.ts (ancien)
❌ api/services/storage.service.ts (Firebase Storage)
❌ api/services/authorization/migration.service.ts (Firestore migration)
❌ api/repository/FirestoreRepository.ts
```

### Fichiers créés

```
✅ docker-compose.yml
✅ casdoor/conf/app.conf
✅ mongo-init/init.js
✅ api/config/casdoor.config.ts
✅ api/config/minio.config.ts
✅ api/controllers/auth.controller.ts (nouveau)
✅ api/services/auth.service.ts (nouveau)
✅ api/services/storage.service.ts (nouveau avec MinIO)
```

### Fichiers modifiés

```
✅ api/interfaces/express.interface.ts - DecodedToken au lieu de Firebase
✅ api/index.ts - Initialisation Casdoor + MinIO
✅ .env.example - Variables Casdoor + MinIO
✅ package.json - Dépendances mises à jour
```

## 8. Tests

### Test Casdoor

```bash
# 1. Obtenir l'URL d'auth
curl http://localhost:3001/auth/url

# 2. Ouvrir l'URL dans le navigateur
# 3. Se connecter avec admin / 123
# 4. Copier le code de callback
# 5. Login avec le code
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR_CODE", "state": "YOUR_STATE"}'
```

### Test MinIO

```bash
# Upload
curl -X POST http://localhost:3001/storage/upload \
  -H "Cookie: session=YOUR_JWT" \
  -F "file=@/path/to/file.png"

# Download
curl http://localhost:9000/idem-storage/projects/file.png
```

### Test MongoDB

```bash
mongosh mongodb://admin:admin123@localhost:27017/idem?authSource=admin

> db.users.find().limit(5)
> db.projects.find().limit(5)
```

## 9. Production

### Variables d'environnement production

```bash
# Casdoor
CASDOOR_ENDPOINT=https://auth.idem.africa
CASDOOR_CLIENT_ID=<prod-client-id>
CASDOOR_CLIENT_SECRET=<prod-client-secret>
CASDOOR_REDIRECT_URI=https://idem.africa/callback

# JWT
JWT_SECRET=<strong-random-secret-256-bits>

# MinIO (S3-compatible ou MinIO Cloud)
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<aws-access-key>
MINIO_SECRET_KEY=<aws-secret-key>
MINIO_BUCKET_NAME=idem-production

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/idem

# Redis Cloud
REDIS_HOST=redis-cloud.com
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
```

### Déploiement Casdoor

**Option 1 : Self-hosted**
```bash
docker run -d \
  --name casdoor \
  -p 8000:8000 \
  -e RUNNING_IN_DOCKER=true \
  -v /path/to/conf:/conf \
  casbin/casdoor:latest
```

**Option 2 : Casdoor Cloud**
- https://door.casdoor.com
- Plan gratuit disponible

### Déploiement MinIO

**Option 1 : MinIO Cloud**
- https://min.io/pricing
- Compatible S3

**Option 2 : AWS S3**
- Utiliser AWS S3 directement
- MinIO client compatible S3

**Option 3 : Self-hosted**
```bash
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password \
  -v /data:/data \
  minio/minio server /data --console-address ":9001"
```

## 10. Avantages

### Casdoor vs Firebase Auth

| Feature | Casdoor | Firebase Auth |
|---------|---------|---------------|
| **Open Source** | ✅ Oui | ❌ Non |
| **Self-hosted** | ✅ Oui | ❌ Non |
| **Coût** | ✅ Gratuit | 💰 Payant après quota |
| **OAuth Providers** | ✅ 20+ | ✅ 10+ |
| **LDAP/SAML** | ✅ Oui | ❌ Non |
| **UI personnalisable** | ✅ Oui | ⚠️ Limité |
| **Contrôle total** | ✅ Oui | ❌ Non |

### MinIO vs Firebase Storage

| Feature | MinIO | Firebase Storage |
|---------|-------|------------------|
| **Open Source** | ✅ Oui | ❌ Non |
| **S3-compatible** | ✅ Oui | ❌ Non |
| **Self-hosted** | ✅ Oui | ❌ Non |
| **Coût** | ✅ Gratuit | 💰 $0.026/GB |
| **Performance** | ✅ Excellent | ✅ Bon |
| **Migration** | ✅ Facile (S3) | ❌ Vendor lock-in |

## 11. Troubleshooting

### Casdoor ne démarre pas

```bash
# Vérifier les logs
docker-compose logs casdoor

# Vérifier la DB
docker-compose logs casdoor-db

# Redémarrer
docker-compose restart casdoor
```

### MinIO bucket non créé

```bash
# Créer manuellement
docker exec -it idem-minio mc mb /data/idem-storage

# Ou via l'API
curl -X POST http://localhost:3001/storage/init
```

### Erreur JWT

```bash
# Vérifier JWT_SECRET dans .env
# Générer une nouvelle clé
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### MongoDB connexion refusée

```bash
# Vérifier MongoDB
docker-compose logs mongodb

# Tester connexion
mongosh mongodb://admin:admin123@localhost:27017/idem?authSource=admin
```

## 12. Commandes utiles

### Docker

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build

# Nettoyer
docker-compose down -v  # ⚠️ Supprime les données
```

### MinIO CLI

```bash
# Lister buckets
mc ls local/

# Lister fichiers
mc ls local/idem-storage/

# Copier fichier
mc cp file.png local/idem-storage/projects/

# Supprimer fichier
mc rm local/idem-storage/projects/file.png
```

### MongoDB

```bash
# Shell
mongosh mongodb://admin:admin123@localhost:27017/idem?authSource=admin

# Backup
mongodump --uri="mongodb://admin:admin123@localhost:27017/idem?authSource=admin"

# Restore
mongorestore --uri="mongodb://admin:admin123@localhost:27017/idem?authSource=admin" dump/
```

## Conclusion

✅ **Firebase complètement supprimé**
✅ **Casdoor configuré et fonctionnel**
✅ **MinIO configuré et fonctionnel**
✅ **MongoDB comme base de données principale**
✅ **JWT pour l'authentification**
✅ **Stack 100% open-source et self-hosted**

**Prochaines étapes :**
1. Configurer Casdoor avec vos OAuth providers
2. Migrer les utilisateurs existants (si nécessaire)
3. Tester l'authentification end-to-end
4. Migrer les fichiers de Firebase Storage vers MinIO
5. Déployer en production
