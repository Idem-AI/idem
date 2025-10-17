# Système de Refresh Token - Documentation

## Vue d'ensemble

Le système de refresh token a été implémenté pour améliorer la sécurité et l'expérience utilisateur en permettant le renouvellement automatique des tokens d'accès sans nécessiter une nouvelle authentification complète.

## Architecture

### 1. Modèle de données (`api/models/userModel.ts`)

```typescript
export interface RefreshTokenData {
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsed?: Date;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface UserModel {
  // ... autres propriétés
  refreshTokens?: RefreshTokenData[];
}
```

### 2. Service RefreshToken (`api/services/refreshToken.service.ts`)

**Fonctionnalités principales :**
- `generateRefreshToken()` : Génère un nouveau refresh token
- `validateRefreshToken()` : Valide un refresh token existant
- `revokeRefreshToken()` : Révoque un token spécifique
- `revokeAllRefreshTokens()` : Révoque tous les tokens d'un utilisateur
- `cleanupExpiredTokens()` : Nettoie les tokens expirés

**Configuration :**
- Durée de vie : 30 jours
- Maximum 5 tokens par utilisateur
- Tokens sécurisés de 128 caractères (64 bytes hex)

### 3. Contrôleurs d'authentification (`api/controllers/auth.controller.ts`)

**Nouveaux endpoints :**
- `refreshTokenController` : Rafraîchit un token d'accès
- `logoutController` : Déconnexion avec révocation du token
- `logoutAllController` : Déconnexion de tous les appareils
- `getRefreshTokensController` : Liste les tokens actifs

### 4. Middleware d'authentification amélioré (`api/services/auth.service.ts`)

**Auto-refresh :** Le middleware tente automatiquement de rafraîchir les session cookies expirés en utilisant le refresh token disponible.

## API Endpoints

### POST /auth/sessionLogin
- **Fonction :** Connexion avec génération de session cookie et refresh token
- **Réponse :** Session cookie + refresh token (cookie + body)

### POST /auth/refresh
- **Fonction :** Rafraîchit le token d'accès
- **Input :** Refresh token (cookie ou body)
- **Réponse :** Nouveau session cookie

### POST /auth/logout
- **Fonction :** Déconnexion avec révocation du refresh token
- **Auth :** Requise
- **Action :** Supprime les cookies et révoque le token

### POST /auth/logout-all
- **Fonction :** Déconnexion de tous les appareils
- **Auth :** Requise
- **Action :** Révoque tous les refresh tokens

### GET /auth/refresh-tokens
- **Fonction :** Liste les refresh tokens actifs
- **Auth :** Requise
- **Réponse :** Informations des tokens (sans les tokens eux-mêmes)

## Sécurité

### Mesures de sécurité implémentées :
1. **Tokens sécurisés :** Génération cryptographique avec `crypto.randomBytes(64)`
2. **Limitation :** Maximum 5 tokens par utilisateur
3. **Expiration :** Tokens automatiquement expirés après 30 jours
4. **Révocation :** Possibilité de révoquer individuellement ou en masse
5. **Tracking :** Suivi des informations d'appareil et IP
6. **HttpOnly cookies :** Protection contre XSS
7. **Secure cookies :** HTTPS en production

### Rotation des tokens :
- Les refresh tokens sont mis à jour à chaque utilisation (`lastUsed`)
- Nettoyage automatique des tokens expirés
- Suppression des plus anciens tokens si limite atteinte

## Maintenance

### Script de nettoyage (`api/scripts/cleanupExpiredTokens.ts`)
- Supprime tous les refresh tokens expirés du système
- Peut être exécuté manuellement ou via cron job

### Tâches programmées (`api/config/scheduler.ts`)
- Nettoyage automatique quotidien à 2h du matin UTC
- Configuration via `node-cron`

## Configuration requise

### Variables d'environnement :
- `NODE_ENV` : Détermine les paramètres de cookies (secure, sameSite)

### Dépendances :
- `crypto` : Génération de tokens sécurisés
- `node-cron` : Tâches programmées (optionnel)

## Utilisation côté client

### Flux d'authentification :
1. **Login :** Appeler `/sessionLogin` avec token Firebase
2. **Stockage :** Les cookies sont automatiquement gérés
3. **Refresh automatique :** Le middleware gère le renouvellement
4. **Refresh manuel :** Appeler `/refresh` si nécessaire
5. **Logout :** Appeler `/logout` ou `/logout-all`

### Gestion des erreurs :
- **403 :** Token expiré, utiliser le refresh token
- **401 :** Refresh token invalide, nouvelle authentification requise

## Monitoring et logs

Tous les événements sont loggés avec Winston :
- Génération de tokens
- Validation et utilisation
- Révocations
- Erreurs et tentatives d'accès non autorisées
- Nettoyages automatiques

## Tests recommandés

1. **Génération de tokens :** Vérifier la création lors du login
2. **Validation :** Tester avec tokens valides/invalides/expirés
3. **Auto-refresh :** Simuler expiration de session cookie
4. **Révocation :** Tester logout simple et logout all
5. **Limites :** Vérifier la limite de 5 tokens par utilisateur
6. **Nettoyage :** Tester la suppression des tokens expirés

## Migration

Pour les utilisateurs existants, les refresh tokens seront générés automatiquement lors de leur prochaine connexion. Aucune migration de données n'est nécessaire car le champ `refreshTokens` est optionnel dans `UserModel`.
