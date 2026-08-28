# Vertex AI

L'API utilise **Vertex AI** par défaut, pour que la consommation Gemini soit facturée sur le compte Google Cloud du projet plutôt que sur une clé Google AI Studio.

Les modèles ne changent pas. `ai.config.ts` reste la seule source de vérité pour le choix des modèles, les budgets de tokens et les chaînes de repli : seul le backend qui sert ces modèles change.

## Mise en service

### 1. Côté Google Cloud

Vertex réutilise le **compte de service Firebase déjà en place**. Un projet Firebase est un projet Google Cloud : c'est la même identité, le même projet, la même facture. Rien à créer — il manque seulement le droit d'appeler Vertex.

```bash
gcloud services enable aiplatform.googleapis.com --project=<PROJET>

# Le compte de service Firebase, celui de FIREBASE_CLIENT_EMAIL
gcloud projects add-iam-policy-binding <PROJET> \
  --member="serviceAccount:<FIREBASE_CLIENT_EMAIL>" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` suffit pour `generateContent`, le streaming, la génération d'images et le cache de contexte. Ne pas donner `roles/owner`.

### 2. Variables d'environnement

**Aucune variable à ajouter.** Vertex lit celles de Firebase, déjà requises :

| Variable | Rôle |
|---|---|
| `FIREBASE_PROJECT_ID` | Projet Google Cloud, donc celui qui porte la facturation Vertex |
| `FIREBASE_CLIENT_EMAIL` | Compte de service qui signe les appels |
| `FIREBASE_PRIVATE_KEY` | Sa clé privée, `\n` échappés acceptés |

Deux variables facultatives, propres à Vertex :

| Variable | Rôle |
|---|---|
| `GEMINI_BACKEND` | `vertex` (défaut) ou `ai-studio` pour un retour arrière |
| `GOOGLE_CLOUD_LOCATION` | Région Vertex. Défaut `global` |

`GEMINI_API_KEY` devient inutile en mode Vertex. Elle n'est lue que si `GEMINI_BACKEND=ai-studio`.

### 3. Authentification

Le compte de service Firebase signe les appels Vertex — pas de second compte, pas de second secret à faire tourner. Il n'y a volontairement **aucun repli** vers un autre jeu de variables ni vers les Application Default Credentials : une identité unique et explicite vaut mieux qu'une résolution en cascade dont on ne sait plus, en incident, laquelle a servi.

Si les trois variables Firebase ne sont pas complètes, la construction du client échoue avec un message qui les nomme.

Au démarrage, l'API journalise le backend résolu :

```
Gemini backend: Vertex AI (projet=idem-prod, région=global,
                auth=compte de service Firebase (firebase-adminsdk-x1y2@idem-prod.iam.gserviceaccount.com),
                sans cache de contexte)
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
