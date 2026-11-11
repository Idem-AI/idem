# Mise en production — actions serveur et DevOps (novembre 2026)

Ce document liste tout ce qu'il faut faire **hors du code** pour que les nouveautés de novembre 2026 fonctionnent en
production. Le code est prêt ; sans ces actions, chaque service tourne quand même (replis prévus), mais en mode
dégradé : catalogue figé à la version embarquée, ateliers iCode à trois minutes d'`npm install`, visuels sans image
quand la génération échoue.

Trois chantiers :

| # | Nouveauté | Services touchés | Sans les actions ci-dessous |
|---|---|---|---|
| A | **Catalogues en ligne** : directions artistiques (la source de tout le reste), gabarits images, vidéos, sections de sites iCode — dépôt `idem-templates` publié sur MinIO | API IDEM, API iVision, appgen (serveur) | chaque service sert l'instantané embarqué dans son image : aucune mise à jour sans redéploiement |
| B | **Démarrage rapide des ateliers iCode** (dépendances préinstallées, cache de Vite gardé) | appgen (serveur + client), reverse proxy, CI | chaque ouverture d'atelier : `npm install` complet, ~3 min |
| C | **Repli Pexels** quand une image ou une vidéo générée échoue | API IDEM, API iVision | visuels, documents et vidéos sans image quand la génération échoue (crédits, panne) |

Ordre conseillé : **A1 → A2 → A3 → B1 → B2 → B3 → C → déploiement des images → publication du catalogue (A4) →
vérifications (§ 5) → B4 (four)**.

---

## A. Catalogues de gabarits en ligne

### A1. Le seau MinIO

1. Créer le seau **`idem-templates`** sur la MinIO de production.
2. Le rendre **lisible publiquement** (lecture anonyme seulement, `s3:GetObject`). Le pipeline pose la politique
   lui-même au premier envoi s'il en a le droit ; sinon la poser à la main.
3. L'exposer en **HTTPS** à une adresse publique stable, par exemple `https://cdn.idem.africa/idem-templates`.
   Cette adresse est `IDEM_TEMPLATES_URL` (§ A3) et `TEMPLATES_PUBLIC_URL` (§ A2).
   - Les serveurs lisent `…/manifest.json`, `…/directions/manifest.json`, `…/videos/manifest.json`,
     `…/icode/manifest.json` et `…/html/*.html`.
   - Si un CDN est placé devant : **ne pas mettre en cache** les quatre `manifest.json` (le pipeline les envoie en
     `Cache-Control: no-cache`, le CDN doit respecter l'en-tête) ; `html/` et `releases/` sont immuables (un an).
   - Les lectures se font de serveur à serveur : aucune règle CORS n'est nécessaire.
4. Créer un **compte de service MinIO limité au seau** pour le pipeline :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:CreateBucket", "s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:ListBucket"], "Resource": ["arn:aws:s3:::idem-templates"] },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": ["arn:aws:s3:::idem-templates/*"] }
  ]
}
```

5. L'API S3 de la MinIO doit être **joignable depuis GitHub Actions** (le pipeline écrit depuis les runners GitHub).

### A2. Le dépôt `idem-templates` sur GitHub

1. Créer le dépôt GitHub `idem-templates` et y pousser le dépôt local (branche `main`). Le pipeline est déjà dans
   `.github/workflows/publish.yml` : vérification à chaque pull request, publication à chaque push sur `main`.
2. Créer un **environnement GitHub `production`** (Settings → Environments) : le job de publication s'y rattache.
   Y ajouter une règle de relecture si on veut valider chaque publication.
3. Générer la paire de clés de signature, **une seule fois**, sur un poste sûr :

```bash
cd idem-templates && npm run keygen
```

   La sortie donne la clé **privée** (PEM) et la clé **publique** (base64). La clé privée ne va **que** dans GitHub.

4. **Secrets** du dépôt (Settings → Secrets and variables → Actions → Secrets) :

| Secret | Valeur |
|---|---|
| `TEMPLATES_S3_ENDPOINT` | adresse S3 de la MinIO de production (`https://…`) |
| `TEMPLATES_S3_ACCESS_KEY` | clé du compte de service (§ A1.4) |
| `TEMPLATES_S3_SECRET_KEY` | secret du compte de service |
| `TEMPLATES_SIGNING_KEY` | clé **privée** ed25519 (PEM complet, `-----BEGIN PRIVATE KEY-----` compris) |
| `IDEM_TEMPLATES_WEBHOOK_TOKEN` | un jeton aléatoire long (`openssl rand -hex 32`), **le même** que dans les API (§ A3) |

5. **Variables** du dépôt (même écran → Variables) :

| Variable | Valeur |
|---|---|
| `TEMPLATES_S3_BUCKET` | `idem-templates` (défaut si vide) |
| `TEMPLATES_PUBLIC_URL` | l'adresse publique du seau (§ A1.3) |
| `IDEM_API_URLS` | les API à prévenir, séparées par des espaces : `https://api.idem.africa https://<api-ivision>` |

6. Les deux API doivent exposer **`POST /catalog/refresh`** à l'internet (le webhook part des runners GitHub). La
   route est protégée par l'en-tête `x-idem-templates-token` ; aucune autre route `/catalog` n'est publique
   (`GET /catalog` et `PUT /catalog/overrides` exigent un compte admin).

> appgen n'a pas de webhook : il relit le catalogue iCode tout seul toutes les `IDEM_TEMPLATES_TTL_S` secondes (5 min
> par défaut). Ne pas l'ajouter à `IDEM_API_URLS`.

### A3. Variables d'environnement des services (Infisical)

| Variable | API IDEM | API iVision | appgen serveur | Valeur |
|---|:-:|:-:|:-:|---|
| `IDEM_TEMPLATES_URL` | ✅ | ✅ | ✅ | l'adresse publique du seau, **sans** `/manifest.json` ni barre finale |
| `IDEM_TEMPLATES_PUBKEY` | ✅ | ✅ | ✅ | la clé **publique** de `npm run keygen` (base64). Posée, tout manifeste non signé ou mal signé est refusé |
| `IDEM_TEMPLATES_WEBHOOK_TOKEN` | ✅ | ✅ | — | le même jeton que le secret GitHub |
| `IDEM_TEMPLATES_TTL_S` | facultatif | facultatif | facultatif | relecture du catalogue, en secondes (défaut `300`) |
| `IDEM_TEMPLATES_CACHE` | facultatif | facultatif | facultatif | dossier du dernier catalogue reçu (défaut : dossier temporaire). Le monter sur un volume garde le dernier catalogue valide après un redémarrage si MinIO ne répond pas |
| `SITE_SECTION_CATALOG` | — | — | facultatif | `on` par défaut ; `off` = les sections des sites sont écrites par le modèle comme avant (retour arrière) |

**À ne jamais poser en production** : `IDEM_TEMPLATES_DIR` (lecture du dépôt sur le disque, réservée au
développement : elle court-circuite MinIO et la signature).

Rien à faire pour les instantanés embarqués : les images Docker posent déjà `IDEM_TEMPLATES_SNAPSHOT` (API, iVision)
et copient les instantanés vidéo et iCode. Ils servent de repli quand MinIO ne répond pas.

### A4. Première publication

Après A1 à A3 et le déploiement des API : pousser `main` sur GitHub (ou *Actions → catalogue → Run workflow*). Le job
doit finir par une ligne `✓ <api> a relu le catalogue <version>` pour **chaque** API d'`IDEM_API_URLS`.

Retour arrière : *Actions → catalogue → Run workflow*, champ « Version à remettre en ligne » (ex. `2026.11.11-aae0ee2`).

---

## B. Démarrage rapide des ateliers iCode (appgen)

### B1. Le volume des instantanés

Le serveur appgen garde les `node_modules` préinstallés dans `/app/deps-cache` (`APPGEN_DEPS_CACHE_DIR`, déjà posé
par l'image).

- **Monter un volume persistant** sur `/app/deps-cache`. Sans volume, les instantanés disparaissent à chaque
  redéploiement et chaque ouverture d'atelier repart sur trois minutes.
- Le volume doit être **inscriptible par l'utilisateur du conteneur** (`expressjs`, uid **1001**, gid 1001) :
  `chown -R 1001:1001 <volume>`.
- Taille : environ **80 Mo par version du socle** (5 arbres : site 18 Mo, application web 3 × ≈ 10–20 Mo, mobile
  18 Mo compressés). Prévoir 2 Go pour garder l'historique ; les anciennes empreintes peuvent être supprimées à la main.
- Plusieurs instances d'appgen : **le même volume partagé** (lecture par toutes, écriture par le four).

### B2. Variables d'environnement d'appgen (serveur)

| Variable | Valeur | Rôle |
|---|---|---|
| `APPGEN_DEPS_BAKE_TOKEN` | jeton aléatoire long (`openssl rand -hex 32`) | **obligatoire** : autorise le dépôt d'un instantané. Vide en production = aucun dépôt possible (il n'existe pas de jeton implicite en production) |
| `APPGEN_DEPS_CACHE_DIR` | `/app/deps-cache` | déjà posé par l'image ; ne changer que si le volume est monté ailleurs |
| `APPGEN_DEPS_AUTOBAKE` | laisser vide (`off` en production) | le four automatique a besoin de Chrome, absent de l'image : en production, c'est la CI qui cuit (§ B4) |
| `CORS_ALLOWED_ORIGINS` | doit contenir l'origine de l'atelier iCode (`https://<icode>`) | le four dépose depuis la page de l'atelier |

### B3. Reverse proxy et en-têtes

Devant l'API **appgen** (`/api/scaffold/deps/…`) :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Taille de corps acceptée | **≥ 256 Mo** (nginx : `client_max_body_size 256m;`) | le four dépose des instantanés de 10 à 40 Mo par `PUT` (plafond serveur : 256 Mo) |
| Délai de lecture / d'envoi | ≥ 300 s | dépôt et téléchargement d'un instantané sur une connexion lente |
| Recompression | **désactivée** pour ces réponses (`gzip off;` sur `location /api/scaffold/deps/`) | les instantanés sont servis déjà compressés avec `Content-Encoding: gzip` ; une seconde compression les casse |
| `Content-Length` et `Cache-Control` | transmis tels quels | `Cache-Control: public, max-age=31536000, immutable` : le navigateur et un CDN gardent l'instantané pour toujours (l'adresse change avec l'empreinte) |
| En-têtes CORS de l'application | transmis tels quels | le serveur autorise désormais `X-Idem-Bake-Token`, `X-Idem-Unpacked-Bytes`, `X-Idem-Verified` ; un proxy qui réécrit `Access-Control-Allow-Headers` doit les garder |

Devant l'**atelier iCode** (client) : vérifier que les en-têtes d'isolation passent jusqu'au navigateur, sans quoi
la WebContainer ne démarre pas :

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

### B4. Le four : cuire les dépendances après chaque déploiement

Les instantanés doivent être fabriqués **dans un navigateur** (une WebContainer), jamais par le serveur. Le script
`npm run deps:bake` ouvre l'atelier dans un Chrome sans écran, cuit ce qui manque, vérifie (`npm run build`), fait le
pré-regroupement de Vite (`vite optimize`) et dépose sur le serveur. Ce qui est déjà cuit n'est pas refait.

**À lancer après chaque déploiement d'appgen** (le mieux : une étape de la CI de déploiement, après que le nouveau
serveur répond). Depuis une machine qui a Node 20+ et le dépôt `idem` (le runner de CI convient, Chrome est téléchargé
par puppeteer) :

```bash
cd idem && npm ci
cd apps/appgen/apps/we-dev-next
ICODE_URL=https://<adresse-de-l-atelier-icode> \
APPGEN_DEPS_BAKE_TOKEN=<le même jeton que le serveur> \
DEPS_BAKE_TIMEOUT_MIN=40 \
npm run deps:bake
```

- Durée : 15 à 25 minutes la première fois (5 arbres), quelques secondes quand rien n'a changé.
- Code de sortie `0` : tout est cuit ; `1` : au moins un arbre a échoué (relancer ; voir la sortie).
- La machine doit joindre l'atelier iCode **et** l'API appgen qu'il appelle, plus `*.webcontainer-api.io` et
  `registry.npmjs.org`.
- Quand le socle change (version d'un paquet), l'empreinte change : sans nouvelle cuisson, les ateliers montent
  l'arbre voisin le plus récent puis complètent par npm (quelques dizaines de secondes au lieu de 3 min).

### B5. Images à reconstruire

`appgen-server` et `appgen-client` (nouveau fichier `.npmrc` du site, correctifs CORS et démarrage, chronomètre),
puis la cuisson (§ B4).

---

## C. Repli Pexels des images et des vidéos

| Variable | API IDEM | API iVision | Valeur |
|---|:-:|:-:|---|
| `PEXELS_API_KEY` | ✅ | ✅ | clé de l'API Pexels (compte IDEM sur pexels.com/api). Le cœur vidéo et les visuels tournent dans **les deux** API |

Désormais Pexels n'est plus facultatif : c'est le relais de toute génération d'image ou de clip qui échoue (crédits
épuisés, panne, délai). Sans clé, ces visuels sortent sans image.

Quota Pexels par défaut : 200 requêtes/heure et 20 000/mois. Un visuel fait jusqu'à 3 recherches, une vidéo jusqu'à
2 par plan : **demander le relèvement du quota** à Pexels (gratuit pour un usage avec attribution) avant l'ouverture
au public.

À surveiller aussi : les **crédits OpenRouter**. À zéro, toutes les images passent par Pexels (log
`chat.site_media` « Crédits de génération épuisés », une ligne par site).

---

## 4. Récapitulatif des variables

| Variable | Service(s) | Obligatoire | Secret |
|---|---|:-:|:-:|
| `IDEM_TEMPLATES_URL` | API IDEM, API iVision, appgen serveur | oui | non |
| `IDEM_TEMPLATES_PUBKEY` | API IDEM, API iVision, appgen serveur | oui (signature) | non |
| `IDEM_TEMPLATES_WEBHOOK_TOKEN` | API IDEM, API iVision, GitHub (secret) | oui | **oui** |
| `IDEM_TEMPLATES_TTL_S` | les trois | non (300) | non |
| `IDEM_TEMPLATES_CACHE` | les trois | non | non |
| `SITE_SECTION_CATALOG` | appgen serveur | non (`on`) | non |
| `APPGEN_DEPS_BAKE_TOKEN` | appgen serveur, CI du four | oui | **oui** |
| `APPGEN_DEPS_CACHE_DIR` | appgen serveur | déjà posé | non |
| `APPGEN_DEPS_AUTOBAKE` | appgen serveur | non (laisser `off`) | non |
| `CORS_ALLOWED_ORIGINS` | appgen serveur | oui (origine iCode) | non |
| `ICODE_URL`, `DEPS_BAKE_TIMEOUT_MIN` | CI du four uniquement | oui pour le four | non |
| `PEXELS_API_KEY` | API IDEM, API iVision | oui | **oui** |
| `TEMPLATES_S3_ENDPOINT`, `TEMPLATES_S3_ACCESS_KEY`, `TEMPLATES_S3_SECRET_KEY`, `TEMPLATES_SIGNING_KEY` | GitHub `idem-templates` (secrets) | oui | **oui** |
| `TEMPLATES_S3_BUCKET`, `TEMPLATES_PUBLIC_URL`, `IDEM_API_URLS` | GitHub `idem-templates` (variables) | oui | non |

Interdit en production : `IDEM_TEMPLATES_DIR`, `GRAPHIC_OFFLINE`, `APPGEN_DEPS_AUTOBAKE=on` (sauf machine avec Chrome).

---

## 5. Vérifications après déploiement

**Catalogue servi par MinIO** (doit répondre `200`, avec une `version` et une `signature`) :

```bash
curl -s https://<seau-public>/manifest.json | head -c 300
curl -s https://<seau-public>/videos/manifest.json | head -c 200
curl -s https://<seau-public>/icode/manifest.json | head -c 200
curl -s https://<seau-public>/directions/manifest.json | head -c 200   # 30 directions artistiques
```

**Webhook** (doit répondre `200` avec la version ; `401` = jeton différent) :

```bash
curl -s -X POST https://api.idem.africa/catalog/refresh -H "x-idem-templates-token: $IDEM_TEMPLATES_WEBHOOK_TOKEN"
curl -s -X POST https://<api-ivision>/catalog/refresh -H "x-idem-templates-token: $IDEM_TEMPLATES_WEBHOOK_TOKEN"
```

Dans la réponse : `"source": "url"` (et pas `snapshot`), liste `rejected` vide, et un bloc `directions` dont la
`source` vaut `url` (30 directions). Les versions de moteur montent avec cette livraison (images 2.8, vidéos et iCode 2.0) :
**déployer les API et appgen AVANT de publier le catalogue**, sinon les anciennes images refusent le nouveau manifeste et
restent sur leur instantané (sans erreur, mais sans les nouveautés). `source: snapshot` = MinIO injoignable ou
manifeste refusé (signature : voir le log `catalog.manifest_refused`).

**appgen** : à la première génération de site, le log `chat.site_catalog` « Catalogue iCode chargé » doit dire
`source=url`.

**Instantanés iCode** (tous les arbres `"baked": true`, `"bakingEnabled": true`) :

```bash
curl -s https://<api-appgen>/api/scaffold/deps | python3 -m json.tool
```

**Démarrage réel** : après une génération, le log `chat.startup` « Page affichée » donne le temps jusqu'à la page
chargée, par phase. Objectif : moins de 20 s (mesuré le 11/11 : 11 s à la première ouverture, 4 s ensuite). Un
avertissement « Page affichée au-delà de 20 s » avec `sources: ["npm"]` = instantanés absents (§ B4).

**Pexels** : un visuel généré sans crédits doit contenir une photo ; le log `visual.stock_ranked` apparaît.

---

## 6. En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| `catalog.manifest_refused` « signature » | `IDEM_TEMPLATES_PUBKEY` ne correspond pas à `TEMPLATES_SIGNING_KEY` | reposer la clé publique issue de la même paire ; republier |
| Webhook `401` | jetons différents entre GitHub et l'API | aligner `IDEM_TEMPLATES_WEBHOOK_TOKEN` |
| Webhook injoignable | `/catalog/refresh` non exposé ou bloqué par le pare-feu | ouvrir la route ; à défaut, le catalogue est relu à l'expiration du TTL |
| Four : « dépôt refusé : Bad bake token » | jeton du four ≠ jeton du serveur | aligner `APPGEN_DEPS_BAKE_TOKEN` |
| Four : « dépôt refusé : Failed to fetch » | CORS (origine iCode absente de `CORS_ALLOWED_ORIGINS`) ou corps trop gros pour le proxy | § B2 et § B3 |
| Four : `413` | `client_max_body_size` trop bas | § B3 |
| Atelier : « socle et empreinte en désaccord » | serveur redéployé pendant la cuisson | relancer `npm run deps:bake` |
| Ateliers toujours à 3 min | volume non monté (instantanés perdus) ou four jamais lancé | § B1 et § B4 |
| L'aperçu ne démarre pas du tout | en-têtes COOP/COEP retirés par le proxy | § B3 |
