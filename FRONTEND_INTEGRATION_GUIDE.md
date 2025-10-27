# Guide d'Intégration Frontend - Système d'Autorisation

Ce guide explique comment intégrer le système d'autorisation dans vos applications frontend (React, Svelte, Angular).

## 📦 Package Unique pour Tous les Frontends

Le package `@idem/shared-auth-client` fonctionne avec **tous vos frameworks**:

- ✅ **React** (appgen)
- ✅ **Svelte** (chart)
- ✅ **Angular** (main-app)

## 🚀 Installation

### 1. Build les packages partagés

```bash
# À la racine du monorepo
npm install
npm run build:shared
npm run build:shared-auth
```

### 2. Installer dans chaque application

```bash
# Dans appgen
cd apps/appgen/apps/we-dev-client
npm install @idem/shared-auth-client

# Dans chart
cd apps/chart
npm install @idem/shared-auth-client

# Dans main-app
cd apps/main-app
npm install @idem/shared-auth-client
```

---

## 🎯 React (appgen)

### Configuration

```typescript
// src/lib/authClient.ts
import { AuthClient } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

export const authClient = new AuthClient({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  getAuthToken: async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  },
});
```

### Utilisation avec Hooks

```typescript
// src/components/TeamManagement.tsx
import { useAuth } from '@idem/shared-auth-client';
import { authClient } from '../lib/authClient';

export function TeamManagement() {
  const { teams, loading, createTeam, inviteUser } = useAuth(authClient);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Teams</h1>
      {teams.map(team => (
        <div key={team.id}>{team.name}</div>
      ))}
      <button onClick={() => createTeam('New Team')}>
        Create Team
      </button>
    </div>
  );
}
```

### Vérification des Permissions

```typescript
// src/components/ProjectActions.tsx
import { useProjectPermissions } from '@idem/shared-auth-client';
import { authClient } from '../lib/authClient';

export function ProjectActions({ projectId }: { projectId: string }) {
  const { hasPermission, loading } = useProjectPermissions(authClient, projectId);

  if (loading) return <div>Loading permissions...</div>;

  return (
    <div>
      {hasPermission('canEdit') && <button>Edit</button>}
      {hasPermission('canDeploy') && <button>Deploy</button>}
      {hasPermission('canDelete') && <button>Delete</button>}
    </div>
  );
}
```

### Exemple Complet

Voir: `packages/shared-auth-client/examples/react-example.tsx`

---

## 🎨 Svelte (chart)

### Configuration

```typescript
// src/lib/stores/auth.ts
import { AuthClient } from '@idem/shared-auth-client';
import { createAuthStore } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

const authClient = new AuthClient({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  getAuthToken: async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  },
});

export const authStore = createAuthStore(authClient);
export { authClient };
```

### Utilisation avec Stores

```svelte
<!-- src/routes/teams/+page.svelte -->
<script lang="ts">
  import { authStore } from '$lib/stores/auth';

  $: ({ teams, loading } = $authStore);

  async function handleCreateTeam() {
    await authStore.createTeam('New Team');
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  <h1>My Teams</h1>
  {#each teams as team}
    <div>{team.name}</div>
  {/each}
  <button on:click={handleCreateTeam}>Create Team</button>
{/if}
```

### Vérification des Permissions

```svelte
<!-- src/components/ProjectActions.svelte -->
<script lang="ts">
  import { createProjectPermissionsStore } from '@idem/shared-auth-client';
  import { authClient } from '$lib/stores/auth';

  export let projectId: string;

  $: permissionsStore = createProjectPermissionsStore(authClient, projectId);
  $: ({ permissions, loading } = $permissionsStore);
</script>

{#if loading}
  <p>Loading permissions...</p>
{:else if permissions}
  {#if permissions.canEdit}
    <button>Edit</button>
  {/if}
  {#if permissions.canDeploy}
    <button>Deploy</button>
  {/if}
{/if}
```

### Exemple Complet

Voir: `packages/shared-auth-client/examples/svelte-example.svelte`

---

## 🅰️ Angular (main-app)

### Configuration

```typescript
// src/app/services/auth-client.service.ts
import { Injectable } from '@angular/core';
import { AuthClient } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthClientService {
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient({
      apiBaseUrl: 'http://localhost:3001',
      getAuthToken: async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          return await user.getIdToken();
        }
        return null;
      },
    });
  }

  getClient(): AuthClient {
    return this.authClient;
  }
}
```

### Configuration des Providers

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { AuthService, ProjectPermissionsService } from '@idem/shared-auth-client';

export const appConfig: ApplicationConfig = {
  providers: [
    AuthService,
    ProjectPermissionsService,
    AuthClientService,
    // ... autres providers
  ],
};
```

### Utilisation avec Services

```typescript
// src/app/components/team-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@idem/shared-auth-client';
import { AuthClientService } from '../services/auth-client.service';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="loading$ | async">Loading...</div>
    <div *ngIf="!(loading$ | async)">
      <h1>My Teams</h1>
      <div *ngFor="let team of teams$ | async">
        {{ team.name }}
      </div>
      <button (click)="createTeam()">Create Team</button>
    </div>
  `,
})
export class TeamManagementComponent implements OnInit {
  teams$ = this.authService.teams$;
  loading$ = this.authService.loading$;

  constructor(
    private authService: AuthService,
    private authClientService: AuthClientService
  ) {
    this.authService.initialize(this.authClientService.getClient());
  }

  ngOnInit() {
    this.authService.fetchTeams();
  }

  async createTeam() {
    await this.authService.createTeam('New Team');
  }
}
```

### Route Guard

```typescript
// src/app/guards/project-edit.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ProjectPermissionsService } from '@idem/shared-auth-client';

export const projectEditGuard: CanActivateFn = async (route) => {
  const permissionsService = inject(ProjectPermissionsService);
  const router = inject(Router);

  const projectId = route.params['projectId'];
  await permissionsService.fetchPermissions(projectId);

  if (permissionsService.hasPermission('canEdit')) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};
```

### Exemple Complet

Voir: `packages/shared-auth-client/examples/angular-example.ts`

---

## 🔑 API Disponibles

### Teams

```typescript
// Créer une équipe
await authClient.createTeam({ name: 'Mon Équipe', description: 'Description' });

// Récupérer mes équipes
const teams = await authClient.getMyTeams();

// Ajouter un membre
await authClient.addTeamMember(teamId, {
  email: 'user@example.com',
  displayName: 'John Doe',
  role: 'member',
});

// Mettre à jour le rôle
await authClient.updateMemberRole(teamId, userId, 'admin');

// Retirer un membre
await authClient.removeMember(teamId, memberId);
```

### Invitations

```typescript
// Créer une invitation
await authClient.createInvitation({
  email: 'newuser@example.com',
  displayName: 'New User',
  invitationType: 'team',
  teamId: 'team-id',
  teamRole: 'member',
});

// Accepter une invitation
await authClient.acceptInvitation(token, tempPassword, newPassword);
```

### Permissions

```typescript
// Ajouter une équipe à un projet
await authClient.addTeamToProject(projectId, teamId, ['developer', 'designer']);

// Récupérer mes permissions
const permissions = await authClient.getProjectPermissions(projectId);
// { canEdit: true, canDelete: false, canDeploy: true, ... }

// Vérifier l'accès
const hasAccess = await authClient.checkProjectAccess(projectId);
```

---

## 📝 Checklist d'Intégration

### Pour chaque application:

- [ ] Installer `@idem/shared-auth-client`
- [ ] Créer l'instance `AuthClient` avec Firebase Auth
- [ ] Configurer l'URL de l'API
- [ ] Implémenter la gestion des équipes
- [ ] Implémenter la vérification des permissions
- [ ] Tester la création d'équipes
- [ ] Tester l'invitation d'utilisateurs
- [ ] Tester les permissions sur les projets

---

## 🎨 Composants UI Recommandés

### Composants à Créer

1. **TeamManagement**: Liste et gestion des équipes
2. **TeamMemberList**: Liste des membres d'une équipe
3. **InviteUserModal**: Modal pour inviter un utilisateur
4. **CreateTeamModal**: Modal pour créer une équipe
5. **PermissionGuard**: Composant/Guard pour vérifier les permissions
6. **ProjectTeamManager**: Gestion des équipes d'un projet

### Exemple de Structure

```
src/
├── components/
│   ├── teams/
│   │   ├── TeamManagement.tsx/svelte/component.ts
│   │   ├── TeamCard.tsx/svelte/component.ts
│   │   ├── TeamMemberList.tsx/svelte/component.ts
│   │   └── InviteUserModal.tsx/svelte/component.ts
│   └── permissions/
│       ├── PermissionGuard.tsx/svelte/component.ts
│       └── ProjectActions.tsx/svelte/component.ts
├── lib/ (ou services/)
│   ├── authClient.ts
│   └── stores/auth.ts (pour Svelte)
└── guards/ (pour Angular)
    └── project-edit.guard.ts
```

---

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# .env
VITE_API_URL=http://localhost:3001
# ou
NEXT_PUBLIC_API_URL=http://localhost:3001
# ou pour Angular
API_URL=http://localhost:3001
```

### Gestion des Erreurs

```typescript
const authClient = new AuthClient({
  apiBaseUrl: process.env.VITE_API_URL,
  getAuthToken: async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('User not authenticated');
        return null;
      }
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  },
});
```

### Intercepteurs de Requêtes

```typescript
class CustomAuthClient extends AuthClient {
  protected async fetch<T>(endpoint: string, options: RequestInit = {}) {
    console.log('API Request:', endpoint);

    try {
      const result = await super.fetch<T>(endpoint, options);
      console.log('API Response:', result);
      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
}
```

---

## 🧪 Tests

### React (avec Jest/Vitest)

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@idem/shared-auth-client';

test('should fetch teams', async () => {
  const { result } = renderHook(() => useAuth(mockAuthClient));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.teams).toHaveLength(2);
});
```

### Svelte (avec Vitest)

```typescript
import { get } from 'svelte/store';
import { createAuthStore } from '@idem/shared-auth-client';

test('should fetch teams', async () => {
  const store = createAuthStore(mockAuthClient);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const state = get(store);
  expect(state.teams).toHaveLength(2);
});
```

### Angular (avec Jasmine)

```typescript
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@idem/shared-auth-client';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    service.initialize(mockAuthClient);
  });

  it('should fetch teams', async () => {
    await service.fetchTeams();

    service.teams$.subscribe((teams) => {
      expect(teams.length).toBe(2);
    });
  });
});
```

---

## 🚨 Dépannage

### Erreur: Cannot find module '@idem/shared-auth-client'

```bash
# Rebuild les packages
npm run build:shared
npm run build:shared-auth

# Réinstaller
cd apps/your-app
npm install
```

### Les permissions ne se chargent pas

Vérifiez:

1. L'utilisateur est bien authentifié
2. Le token Firebase est valide
3. L'URL de l'API est correcte
4. Le projectId est fourni

### Les équipes ne s'affichent pas

Vérifiez:

1. L'AuthClient est bien initialisé
2. Le hook/store est bien appelé
3. L'utilisateur a des équipes dans la base de données

---

## 📚 Ressources

- [Documentation complète](../documentation/AUTHORIZATION_SYSTEM.md)
- [Package shared-models](../packages/shared-models/README.md)
- [Package shared-auth-client](../packages/shared-auth-client/README.md)
- [Exemples React](../packages/shared-auth-client/examples/react-example.tsx)
- [Exemples Svelte](../packages/shared-auth-client/examples/svelte-example.svelte)
- [Exemples Angular](../packages/shared-auth-client/examples/angular-example.ts)

---

## ✅ Prochaines Étapes

1. ⬜ Intégrer dans appgen (React)
2. ⬜ Intégrer dans chart (Svelte)
3. ⬜ Intégrer dans main-app (Angular)
4. ⬜ Créer les composants UI
5. ⬜ Tester l'ensemble du système
6. ⬜ Déployer en production

Bon développement! 🚀
