# Migration Firebase → Casdoor - Main Dashboard

## Vue d'ensemble

Migration complète de l'authentification Firebase vers Casdoor pour le dashboard Angular.

## Étapes de Migration

### 1. Configuration Casdoor (Backend)

Assurez-vous que Casdoor est configuré et en cours d'exécution :

```bash
cd apps/api
./start.sh
```

Accédez à http://localhost:8000 et configurez :
- Organisation : `idem`
- Application : `idem-dashboard`
- Providers : Google, GitHub
- Redirect URI : `http://localhost:4200/auth/callback`

### 2. Configuration Frontend

**Fichiers modifiés :**
- ✅ `src/environments/environment.development.ts`
- ✅ `src/environments/environment.ts`

**Configuration ajoutée :**
```typescript
casdoor: {
  endpoint: 'http://localhost:8000',
  clientId: 'your-client-id', // Depuis Casdoor
  clientSecret: 'your-client-secret',
  organization: 'idem',
  application: 'idem-dashboard',
  redirectUri: 'http://localhost:4200/auth/callback',
}
```

### 3. Services créés

**`src/app/shared/services/casdoor.service.ts`**
- Gestion de l'authentification OAuth avec Casdoor
- Méthodes : `getGoogleLoginUrl()`, `getGithubLoginUrl()`, `exchangeCodeForToken()`, `getUserProfile()`, `logout()`

**`src/app/modules/auth/pages/callback/callback.ts`**
- Page de callback OAuth
- Gère l'échange du code d'autorisation contre un token
- Récupère le profil utilisateur et redirige vers le dashboard

### 4. Flux d'authentification

**Avant (Firebase) :**
```
Login → Firebase Popup → Token → Backend → Dashboard
```

**Après (Casdoor) :**
```
Login → Casdoor OAuth → Callback → Exchange Code → Token → Profile → Dashboard
```

### 5. Prochaines étapes

#### A. Mettre à jour AuthService

Remplacer les méthodes Firebase par Casdoor :

```typescript
// AVANT
async loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(this.auth, provider);
  await this.postLogin(result.user);
}

// APRÈS
loginWithGoogle() {
  const url = this.casdoorService.getGoogleLoginUrl();
  window.location.href = url;
}
```

#### B. Mettre à jour les composants de login

**`login-card.ts` :**
```typescript
loginWithGoogle() {
  const url = this.casdoorService.getGoogleLoginUrl();
  window.location.href = url;
}

loginWithGithub() {
  const url = this.casdoorService.getGithubLoginUrl();
  window.location.href = url;
}
```

#### C. Ajouter la route callback

**`app.routes.ts` :**
```typescript
{
  path: 'auth/callback',
  component: CallbackComponent,
}
```

#### D. Mettre à jour les guards

Remplacer la vérification Firebase par Casdoor :

```typescript
// AVANT
canActivate(): boolean {
  return !!this.auth.currentUser;
}

// APRÈS
canActivate(): boolean {
  return this.casdoorService.isAuthenticated();
}
```

#### E. Mettre à jour l'interceptor HTTP

Ajouter le token Casdoor aux requêtes :

```typescript
intercept(req: HttpRequest<any>, next: HttpHandler) {
  const token = this.casdoorService.getAccessToken();
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next.handle(req);
}
```

### 6. Supprimer Firebase

Une fois la migration terminée :

```bash
# Supprimer les dépendances
npm uninstall @angular/fire

# Supprimer les imports Firebase
# - src/app/app.config.ts (provideFirebaseApp, provideAuth)
# - src/app/modules/auth/services/auth.service.ts
```

### 7. Variables d'environnement à configurer

**Development (.env.development) :**
```bash
CASDOOR_ENDPOINT=http://localhost:8000
CASDOOR_CLIENT_ID=<depuis Casdoor>
CASDOOR_CLIENT_SECRET=<depuis Casdoor>
CASDOOR_ORGANIZATION=idem
CASDOOR_APPLICATION=idem-dashboard
CASDOOR_REDIRECT_URI=http://localhost:4200/auth/callback
```

**Production (.env.production) :**
```bash
CASDOOR_ENDPOINT=https://auth.idem.africa
CASDOOR_CLIENT_ID=<depuis Casdoor>
CASDOOR_CLIENT_SECRET=<depuis Casdoor>
CASDOOR_ORGANIZATION=idem
CASDOOR_APPLICATION=idem-dashboard
CASDOOR_REDIRECT_URI=https://console.idem.africa/auth/callback
```

### 8. Configuration Casdoor (Backend)

Assurez-vous que l'API backend a les endpoints suivants :

- `POST /auth/login` - Échange code → token
- `GET /auth/profile` - Récupère le profil utilisateur
- `POST /auth/refresh` - Rafraîchit le token
- `POST /auth/logout` - Déconnexion

### 9. Tests

**Tester le flux complet :**

1. Démarrer Casdoor : `cd apps/api && ./start.sh`
2. Démarrer le dashboard : `cd apps/main-dashboard && npm start`
3. Accéder à http://localhost:4200/auth/login
4. Cliquer sur "Login with Google" ou "Login with GitHub"
5. Vérifier la redirection vers Casdoor
6. Vérifier le callback et la redirection vers le dashboard
7. Vérifier que le profil utilisateur est chargé

### 10. Avantages de Casdoor

✅ **Self-hosted** - Contrôle total sur les données
✅ **Multi-providers** - Google, GitHub, etc.
✅ **Open-source** - Pas de vendor lock-in
✅ **Gratuit** - Pas de coûts Firebase
✅ **Personnalisable** - UI et workflows
✅ **RGPD compliant** - Données en Europe

### 11. Différences clés

| Feature | Firebase | Casdoor |
|---------|----------|---------|
| **Popup login** | ✅ Oui | ❌ Non (redirect) |
| **Mobile support** | ✅ Redirect | ✅ Redirect |
| **Token refresh** | ✅ Auto | ✅ Manuel |
| **User management** | ❌ Console | ✅ UI complète |
| **Self-hosted** | ❌ Non | ✅ Oui |
| **Coût** | 💰 Pay-as-you-go | ✅ Gratuit |

### 12. Troubleshooting

**Erreur : "Invalid state parameter"**
- Vérifier que le state est bien stocké dans sessionStorage
- Vérifier que le callback reçoit le même state

**Erreur : "CORS"**
- Configurer CORS dans l'API backend
- Ajouter `http://localhost:4200` aux origines autorisées

**Erreur : "Invalid redirect URI"**
- Vérifier que l'URI dans Casdoor correspond exactement
- Vérifier le protocole (http vs https)

**Token expiré**
- Implémenter le refresh automatique
- Vérifier la durée de vie du token dans Casdoor

## Résumé

La migration de Firebase vers Casdoor nécessite :
1. ✅ Configuration Casdoor (backend)
2. ✅ Service CasdoorService créé
3. ✅ Page callback créée
4. ⏳ Mise à jour AuthService
5. ⏳ Mise à jour composants login
6. ⏳ Mise à jour guards et interceptors
7. ⏳ Suppression Firebase

**Prochaine action :** Mettre à jour `AuthService` pour utiliser `CasdoorService`
