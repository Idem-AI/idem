# Prochaines étapes critiques - Sécurisation complète

## ✅ Déjà fait
- [x] Secret Manager API activée
- [x] 55 secrets uploadés dans Google Secret Manager
- [x] Permissions accordées au service account Firebase
- [x] Nouvelles credentials Firebase installées
- [x] Nouveaux mots de passe générés (MongoDB, Redis, MinIO, SMTP)

## 🔴 Actions URGENTES à faire maintenant

### 1. Supprimer l'ancienne clé Firebase compromise

**Via Console Firebase :**
1. Va sur https://console.firebase.google.com/project/lexis-ia/settings/serviceaccounts/adminsdk
2. Clique "Manage service account permissions"
3. Dans Google Cloud Console, va dans "IAM & Admin" > "Service Accounts"
4. Trouve le service account `firebase-adminsdk-fbsvc@lexis-ia.iam.gserviceaccount.com`
5. Clique sur les 3 points > "Manage keys"
6. **Supprime la clé avec ID `867f5580ab51742f5366fc2bc3d0d9e5566987e6`** (ancienne clé compromise)
7. Garde uniquement la clé `b4def11e57973a734d7828bcb4d9ef3742473cd2` (nouvelle)

### 2. Obtenir nouvelles API keys

#### Gemini API Key
1. Va sur https://aistudio.google.com/apikey
2. **RÉVOQUE** l'ancienne : `AIzaSyA6UBXWi7YZ7TE90XRz0RRcTBp6YUriaOI`
3. Crée une nouvelle clé
4. Mets à jour dans Secret Manager :
```bash
echo "NOUVELLE_CLE" | GCP_PROJECT_ID=lexis-ia npm run secrets:rotate GEMINI_API_KEY
```

#### Pexels API Key
1. Va sur https://www.pexels.com/api/
2. **RÉVOQUE** l'ancienne : `U8erFhfaQcAdftlQUlPp7PBWtLixgzi2lONZBp0LC0ZssxzxfLhrtomD`
3. Génère une nouvelle clé
4. Mets à jour dans Secret Manager :
```bash
echo "NOUVELLE_CLE" | GCP_PROJECT_ID=lexis-ia npm run secrets:rotate PEXELS_API_KEY
```

### 3. Configurer les services avec nouveaux mots de passe

#### MongoDB
```bash
docker exec -it mongodb mongosh -u admin -p admin123
use admin
db.changeUserPassword("admin", "soSG6tGidwpbbgLPzPOsN0rIfX42NkgE")
exit
```

#### Redis
Édite `redis.conf` ou `docker-compose.yml` :
```yaml
command: redis-server --requirepass iuozmneBeLomh3+ydleSKp8tFIeqQ1Zw
```

#### MinIO
Redémarre MinIO avec les nouvelles credentials :
```bash
MINIO_ROOT_USER=minioadmin \
MINIO_ROOT_PASSWORD=fBlKwe9w7bmWP1F/Lhap9b3U+yzcR8ZG \
minio server /data
```

#### SMTP (contact@idem.africa)
Change le mot de passe sur https://privateemail.com
Nouveau password : `CG/2IDFqrv8ns/csvS9v04Si8da1W+nE`

### 4. Purger l'historique Git

```bash
cd /Users/pharaon/Documents/pharaon/idem
./apps/api/scripts/purge-env-from-history.sh
```

**ATTENTION :** Cette opération est IRRÉVERSIBLE et va réécrire tout l'historique Git.

Après exécution :
```bash
git push --force --all
git push --force --tags
```

### 5. Supprimer les fichiers .env locaux compromis

```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/api
rm .env.old.compromised
# Garde .env pour le développement local
```

### 6. Activer Secret Manager en production

Dans ton environnement de production (Cloud Run, App Engine, etc.), configure :

```bash
USE_SECRET_MANAGER=true
GCP_PROJECT_ID=lexis-ia
SECRET_PREFIX=idem-api
NODE_ENV=production
```

L'API chargera automatiquement tous les secrets depuis Secret Manager au démarrage.

### 7. Tester le chargement des secrets

En local (dev) :
```bash
cd /Users/pharaon/Documents/pharaon/idem/apps/api
USE_SECRET_MANAGER=true GCP_PROJECT_ID=lexis-ia npm run dev
```

Vérifie les logs :
```
info: Loading secrets from Google Secret Manager...
info: Loaded 55 secrets from Secret Manager
info: All required secrets validated
```

## 📋 Checklist de vérification

- [ ] Ancienne clé Firebase supprimée (ID `867f5580...`)
- [ ] Nouvelle clé Gemini API obtenue et uploadée
- [ ] Nouvelle clé Pexels API obtenue et uploadée
- [ ] MongoDB password changé
- [ ] Redis password changé
- [ ] MinIO credentials changées
- [ ] SMTP password changé
- [ ] Historique Git purgé
- [ ] Force push effectué
- [ ] Secret Manager testé en local
- [ ] Production configurée avec `USE_SECRET_MANAGER=true`

## 🔒 Secrets actuellement dans Secret Manager

Total : 55 secrets

**Firebase (9) :**
- FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY_ID, FIREBASE_PRIVATE_KEY
- FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID, FIREBASE_AUTH_DOMAIN
- FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID

**Databases (7) :**
- MONGODB_URI, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB
- MINIO_* (7 secrets)

**API Keys (6) :**
- GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY
- PEXELS_API_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

**Security (3) :**
- SENSITIVE_VARS_ENCRYPTION_KEY
- INTERNAL_API_KEY
- IDEPLOY_SHARED_SECRET

**SMTP (5) :**
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS

**Configuration (25+) :**
- PORT, NODE_ENV, APP_URL, CORS_ALLOWED_ORIGINS
- Quotas, limites, etc.

## 🚀 Rotation future des secrets

Pour rotater un secret :
```bash
echo "NOUVELLE_VALEUR" | GCP_PROJECT_ID=lexis-ia npm run secrets:rotate NOM_SECRET
```

Exemple :
```bash
echo "nouvelle-api-key" | GCP_PROJECT_ID=lexis-ia npm run secrets:rotate GEMINI_API_KEY
```

## 📚 Documentation

- `UPDATE_ENV_INSTRUCTIONS.md` - Instructions détaillées
- `scripts/upload-secrets.sh` - Script d'upload
- `scripts/rotate-secret.sh` - Script de rotation
- `scripts/purge-env-from-history.sh` - Script de purge Git
- `api/config/secrets.ts` - Loader de secrets

## 🎯 Résultat final

Une fois toutes ces étapes complétées :
- ✅ Aucun secret dans Git (historique purgé)
- ✅ Tous les secrets dans Secret Manager
- ✅ Anciennes clés révoquées
- ✅ Nouveaux mots de passe partout
- ✅ Production sécurisée avec Secret Manager
- ✅ Développement local avec .env (non committé)
