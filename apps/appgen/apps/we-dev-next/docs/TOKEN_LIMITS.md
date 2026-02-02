# Token Limits Configuration

Ce document explique comment configurer et utiliser les limites de tokens pour les générations AI dans l'application we-dev-next.

## Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` :

```env
# AI Generation Token Limits
AI_MAX_OUTPUT_TOKENS=8192      # Nombre maximum de tokens générés par l'AI
AI_MAX_INPUT_TOKENS=128000     # Nombre maximum de tokens dans le contexte d'entrée
AI_STANDARD_TOKEN_LIMIT=128000 # Seuil pour basculer en mode token-limité
```

## Description des limites

### AI_MAX_OUTPUT_TOKENS

- **Défaut**: `8192`
- **Description**: Nombre maximum de tokens que l'AI peut générer dans une seule réponse
- **Utilisation**: Contrôle la longueur de la réponse de l'AI
- **Recommandations**:
  - `4096` - Pour des réponses courtes et rapides
  - `8192` - Équilibre entre longueur et coût (recommandé)
  - `16384` - Pour des générations plus longues
  - `32768` - Pour des projets très complexes (coûteux)

### AI_MAX_INPUT_TOKENS

- **Défaut**: `128000`
- **Description**: Nombre maximum de tokens autorisés dans le contexte d'entrée
- **Utilisation**: Limite la taille du contexte envoyé à l'AI
- **Recommandations**:
  - `32000` - Pour des projets simples
  - `128000` - Standard pour la plupart des projets (recommandé)
  - `200000` - Pour des projets très larges (si supporté par le modèle)

### AI_STANDARD_TOKEN_LIMIT

- **Défaut**: `128000`
- **Description**: Seuil de tokens pour activer le mode de gestion des tokens
- **Utilisation**: Quand le contenu dépasse cette limite, le système active la gestion intelligente des tokens
- **Recommandations**: Devrait être égal ou légèrement inférieur à `AI_MAX_INPUT_TOKENS`

## Comment ça fonctionne

### 1. Au démarrage du serveur

Le serveur affiche automatiquement les limites de tokens configurées :

```
📊 TOKEN LIMITS CONFIGURATION:
  Max Output Tokens: 8,192
  Max Input Tokens: 128,000
  Standard Token Limit: 128,000
```

### 2. Pendant la génération

Le système utilise ces limites pour :

1. **Contrôler la longueur des réponses** via `maxOutputTokens` dans la configuration du modèle
2. **Gérer le contexte** en vérifiant si le contenu dépasse `standardTokenLimit`
3. **Optimiser les prompts** en sélectionnant uniquement les fichiers pertinents si nécessaire

### 3. Gestion automatique

Quand le contexte dépasse `AI_STANDARD_TOKEN_LIMIT` :

```typescript
if (tokenCount > tokenLimits.standardTokenLimit) {
  // Active le mode token-limité
  // Sélectionne uniquement les fichiers pertinents
  // Utilise un prompt optimisé
}
```

## Exemples de configuration

### Configuration économique (coûts réduits)

```env
AI_MAX_OUTPUT_TOKENS=4096
AI_MAX_INPUT_TOKENS=32000
AI_STANDARD_TOKEN_LIMIT=32000
```

### Configuration standard (recommandée)

```env
AI_MAX_OUTPUT_TOKENS=8192
AI_MAX_INPUT_TOKENS=128000
AI_STANDARD_TOKEN_LIMIT=128000
```

### Configuration haute performance

```env
AI_MAX_OUTPUT_TOKENS=16384
AI_MAX_INPUT_TOKENS=200000
AI_STANDARD_TOKEN_LIMIT=180000
```

### Configuration maximale (projets très complexes)

```env
AI_MAX_OUTPUT_TOKENS=32768
AI_MAX_INPUT_TOKENS=200000
AI_STANDARD_TOKEN_LIMIT=180000
```

## Fichiers modifiés

Les limites de tokens sont utilisées dans :

1. **`src/config/tokenLimits.ts`** - Configuration centralisée
2. **`src/config/modelConfig.ts`** - Configuration des modèles AI
3. **`src/handlers/builderHandler.ts`** - Gestion des générations
4. **`src/server.ts`** - Affichage au démarrage

## Validation

Le système valide automatiquement les limites au démarrage :

- ✅ Vérifie que les valeurs sont positives
- ✅ Avertit si `maxOutputTokens > maxInputTokens`
- ✅ Affiche les valeurs configurées dans les logs

## Monitoring

Pour voir les limites actuelles, démarrez le serveur :

```bash
npm run dev
```

Les limites seront affichées dans la console au démarrage.

## Dépannage

### Erreur: "Invalid AI_MAX_OUTPUT_TOKENS"

- Vérifiez que la valeur est un nombre positif
- Exemple valide: `AI_MAX_OUTPUT_TOKENS=8192`

### Erreur: "Invalid AI_MAX_INPUT_TOKENS"

- Vérifiez que la valeur est un nombre positif
- Exemple valide: `AI_MAX_INPUT_TOKENS=128000`

### Avertissement: "maxOutputTokens > maxInputTokens"

- L'AI ne peut pas générer plus de tokens qu'elle n'en reçoit
- Ajustez `AI_MAX_OUTPUT_TOKENS` pour qu'il soit inférieur à `AI_MAX_INPUT_TOKENS`

### Réponses tronquées

- Augmentez `AI_MAX_OUTPUT_TOKENS`
- Vérifiez les limites du modèle AI utilisé

### Erreurs de contexte trop large

- Réduisez `AI_MAX_INPUT_TOKENS`
- Le système activera automatiquement la gestion intelligente des tokens

## Bonnes pratiques

1. **Commencez avec les valeurs par défaut** et ajustez selon vos besoins
2. **Surveillez les coûts** - Plus de tokens = coûts plus élevés
3. **Testez différentes configurations** pour trouver le bon équilibre
4. **Documentez vos changements** dans votre fichier `.env`
5. **Utilisez des valeurs cohérentes** entre les environnements (dev/prod)

## Support des modèles

Différents modèles AI ont des limites différentes :

| Modèle          | Max Input   | Max Output | Recommandation            |
| --------------- | ----------- | ---------- | ------------------------- |
| Gemini 1.5 Pro  | 2M tokens   | 8K tokens  | AI_MAX_OUTPUT_TOKENS=8192 |
| GPT-4 Turbo     | 128K tokens | 4K tokens  | AI_MAX_OUTPUT_TOKENS=4096 |
| Claude 3 Sonnet | 200K tokens | 4K tokens  | AI_MAX_OUTPUT_TOKENS=4096 |
| DeepSeek        | 64K tokens  | 8K tokens  | AI_MAX_OUTPUT_TOKENS=8192 |

Vérifiez toujours les limites du modèle que vous utilisez et configurez les variables en conséquence.
