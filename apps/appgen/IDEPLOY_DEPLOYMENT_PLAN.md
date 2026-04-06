# Plan d'implémentation — AppGen → iDeploy

---

## Scénario concret : Marie déploie sa landing page

> Marie utilise AppGen pour générer la landing page de son restaurant "Le Petit Bistro".
> AppGen génère une app React/Vite avec une belle page HTML/CSS/JS.
> Marie clique sur **"Deploy"** → choisit **"iDeploy"**.
> 90 secondes plus tard, elle reçoit le lien : `https://idem-app-f3a9b2.idem.app`

Ce scénario va guider toute l'explication.

---

## Comprendre le problème de fond

### Comment fonctionne Netlify (déjà en marche)

```
1. AppGen builde l'app dans le navigateur → génère le dossier dist/
   dist/
   ├── index.html
   ├── assets/
   │   ├── main-abc123.js
   │   └── style-def456.css
   └── images/

2. AppGen zippe ce dossier → dist.zip (environ 200Ko)

3. AppGen envoie dist.zip à we-dev-next: POST /api/deploy
   Body: { file: dist.zip }

4. we-dev-next appelle l'API Netlify:
   POST https://api.netlify.com/api/v1/sites          → crée un site vierge
   POST https://api.netlify.com/api/v1/sites/XYZ/deploys  → déploie le zip

5. Netlify retourne: { url: "https://random-name-123.netlify.app" }

6. AppGen affiche le lien à Marie ✅
```

Netlify est conçu pour recevoir des zips directement. **iDeploy non.**

---

### Pourquoi iDeploy ne peut pas recevoir un zip directement

iDeploy est basé sur Coolify, un outil de **self-hosting**. Il déploie des applications depuis des **repositories Git** (GitHub, GitLab, Gitea). Il ne dispose pas d'un endpoint "upload de zip".

Quand on crée une application dans iDeploy, on lui dit :
> "Va chercher le code sur GitHub à l'adresse X, branche Y, et déploie-le sur le serveur Z."

**Le problème :** AppGen génère le code *dans le navigateur* (WebContainer). Ce code n'existe nulle part sur internet — pas de repo Git, pas d'URL publique.

---

### La solution : un repo GitHub "pont"

On crée **un repo GitHub central** appartenant à Idem : `idem-appgen-deployments`.

Chaque fois qu'un utilisateur clique "Deploy on iDeploy", on :
1. Crée une nouvelle **branche** dans ce repo pour ce déploiement spécifique
2. Y pousse les fichiers du `dist/`
3. Demande à iDeploy de déployer depuis cette branche

```
GitHub repo: idem-org/idem-appgen-deployments
├── branch: deploy/f3a9b2   ← landing page de Marie (aujourd'hui)
│   ├── index.html
│   ├── assets/main-abc123.js
│   └── assets/style-def456.css
├── branch: deploy/c7d4e1   ← app d'un autre utilisateur (hier)
└── branch: deploy/a1b2c3   ← encore un autre (la semaine dernière)
```

Chaque déploiement a sa propre branche isolée. iDeploy crée une application distincte pour chacune.

---

## Le flux complet, étape par étape

### Étape 0 — Marie clique "Deploy on iDeploy" (Frontend)

**Fichier :** `HeaderActions.tsx` dans AppGen Client

```
Marie voit le modal → choisit "iDeploy" → un spinner s'affiche
```

En arrière-plan, le code fait exactement comme pour Netlify :
```typescript
// 1. Build dans WebContainer
await terminal.executeCommand('npm run build')

// 2. Zip le dossier dist/
const zip = new JSZip()
await getAllFiles(webcontainer, 'dist', zip)
const blob = await zip.generateAsync({ type: 'blob' })

// 3. Envoie au backend AppGen (we-dev-next)
const formData = new FormData()
formData.append('file', new File([blob], 'dist.zip'))
fetch('http://localhost:3000/api/deploy/ideploy', { method: 'POST', body: formData })
```

---

### Étape 1 — we-dev-next reçoit le zip et l'envoie à la Main API

**Fichier :** `we-dev-next/src/routes/deploy.ts` — nouveau endpoint `POST /api/deploy/ideploy`

we-dev-next ne fait qu'un seul rôle ici : **servir de relai**. Il ne peut pas appeler iDeploy directement car il n'a pas les credentials Firebase de l'utilisateur.

```typescript
// we-dev-next reçoit le zip de Marie
router.post('/ideploy', upload.single('file'), async (req, res) => {

  // Il forward simplement à la Main API
  const formData = new FormData()
  formData.append('file', req.file.buffer, 'dist.zip')

  const response = await fetch(`${MAIN_API_URL}/api/ideploy/deploy`, {
    method: 'POST',
    headers: { 'X-Internal-Secret': MAIN_API_INTERNAL_SECRET }, // sécurité appgen → main API
    body: formData
  })

  const data = await response.json()
  // data = { success: true, url: "https://idem-app-f3a9b2.idem.app" }

  res.json(data)
})
```

---

### Étape 2 — Main API extrait le zip

**Fichier :** `apps/api/api/services/appgen-ideploy.service.ts`

La Main API reçoit `dist.zip` et l'extrait en mémoire :

```
dist.zip contient:
  index.html          → "<!DOCTYPE html><html>... Le Petit Bistro ..."
  assets/main.js      → le bundle React (200Ko)
  assets/style.css    → les styles (50Ko)
  images/logo.png     → le logo du restaurant
```

```typescript
const files = await extractZip(req.file.buffer)
// files = {
//   'index.html': Buffer<...>,
//   'assets/main.js': Buffer<...>,
//   'assets/style.css': Buffer<...>,
//   'images/logo.png': Buffer<...>
// }
```

---

### Étape 3 — Main API pousse les fichiers sur GitHub

**Librairie utilisée :** `@octokit/rest` (client GitHub officiel)

```typescript
const deploymentId = 'f3a9b2'  // uuid court généré pour ce déploiement
const branch = `deploy/${deploymentId}`

// 1. Crée la branche dans le repo
await octokit.git.createRef({
  owner: 'idem-org',
  repo: 'idem-appgen-deployments',
  ref: `refs/heads/${branch}`,  // "refs/heads/deploy/f3a9b2"
  sha: mainBranchSha
})

// 2. Commit chaque fichier sur cette branche
for (const [path, content] of Object.entries(files)) {
  await octokit.repos.createOrUpdateFileContents({
    owner: 'idem-org',
    repo: 'idem-appgen-deployments',
    path: path,           // "index.html"
    message: `deploy: appgen static site ${deploymentId}`,
    content: content.toString('base64'),
    branch: branch        // "deploy/f3a9b2"
  })
}
```

**Résultat sur GitHub :**
```
github.com/idem-org/idem-appgen-deployments/tree/deploy/f3a9b2
├── index.html       ← "Le Petit Bistro" de Marie
├── assets/
│   ├── main.js
│   └── style.css
└── images/
    └── logo.png
```

---

### Étape 4 — Main API crée le projet dans iDeploy

**API iDeploy utilisée** (endpoints existants dans `routes/api.php`) :

```typescript
const headers = {
  'Authorization': `Bearer ${IDEPLOY_API_TOKEN}`,
  'Content-Type': 'application/json'
}

// 4a. Créer un Project
const project = await fetch(`${IDEPLOY_URL}/api/v1/projects`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: `appgen-${deploymentId}` })
})
// → { uuid: "proj-abc", name: "appgen-f3a9b2" }

// 4b. Créer un Environment dans ce project
const env = await fetch(`${IDEPLOY_URL}/api/v1/projects/proj-abc/environments`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'production' })
})
// → { uuid: "env-xyz" }

// 4c. Créer l'Application (Static Site)
// On pointe sur le repo GitHub, branche deploy/f3a9b2
const app = await fetch(`${IDEPLOY_URL}/api/v1/applications/public`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    project_uuid: 'proj-abc',
    environment_uuid: 'env-xyz',
    server_uuid: IDEPLOY_SERVER_UUID,   // UUID du serveur cible (en .env)
    name: `appgen-${deploymentId}`,
    git_repository: 'https://github.com/idem-org/idem-appgen-deployments',
    git_branch: `deploy/${deploymentId}`,  // "deploy/f3a9b2"
    build_pack: 'static',
    ports_exposes: '80'
  })
})
// → { uuid: "app-123", fqdn: null }  ← pas encore déployé
```

---

### Étape 5 — Main API déclenche le déploiement

```typescript
// Lance le déploiement
await fetch(`${IDEPLOY_URL}/api/v1/deploy?uuid=app-123&force=true`, {
  method: 'POST',
  headers
})
// iDeploy commence à:
// 1. Cloner le repo (branche deploy/f3a9b2)
// 2. Créer un container nginx avec les fichiers
// 3. Configurer Traefik pour exposer l'URL
```

**Ce qu'iDeploy fait en coulisse :**
```
iDeploy → clone github.com/idem-org/idem-appgen-deployments (branche deploy/f3a9b2)
iDeploy → crée container: docker run nginx avec les fichiers dans /usr/share/nginx/html/
iDeploy → configure Traefik: idem-app-f3a9b2.idem.app → container nginx port 80
iDeploy → SSL automatique via Let's Encrypt
```

---

### Étape 6 — Main API poll jusqu'à obtenir l'URL

```typescript
// Poll toutes les 5 secondes, max 3 minutes
for (let attempt = 0; attempt < 36; attempt++) {
  await sleep(5000)

  const status = await fetch(`${IDEPLOY_URL}/api/v1/applications/app-123`, { headers })
  const app = await status.json()

  // app.status = "deploying" → on continue d'attendre
  // app.status = "running"   → l'app est prête !

  if (app.status === 'running' && app.fqdn) {
    return { success: true, url: `https://${app.fqdn}` }
    // url = "https://idem-app-f3a9b2.idem.app"
  }
}
```

---

### Étape 7 — AppGen affiche le lien à Marie

```
Marie voit le modal de succès :
┌─────────────────────────────────────────────┐
│  ✅ Déploiement réussi !                     │
│                                             │
│  Votre application est disponible :         │
│  ┌──────────────────────────────────┐  📋  │
│  │ https://idem-app-f3a9b2.idem.app │      │
│  └──────────────────────────────────┘      │
│                                             │
│   [Fermer]    [Visiter le site →]           │
└─────────────────────────────────────────────┘
```

Elle clique "Visiter le site" → sa landing page "Le Petit Bistro" s'affiche. ✅

---

## Récapitulatif visuel du flux

```
Marie clique "Deploy on iDeploy"
         │
         ▼
[AppGen Client] npm run build → zip dist/ (dist.zip ~250Ko)
         │ POST /api/deploy/ideploy
         ▼
[we-dev-next]  relaie le zip
         │ POST /api/ideploy/deploy
         ▼
[Main API]
  ① Extrait dist.zip → 4 fichiers en mémoire
  ② GitHub API: crée branche deploy/f3a9b2
               commit index.html + assets/
  ③ iDeploy API: POST /projects → "appgen-f3a9b2"
                 POST /environments → "production"
                 POST /applications/public → git: deploy/f3a9b2
  ④ iDeploy API: POST /deploy?uuid=app-123
  ⑤ Poll GET /applications/app-123 …
         │ après ~60s: status=running, fqdn=idem-app-f3a9b2.idem.app
         │
         ▼
[we-dev-next]  { success: true, url: "https://idem-app-f3a9b2.idem.app" }
         │
         ▼
[AppGen Client]  Modal succès + lien cliquable
```

---

## Fichiers à créer / modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `we-dev-next/src/routes/deploy.ts` | Modifier | Ajouter `POST /ideploy` qui relaie à Main API |
| `apps/api/api/services/appgen-ideploy.service.ts` | Créer | GitHub push + orchestration iDeploy |
| `apps/api/api/routes/ideploy.routes.ts` | Modifier | Ajouter `POST /deploy` |
| `HeaderActions.tsx` | Modifier | Activer bouton + appeler `/api/deploy/ideploy` |

---

## Variables d'environnement à ajouter

### `apps/appgen/apps/we-dev-next/.env`
```env
MAIN_API_URL=http://localhost:3001
MAIN_API_INTERNAL_SECRET=un-secret-partage
```

### `apps/api/.env`
```env
GITHUB_SERVICE_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx   # PAT GitHub avec droits repo
GITHUB_SERVICE_OWNER=idem-org                    # nom de l'org ou compte GitHub
GITHUB_DEPLOYMENTS_REPO=idem-appgen-deployments  # nom du repo central
IDEPLOY_SERVER_UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # UUID du serveur cible dans iDeploy
APPGEN_INTERNAL_SECRET=un-secret-partage         # même valeur que côté we-dev-next
```

---

## Packages à installer

```bash
# Dans we-dev-next (pour extraire le zip si nécessaire côté relai)
npm install adm-zip

# Dans apps/api (pour appeler GitHub API)
npm install @octokit/rest
```

---

## Planning d'implémentation

| # | Tâche | Durée |
|---|-------|-------|
| 1 | Créer repo GitHub `idem-appgen-deployments` + générer PAT | 15 min |
| 2 | Récupérer UUID du serveur cible dans iDeploy | 5 min |
| 3 | Backend `we-dev-next` : endpoint relai `/api/deploy/ideploy` | 30 min |
| 4 | Backend `Main API` : service complet (GitHub + iDeploy API) | 2h |
| 5 | Frontend `AppGen` : activer bouton + câbler la fonction | 45 min |
| 6 | Test E2E (landing page simple) | 30 min |

**Total : ~4h**

---

## Prérequis à préparer avant de coder

1. **GitHub Personal Access Token** (PAT) avec droits `repo` :
   `github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)`

2. **Repo GitHub** `idem-appgen-deployments` créé (peut rester privé, le PAT suffit)

3. **UUID du serveur** cible dans iDeploy :
   Dans l'UI iDeploy → Servers → ton serveur → l'UUID est dans l'URL ou dans Settings

---

## Phase 2 (future) — Apps Fullstack

Pour les apps fullstack (backend API + frontend), la même approche s'applique :
- Générer un `docker-compose.yml` dans la branche GitHub
- iDeploy déploie en mode Docker Compose (multi-containers)
- Variables d'environnement injectées via l'API iDeploy à la création de l'app
