# Documentation du Système de Cache Redis

## Vue d'ensemble

Le système de cache Redis a été implémenté pour optimiser drastiquement les performances de l'API Idem en mettant en cache les résultats coûteux des générations AI et des requêtes de base de données fréquentes.

## Architecture

### Composants principaux

1. **RedisConnection** (`api/config/redis.config.ts`)
   - Singleton pour la gestion de la connexion Redis
   - Configuration automatique avec gestion des événements
   - Test de connexion et fermeture propre

2. **CacheService** (`api/services/cache.service.ts`)
   - Service centralisé pour toutes les opérations de cache
   - Méthodes CRUD complètes avec TTL configurable
   - Génération automatique de clés basées sur le contenu
   - Statistiques et monitoring intégrés

3. **CacheController** (`api/controllers/cache.controller.ts`)
   - API REST pour la gestion du cache
   - Endpoints d'administration et de monitoring
   - Invalidation ciblée par utilisateur/projet

4. **Integration Repository** (`api/repository/FirestoreRepository.ts`)
   - Cache transparent au niveau des requêtes de base de données
   - Invalidation automatique lors des mises à jour
   - TTL de 30 minutes pour les données de base

## Configuration

### Variables d'environnement

```bash
# Configuration Redis
REDIS_HOST=localhost          # Hôte Redis (défaut: localhost)
REDIS_PORT=6379              # Port Redis (défaut: 6379)
REDIS_PASSWORD=              # Mot de passe Redis (optionnel)
REDIS_DB=0                   # Base de données Redis (défaut: 0)
```

### TTL par type de cache

- **Générations AI** : 2 heures (7200s)
- **PDF générés** : 1 heure (3600s)
- **Requêtes DB** : 30 minutes (1800s)

## Utilisation

### Cache des générations AI

Le cache est automatiquement intégré dans :
- `BusinessPlanService.generateBusinessPlanWithStreaming()`
- `BrandingService.generateBrandingWithStreaming()`
- Génération de PDF pour tous les services

```typescript
// Exemple d'utilisation dans un service
const contentHash = crypto.createHash('sha256')
  .update(JSON.stringify(projectData))
  .digest('hex')
  .substring(0, 16);

const cacheKey = cacheService.generateAIKey('business-plan', userId, projectId, contentHash);

// Vérifier le cache
const cached = await cacheService.get<ProjectModel>(cacheKey, { 
  prefix: 'ai',
  ttl: 7200 
});

if (cached) {
  return cached; // Cache hit
}

// Générer et mettre en cache
const result = await generateContent();
await cacheService.set(cacheKey, result, { prefix: 'ai', ttl: 7200 });
```

### Cache des requêtes de base de données

Intégration transparente dans `FirestoreRepository` :
- Cache automatique sur `findById()`
- Invalidation sur `update()` et `delete()`
- Clés générées automatiquement

### API de gestion du cache

#### Endpoints disponibles

```bash
# Statistiques du cache
GET /cache/stats

# Vider le cache complet
DELETE /cache/clear

# Invalider le cache utilisateur
DELETE /cache/user/:userId

# Invalider le cache projet
DELETE /cache/project/:projectId

# Invalider par pattern
DELETE /cache/pattern
Body: { "pattern": "user:123:*" }

# Vérifier une clé
GET /cache/key?key=mykey&prefix=ai

# Mettre à jour TTL
PUT /cache/ttl
Body: { "key": "mykey", "ttl": 3600, "prefix": "ai" }
```

## Stratégies de cache

### Clés de cache intelligentes

Le système génère des clés basées sur le contenu pour garantir la cohérence :

```typescript
// Génération de hash pour le contenu
const contentHash = crypto.createHash('sha256')
  .update(JSON.stringify(content))
  .digest('hex')
  .substring(0, 16);

// Types de clés
cacheService.generateAIKey(type, userId, projectId, contentHash)
cacheService.generateDBKey(collection, userId, id)
```

### Invalidation automatique

- **Mise à jour de projet** : Invalide tous les caches liés au projet
- **Mise à jour utilisateur** : Invalide tous les caches de l'utilisateur
- **Mise à jour de données** : Invalide le cache spécifique de l'entité

### Patterns d'invalidation

```typescript
// Invalider tout pour un utilisateur
await cacheService.invalidateUserCache(userId);

// Invalider tout pour un projet
await cacheService.invalidateProjectCache(projectId);

// Invalider par pattern personnalisé
await cacheService.deletePattern("ai:branding:*");
```

## Monitoring et statistiques

### Métriques disponibles

```typescript
interface CacheStats {
  totalKeys: number;        // Nombre total de clés
  memoryUsage: string;      // Utilisation mémoire Redis
  hitRate: number;          // Taux de succès (%)
  missRate: number;         // Taux d'échec (%)
  totalHits: number;        // Total des hits
  totalMisses: number;      // Total des misses
}
```

### Logging intégré

Tous les événements de cache sont loggés avec Winston :
- Cache hits/misses avec métriques
- Opérations d'invalidation
- Erreurs de connexion Redis
- Statistiques de performance

## Gains de performance attendus

### Générations AI
- **Premier appel** : Temps normal de génération (5-15s)
- **Appels suivants** : ~50ms (cache hit)
- **Gain** : 99% de réduction du temps de réponse

### Requêtes de base de données
- **Premier appel** : Temps normal Firestore (100-500ms)
- **Appels suivants** : ~10ms (cache hit)
- **Gain** : 90-95% de réduction du temps de réponse

### Génération PDF
- **Premier appel** : Temps normal Puppeteer (2-5s)
- **Appels suivants** : ~20ms (cache hit)
- **Gain** : 99% de réduction du temps de réponse

## Sécurité et bonnes pratiques

### Gestion des erreurs
- Fallback gracieux si Redis est indisponible
- Continuation du service sans cache en cas d'erreur
- Logging détaillé pour le debugging

### Sécurité des données
- Pas de données sensibles en cache (tokens, mots de passe)
- TTL appropriés pour éviter les données obsolètes
- Invalidation proactive lors des mises à jour

### Optimisations
- Compression automatique des données volumineuses
- Clés de cache optimisées pour éviter les collisions
- Nettoyage automatique des clés expirées

## Installation et démarrage

1. **Installer Redis** :
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:alpine
```

2. **Configurer les variables d'environnement** :
```bash
cp .env.example .env
# Modifier les variables REDIS_* selon votre configuration
```

3. **Installer les dépendances** :
```bash
npm install
```

4. **Démarrer l'application** :
```bash
npm run dev
```

Le système vérifiera automatiquement la connexion Redis au démarrage et affichera le statut dans les logs.

## Troubleshooting

### Problèmes courants

1. **Redis non accessible** :
   - Vérifier que Redis est démarré
   - Vérifier les variables d'environnement
   - Vérifier les permissions réseau

2. **Cache non fonctionnel** :
   - Vérifier les logs pour les erreurs Redis
   - Tester la connexion avec `GET /cache/stats`
   - Vérifier la configuration des TTL

3. **Performance dégradée** :
   - Monitorer l'utilisation mémoire Redis
   - Vérifier les taux de hit/miss
   - Ajuster les TTL si nécessaire

### Commandes de diagnostic

```bash
# Tester la connexion Redis
redis-cli ping

# Voir les clés en cache
redis-cli keys "idem:*"

# Statistiques Redis
redis-cli info memory

# Vider le cache manuellement
redis-cli flushdb
```

## Évolutions futures

### Améliorations prévues
- Cache distribué pour la scalabilité
- Compression avancée des données
- Métriques temps réel avec dashboard
- Cache prédictif basé sur l'usage
- Stratégies d'éviction intelligentes

### Intégrations possibles
- Cache CDN pour les assets statiques
- Cache de session utilisateur
- Cache des résultats de recherche
- Cache des templates de génération
