# Instructions migrer l'api vers Secret Manager en production


## 1. Pull avec allow-unrelated-histories


git pull --allow-unrelated-histories --rebase
git push --set-upstream origin main


## 2. Elements à supprimer du .env existant

Les variables suivantes doivent être supprimées de votre fichier `.env`  car elles sont soit obsolètes, soit désormais gérées par **Google Secret Manager** en production :
MONGODB_URI=
#### Variables déplacées vers Secret Manager (Secrets)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_CLIENT_ID`
- `MONGODB_URI`
- `REDIS_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_ROOT_PASSWORD`
- `SMTP_PASS`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `PEXELS_API_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SENSITIVE_VARS_ENCRYPTION_KEY`
- `INTERNAL_API_KEY`
- `IDEPLOY_SHARED_SECRET`
- `ADMIN_EMAILS`

### Utilisation du fichier de credentials Google Cloud (Firebase Service Account)

Pour que l'application puisse charger les secrets depuis **Google Secret Manager**, elle a besoin d'un fichier JSON de clé de compte de service.


1. Placer ce fichier sur le serveur (ex: `/home/idem/firebase-key.json`).
2. Assurez-vous que la variable `GOOGLE_APPLICATION_CREDENTIALS` dans votre fichier `.env` pointe vers ce chemin.
3. **IMPORTANT** : Ce fichier est extrêmement sensible, il ne doit jamais être commité ou partagé publiquement.


# Mettre à jour des containers impliquant les variables supprimées
 
### MongoDB
```bash
docker exec -it idem-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('admin').changeUserPassword('admin', 'soSG6tGidwpbbgLPzPOsN0rIfX42NkgE')"
```


### MINIO
```bash
docker run -d --name idem-minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=fBlKwe9w7bmWP1F/Lhap9b3U+yzcR8ZG minio/minio server /data --console-address ":9001"
```

### REDIS
```bash
# Docker Redis
docker run -d --name idem-redis -p 6379:6379 -e REDIS_PASSWORD=iuozmneBeLomh3+ydleSKp8tFIeqQ1Zw redis
```





# Aperçu du fichier .env final (.env.production)

Voici un exemple complet du fichier `.env` à utiliser en production. Notez l'absence de secrets (mots de passe, clés API), qui sont désormais gérés par Secret Manager.

```env
# ENVIRONMENT
NODE_ENV=production
PORT=3001

# GOOGLE SECRET MANAGER
USE_SECRET_MANAGER=true
GCP_PROJECT_ID=lexis-ia
SECRET_PREFIX=idem-api
GOOGLE_APPLICATION_CREDENTIALS=/home/idem/firebase-key.json

# APPLICATION URLs
APP_URL=https://api.idem.africa
DASHBOARD_URL=https://console.idem.africa

# CORS
CORS_ALLOWED_ORIGINS=https://idem.africa,https://console.idem.africa,https://appgen.idem.africa,https://chart.idem.africa,https://ideploy.idem.africa

# DATABASE
SGBD=mongodb
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=idem

# REDIS
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# MINIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=idem-storage
MINIO_PUBLIC_URL=https://storage.idem.africa

# SMTP
SMTP_HOST=mail.privateemail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@idem.africa

# FIREBASE
FIREBASE_AUTH_DOMAIN=lexis-ia.firebaseapp.com
FIREBASE_APP_ID=1:1024958800002:web:9f7e2f3e4e5e6e7e8e9e0e
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# QUOTAS
QUOTA_PROJECTS_PER_MONTH=5
QUOTA_ANALYSES_PER_MONTH=10
QUOTA_DEPLOYMENTS_PER_MONTH=3
QUOTA_AI_REQUESTS_PER_MONTH=100

# LIMITS
GLOBAL_RATE_LIMIT_MAX=600
JSON_BODY_LIMIT=1mb
URLENCODED_BODY_LIMIT=1mb
ALLOW_NO_ORIGIN_REQUESTS=false
LOG_LEVEL=info
```

