# Instructions pour finaliser .env avant upload Secret Manager

## 1. Mots de passe générés (copie dans .env)

```bash
# MongoDB
MONGODB_URI=mongodb://admin:soSG6tGidwpbbgLPzPOsN0rIfX42NkgE@localhost:27017/idem?authSource=admin

# MinIO
MINIO_SECRET_KEY=fBlKwe9w7bmWP1F/Lhap9b3U+yzcR8ZG
MINIO_ROOT_PASSWORD=fBlKwe9w7bmWP1F/Lhap9b3U+yzcR8ZG

# Redis
REDIS_PASSWORD=iuozmneBeLomh3+ydleSKp8tFIeqQ1Zw

# SMTP (contact@idem.africa)
SMTP_PASS=CG/2IDFqrv8ns/csvS9v04Si8da1W+nE
```

## 2. API Keys à obtenir manuellement

### Gemini API Key
1. Va sur https://aistudio.google.com/apikey
2. **RÉVOQUE** l'ancienne clé : `AIzaSyA6UBXWi7YZ7TE90XRz0RRcTBp6YUriaOI`
3. Crée une nouvelle clé
4. Copie dans `.env` : `GEMINI_API_KEY=NOUVELLE_CLE`

### Pexels API Key
1. Va sur https://www.pexels.com/api/
2. **RÉVOQUE** l'ancienne clé : `U8erFhfaQcAdftlQUlPp7PBWtLixgzi2lONZBp0LC0ZssxzxfLhrtomD`
3. Génère une nouvelle clé
4. Copie dans `.env` : `PEXELS_API_KEY=NOUVELLE_CLE`

## 3. Vérifie que tous les placeholders sont remplacés

```bash
grep "CHANGE_THIS" .env
# Doit retourner AUCUN résultat
```

## 4. Upload vers Secret Manager

```bash
# Une fois .env complété
npm run secrets:upload .env

# Donne les permissions au service account
gcloud projects add-iam-policy-binding lexis-ia \
  --member='serviceAccount:firebase-adminsdk-fbsvc@lexis-ia.iam.gserviceaccount.com' \
  --role='roles/secretmanager.secretAccessor'
```

## 5. Supprime l'ancienne clé Firebase compromise

1. Va sur https://console.firebase.google.com/project/lexis-ia/settings/serviceaccounts/adminsdk
2. Clique "Manage service account permissions"
3. Trouve la clé avec ID `867f5580ab51742f5366fc2bc3d0d9e5566987e6`
4. Delete

## 6. Configure MongoDB/Redis/MinIO avec les nouveaux mots de passe

### MongoDB
```bash
docker exec -it mongodb mongosh -u admin -p admin123
use admin
db.changeUserPassword("admin", "soSG6tGidwpbbgLPzPOsN0rIfX42NkgE")
exit
```

### Redis
Édite `redis.conf` ou docker-compose.yml avec le nouveau password

### MinIO
Redémarre MinIO avec les nouvelles credentials

## 7. Purge Git history

```bash
cd /Users/pharaon/Documents/pharaon/idem
./apps/api/scripts/purge-env-from-history.sh
git push --force --all
```
