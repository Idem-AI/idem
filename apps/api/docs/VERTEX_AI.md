# Vertex AI

L'API utilise **Vertex AI** par défaut, pour que la consommation Gemini soit facturée sur le compte Google Cloud du projet plutôt que sur une clé Google AI Studio.

Les modèles ne changent pas. `ai.config.ts` reste la seule source de vérité pour le choix des modèles, les budgets de tokens et les chaînes de repli : seul le backend qui sert ces modèles change.

## Mise en service

### 1. Côté Google Cloud

```bash
gcloud services enable aiplatform.googleapis.com --project=<PROJET>

# Compte de service dédié à l'API
gcloud iam service-accounts create idem-vertex --project=<PROJET>

gcloud projects add-iam-policy-binding <PROJET> \
  --member="serviceAccount:idem-vertex@<PROJET>.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` suffit pour `generateContent`, le streaming, la génération d'images et le cache de contexte. Ne pas donner `roles/owner`.

### 2. Variables d'environnement

| Variable | Rôle |
|---|---|
| `GEMINI_BACKEND` | `vertex` (défaut) ou `ai-studio` pour un retour arrière |
| `GOOGLE_CLOUD_PROJECT` | **Requis.** Projet qui porte la facturation |
| `GOOGLE_CLOUD_LOCATION` | Région Vertex. Défaut `global` |
| `VERTEX_CLIENT_EMAIL` | Compte de service (optionnel, voir authentification) |
| `VERTEX_PRIVATE_KEY` | Clé privée, `\n` échappés acceptés |

`GEMINI_API_KEY` devient inutile en mode Vertex. Elle n'est lue que si `GEMINI_BACKEND=ai-studio`.

### 3. Authentification

Deux chemins, dans cet ordre :

1. **Compte de service en variables** — `VERTEX_CLIENT_EMAIL` + `VERTEX_PRIVATE_KEY`. À privilégier en conteneur, où monter un fichier de clé est rarement pratique. Même approche que l'initialisation Firebase de `api/index.ts`.
2. **Application Default Credentials** — sinon. Couvre `GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/cle.json`, `gcloud auth application-default login` en local, et l'identité attachée à la machine sur Cloud Run / GKE / GCE (le cas le plus propre : aucun secret à gérer).

Au démarrage, l'API journalise le backend résolu :

```
Gemini backend: Vertex AI (projet=idem-prod, région=global, auth=ADC, sans cache de contexte)
```

Si la configuration est incomplète, la ligne part en `console.error` dès le boot au lieu d'échouer au milieu d'une génération.

## Le choix de la région

Le défaut est **`global`** : la requête part vers la région disponible la plus proche, ce qui donne la meilleure résilience et la meilleure couverture de modèles.

Contrepartie assumée : l'endpoint global **ne sert pas le cache de contexte**. L'équipe de recherche (`services/research/research-team.service.ts`) s'en servait pour partager un préfixe entre ses appels ; elle repart désormais en inline, donc le préfixe est refacturé à chaque appel en input tokens.

Ce n'est pas subi : `contextCache` est déclaré `false` dans le registre quand la région vaut `global`, et `createContextCache` consulte ce garde-fou avant d'appeler l'API. Sans cela, chaque génération tenterait un `caches.create` voué à l'échec, avalé par son `catch` — un aller-retour perdu, pour une cause invisible dans les logs.

Pour récupérer le cache de contexte, il suffit de poser une région :

```bash
GOOGLE_CLOUD_LOCATION=us-central1   # ou europe-west1, europe-west4…
```

`contextCache` repasse alors à `true` automatiquement. Vérifier dans ce cas que les modèles de `ai.config.ts` sont disponibles dans la région choisie : la couverture des modèles en préversion varie, et c'est le point à contrôler en premier si un modèle répond 404.

## Retour arrière

```bash
GEMINI_BACKEND=ai-studio
GEMINI_API_KEY=<clé>
```

Aucun changement de code. Les deux chemins restent testés par la fabrique.

## Où c'est implémenté

Le découpage tient en deux fichiers, et un seul se modifie.

**`api/config/ai-providers.config.ts` — la déclaration.** Le bloc « Backend Gemini » y déclare le mode, le projet, la région, l'authentification et les capacités qui en découlent. C'est le **seul endroit à toucher** pour une prochaine bascule : autre région, autre projet, retour AI Studio, futur backend.

**`api/config/google-genai.client.ts` — l'exécution.** La fabrique ne décide de rien : elle construit le client à partir de ce que le registre déclare, et ne lit aucune variable d'environnement. C'est ce qui garantit qu'un changement d'infrastructure ne se propage pas dans le code métier.

Les capacités suivent le backend : `getProvider()` recalcule `contextCache` selon la région, et tout le code passe déjà par le garde-fou `providerSupports()`. Une capacité qui disparaît avec un backend se déclare donc au même endroit que le backend lui-même.

Les cinq services qui construisaient leur propre client passent par la fabrique :

- `services/prompt.service.ts` (chemin principal)
- `services/brandMockup.service.ts`
- `services/BandIdentity/logoAnalysis.service.ts`
- `services/BandIdentity/mockupHtmlGenerator.service.ts`
- `services/Communication/imageSourcing.service.ts`

Construire un `GoogleGenAI` directement ailleurs ferait repartir cet appel-là sur AI Studio sans que rien ne le signale. C'est exactement ce qui rendait la bascule incomplète : `mockupHtmlGenerator` utilisait encore `@google/generative-ai`, le SDK historique, qui ne sait pas parler à Vertex — il a été migré vers `@google/genai`.

Les gardes qui testaient `process.env.GEMINI_API_KEY` pour décider si une génération était possible utilisent maintenant `isGeminiConfigured()`, qui interroge le backend actif.
