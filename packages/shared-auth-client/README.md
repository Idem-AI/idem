# @idem/shared-auth-client

Package client d'authentification et d'autorisation partagé pour tous les frontends Idem.

## Installation

```bash
npm install @idem/shared-auth-client
```

## Utilisation

Ce package fonctionne avec **React**, **Svelte** et **Angular**.

### Configuration Initiale

```typescript
import { AuthClient } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

const authClient = new AuthClient({
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
```

---

## React (appgen)

### Hooks

```typescript
import { useAuth, useProjectPermissions } from '@idem/shared-auth-client';

function MyComponent() {
  const { teams, loading, createTeam, inviteUser } = useAuth(authClient);
  const { permissions, hasPermission } = useProjectPermissions(authClient, projectId);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Teams</h1>
      {teams.map(team => (
        <div key={team.id}>{team.name}</div>
      ))}

      {hasPermission('canEdit') && (
        <button onClick={() => createTeam('New Team')}>Create Team</button>
      )}
    </div>
  );
}
```

---

## Svelte (chart)

### Stores

```typescript
import { createAuthStore, createProjectPermissionsStore } from '@idem/shared-auth-client';

// Dans un fichier store.ts
export const authStore = createAuthStore(authClient);
export const projectPermissionsStore = createProjectPermissionsStore(authClient, projectId);
```

```svelte
<script lang="ts">
  import { authStore } from './stores';

  $: ({ teams, loading } = $authStore);
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  <h1>My Teams</h1>
  {#each teams as team}
    <div>{team.name}</div>
  {/each}

  <button on:click={() => authStore.createTeam('New Team')}>
    Create Team
  </button>
{/if}
```

---

## Angular (main-app)

### Services

```typescript
// app.config.ts ou app.module.ts
import { AuthService, ProjectPermissionsService } from '@idem/shared-auth-client';

export const appConfig: ApplicationConfig = {
  providers: [
    AuthService,
    ProjectPermissionsService,
    // ... autres providers
  ],
};
```

```typescript
// component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@idem/shared-auth-client';
import { AuthClient } from '@idem/shared-auth-client';

@Component({
  selector: 'app-teams',
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
export class TeamsComponent implements OnInit {
  teams$ = this.authService.teams$;
  loading$ = this.authService.loading$;

  constructor(private authService: AuthService) {
    // Initialiser avec authClient
    const authClient = new AuthClient({
      apiBaseUrl: 'http://localhost:3001',
      getAuthToken: async () => {
        // Votre logique Firebase
        return token;
      },
    });
    this.authService.initialize(authClient);
  }

  ngOnInit() {
    this.authService.fetchTeams();
  }

  async createTeam() {
    await this.authService.createTeam('New Team');
  }
}
```

---

## API Disponibles

### Teams

```typescript
// Créer une équipe
await authClient.createTeam({ name: 'Mon Équipe', description: 'Description' });

// Récupérer mes équipes
const teams = await authClient.getMyTeams();

// Récupérer une équipe
const team = await authClient.getTeam(teamId);

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

// Récupérer une invitation
const invitation = await authClient.getInvitationByToken(token);

// Renvoyer une invitation
await authClient.resendInvitation(invitationId);
```

### Permissions de Projet

```typescript
// Ajouter une équipe à un projet
await authClient.addTeamToProject(projectId, teamId, ['developer', 'designer']);

// Récupérer les équipes d'un projet
const teams = await authClient.getProjectTeams(projectId);

// Mettre à jour les rôles
await authClient.updateProjectTeamRoles(projectId, teamId, ['project-admin']);

// Retirer une équipe
await authClient.removeTeamFromProject(projectId, teamId);

// Récupérer mes permissions
const permissions = await authClient.getProjectPermissions(projectId);
// { canEdit: true, canDelete: false, canDeploy: true, ... }

// Vérifier l'accès
const hasAccess = await authClient.checkProjectAccess(projectId);
```

---

## Types Disponibles

Tous les types de `@idem/shared-models` sont réexportés:

```typescript
import type {
  UserModel,
  TeamModel,
  ProjectModel,
  RolePermissions,
  TeamRole,
  ProjectTeamRole,
} from '@idem/shared-auth-client';
```

---

## Exemples Complets

### React - Composant de Gestion d'Équipe

```typescript
import { useState } from 'react';
import { useAuth } from '@idem/shared-auth-client';

export function TeamManagement({ authClient }) {
  const { teams, loading, createTeam, inviteUser, refetchTeams } = useAuth(authClient);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleCreateTeam = async () => {
    const name = prompt('Team name:');
    if (name) {
      await createTeam(name);
    }
  };

  const handleInviteUser = async (teamId: string) => {
    const email = prompt('Email:');
    const displayName = prompt('Display Name:');
    if (email && displayName) {
      await inviteUser(email, displayName, teamId, 'member');
      alert('Invitation sent!');
    }
  };

  if (loading) return <div>Loading teams...</div>;

  return (
    <div>
      <h1>Teams</h1>
      <button onClick={handleCreateTeam}>Create Team</button>

      {teams.map(team => (
        <div key={team.id}>
          <h2>{team.name}</h2>
          <p>{team.members.length} members</p>
          <button onClick={() => handleInviteUser(team.id!)}>
            Invite User
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Svelte - Vérification de Permissions

```svelte
<script lang="ts">
  import { createProjectPermissionsStore } from '@idem/shared-auth-client';

  export let authClient;
  export let projectId: string;

  const permissionsStore = createProjectPermissionsStore(authClient, projectId);

  $: ({ permissions, loading } = $permissionsStore);

  async function deleteProject() {
    if (permissions?.canDelete) {
      // Supprimer le projet
    }
  }
</script>

{#if loading}
  <p>Loading permissions...</p>
{:else if permissions}
  {#if permissions.canEdit}
    <button>Edit Project</button>
  {/if}

  {#if permissions.canDelete}
    <button on:click={deleteProject}>Delete Project</button>
  {/if}

  {#if permissions.canDeploy}
    <button>Deploy</button>
  {/if}
{/if}
```

### Angular - Guard de Route

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { ProjectPermissionsService } from '@idem/shared-auth-client';

@Injectable({
  providedIn: 'root',
})
export class ProjectEditGuard implements CanActivate {
  constructor(
    private permissionsService: ProjectPermissionsService,
    private router: Router
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const projectId = route.params['projectId'];

    await this.permissionsService.fetchPermissions(projectId);

    if (this.permissionsService.hasPermission('canEdit')) {
      return true;
    }

    this.router.navigate(['/unauthorized']);
    return false;
  }
}
```

---

## Configuration Avancée

### Gestion des Erreurs

```typescript
const authClient = new AuthClient({
  apiBaseUrl: process.env.API_URL,
  getAuthToken: async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      return await user.getIdToken();
    } catch (error) {
      console.error('Auth error:', error);
      return null;
    }
  },
});
```

### Intercepteurs de Requêtes

Le client utilise `fetch` natif. Pour ajouter des intercepteurs, vous pouvez étendre la classe:

```typescript
class CustomAuthClient extends AuthClient {
  protected async fetch<T>(endpoint: string, options: RequestInit = {}) {
    console.log('Request:', endpoint);
    const result = await super.fetch<T>(endpoint, options);
    console.log('Response:', result);
    return result;
  }
}
```

---

## Développement

```bash
# Build
npm run build

# Watch mode
npm run dev

# Clean
npm run clean
```

---

## Support

Pour toute question, consultez la documentation principale dans `/documentation/AUTHORIZATION_SYSTEM.md`.
