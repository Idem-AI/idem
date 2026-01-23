# Guide de Configuration des Modèles AI

Ce guide explique comment configurer la liste des modèles AI et le modèle par défaut via les variables d'environnement.

## Vue d'ensemble

Le système supporte maintenant la configuration dynamique des modèles AI via deux variables d'environnement :

- `AI_MODELS_CONFIG` : Liste des modèles disponibles (format JSON)
- `AI_DEFAULT_MODEL` : Modèle utilisé par défaut

## Configuration Backend (Next.js)

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` du serveur Next.js (`apps/appgen/apps/we-dev-next/.env`) :

```bash
# Configuration des modèles AI (optionnel)
AI_MODELS_CONFIG='[{"modelName":"Gemini 2.5 Flash","modelKey":"gemini-2.5-flash","useImage":true,"provider":"gemini","description":"Gemini 2.5 Flash model","functionCall":true},{"modelName":"Claude 3.5 Sonnet","modelKey":"claude-3-5-sonnet-20240620","useImage":true,"provider":"claude","description":"Claude 3.5 Sonnet model","functionCall":true}]'

# Modèle par défaut (optionnel)
AI_DEFAULT_MODEL="gemini-2.5-flash"
```

### Format de AI_MODELS_CONFIG

La variable `AI_MODELS_CONFIG` doit contenir un JSON array avec les propriétés suivantes pour chaque modèle :

```json
{
  "modelName": "Nom affiché du modèle",
  "modelKey": "clé-technique-du-modèle",
  "useImage": true/false,
  "provider": "gemini|claude|openai|deepseek",
  "description": "Description du modèle (optionnel)",
  "functionCall": true/false
}
```

### Exemple complet

```bash
AI_MODELS_CONFIG='[
  {
    "modelName": "Gemini 2.5 Flash",
    "modelKey": "gemini-2.5-flash",
    "useImage": true,
    "provider": "gemini",
    "description": "Gemini 2.5 Flash model",
    "functionCall": true
  },
  {
    "modelName": "Claude 3.5 Sonnet",
    "modelKey": "claude-3-5-sonnet-20240620",
    "useImage": true,
    "provider": "claude",
    "description": "Claude 3.5 Sonnet model",
    "functionCall": true
  },
  {
    "modelName": "GPT-4o Mini",
    "modelKey": "gpt-4o-mini",
    "useImage": false,
    "provider": "openai",
    "description": "GPT-4 Optimized Mini model",
    "functionCall": true
  }
]'

AI_DEFAULT_MODEL="gemini-2.5-flash"
```

## Configuration Frontend (React)

Le frontend récupère automatiquement la configuration depuis les endpoints API :

- `GET /api/model/config` : Liste des modèles disponibles
- `GET /api/model/default` : Modèle par défaut

Aucune configuration supplémentaire n'est nécessaire côté frontend.

## Fallback et Compatibilité

Si les variables d'environnement ne sont pas définies, le système utilise la configuration par défaut :

```typescript
const defaultModelConfigs = [
  {
    modelName: 'gemini-2.5-flash',
    modelKey: 'gemini-2.5-flash',
    useImage: true,
    provider: 'gemini',
    description: 'Gemini 2.5 Flash model',
    functionCall: true,
  },
  // ... autres modèles par défaut
];
```

## Providers Supportés

- **gemini** : Modèles Google Gemini
- **claude** : Modèles Anthropic Claude
- **openai** : Modèles OpenAI GPT
- **deepseek** : Modèles DeepSeek

## Endpoints API

### GET /api/model/config

Retourne la liste des modèles configurés.

**Réponse :**

```json
[
  {
    "modelName": "Gemini 2.5 Flash",
    "modelKey": "gemini-2.5-flash",
    "useImage": true,
    "provider": "gemini",
    "description": "Gemini 2.5 Flash model",
    "functionCall": true
  }
]
```

### GET /api/model/default

Retourne le modèle par défaut configuré.

**Réponse :**

```json
{
  "defaultModel": "gemini-2.5-flash"
}
```

## Validation

Le système valide automatiquement la configuration :

- Vérifie que les champs obligatoires sont présents
- Filtre les modèles invalides
- Utilise la configuration par défaut en cas d'erreur
- Vérifie que le modèle par défaut existe dans la liste

## Logs

Le système génère des logs pour aider au debugging :

```
Loading 3 models from environment configuration
Using default model from environment: gemini-2.5-flash
Default model set to: Gemini 2.5 Flash (gemini-2.5-flash)
```

## Dépannage

### Modèle par défaut non trouvé

Si le modèle spécifié dans `AI_DEFAULT_MODEL` n'existe pas dans `AI_MODELS_CONFIG`, le système utilisera le premier modèle disponible.

### Configuration JSON invalide

Si `AI_MODELS_CONFIG` contient un JSON invalide, le système utilisera la configuration par défaut et affichera une erreur dans les logs.

### Aucun modèle valide

Si aucun modèle valide n'est trouvé dans la configuration, le système utilisera la configuration par défaut.
