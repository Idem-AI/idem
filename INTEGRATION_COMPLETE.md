# ✅ Intégration Complète du Système d'Autorisation

Le système d'autorisation a été **intégré directement** dans toutes vos applications.

## 📦 Fichiers Créés

### 🎯 React (appgen) - `/apps/appgen/apps/we-dev-client/src/`

```
src/
├── lib/
│   └── authClient.ts                              # Client d'autorisation configuré
├── components/
│   ├── teams/
│   │   ├── TeamManagement.tsx                     # Page de gestion des équipes
│   │   ├── TeamCard.tsx                           # Carte d'équipe
│   │   ├── CreateTeamModal.tsx                    # Modal de création
│   │   └── InviteUserModal.tsx                    # Modal d'invitation
│   └── permissions/
│       └── ProjectPermissionGuard.tsx             # Guard de permissions
```

**Utilisation:**

```tsx
import { TeamManagement } from './components/teams/TeamManagement';
import { ProjectPermissionGuard } from './components/permissions/ProjectPermissionGuard';

// Dans votre App ou Router
<TeamManagement />

// Pour protéger une action
<ProjectPermissionGuard projectId={projectId} permission="canEdit">
  <button>Edit Project</button>
</ProjectPermissionGuard>
```

---

### 🎨 Svelte (chart) - `/apps/chart/src/lib/`

```
lib/
├── stores/
│   └── auth.ts                                    # Store d'autorisation
├── components/
│   ├── teams/
│   │   ├── TeamManagement.svelte                  # Page de gestion des équipes
│   │   ├── TeamCard.svelte                        # Carte d'équipe
│   │   ├── CreateTeamModal.svelte                 # Modal de création
│   │   └── InviteUserModal.svelte                 # Modal d'invitation
│   └── permissions/
│       └── ProjectPermissionGuard.svelte          # Guard de permissions
```

**Utilisation:**

```svelte
<script>
  import TeamManagement from '$lib/components/teams/TeamManagement.svelte';
  import ProjectPermissionGuard from '$lib/components/permissions/ProjectPermissionGuard.svelte';
</script>

<!-- Dans votre route -->
<TeamManagement />

<!-- Pour protéger une action -->
<ProjectPermissionGuard projectId={projectId} permission="canEdit">
  <button>Edit Project</button>
</ProjectPermissionGuard>
```

---

### 🅰️ Angular (main-app) - `/apps/main-app/src/app/`

```
app/
├── services/
│   └── auth-client.service.ts                     # Service client d'autorisation
├── components/
│   └── teams/
│       └── team-management.component.ts           # Composant de gestion des équipes
├── guards/
│   └── project-edit.guard.ts                      # Guards de routes
└── directives/
    └── has-permission.directive.ts                # Directive de permissions
```

**Utilisation:**

```typescript
// Dans app.config.ts
import { AuthService, ProjectPermissionsService } from '@idem/shared-auth-client';
import { AuthClientService } from './services/auth-client.service';

export const appConfig: ApplicationConfig = {
  providers: [
    AuthService,
    ProjectPermissionsService,
    AuthClientService,
  ]
};

// Dans les routes
import { projectEditGuard } from './guards/project-edit.guard';

const routes: Routes = [
  {
    path: 'teams',
    component: TeamManagementComponent
  },
  {
    path: 'project/:projectId/edit',
    component: ProjectEditComponent,
    canActivate: [projectEditGuard]
  }
];

// Dans un template
<button *appHasPermission="'canEdit'">Edit Project</button>
```

---

## 🚀 Installation et Configuration

### 1. Installer les dépendances

```bash
# À la racine
npm install

# Build les packages partagés
npm run build:shared
npm run build:shared-auth
```

### 2. Installer dans chaque app

```bash
# appgen
cd apps/appgen/apps/we-dev-client
npm install @idem/shared-auth-client

# chart
cd apps/chart
pnpm install @idem/shared-auth-client

# main-app
cd apps/main-app
npm install @idem/shared-auth-client
```

### 3. Configurer les variables d'environnement

**appgen** - `.env`:

```bash
VITE_API_URL=http://localhost:3001
```

**chart** - `.env`:

```bash
VITE_API_URL=http://localhost:3001
```

**main-app** - `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001',
};
```

---

## 📋 Utilisation dans Chaque App

### React (appgen)

#### 1. Ajouter la route Teams

```tsx
// Dans votre router
import { TeamManagement } from './components/teams/TeamManagement';

<Route path="/teams" element={<TeamManagement />} />;
```

#### 2. Protéger une action avec permissions

```tsx
import { ProjectPermissionGuard } from './components/permissions/ProjectPermissionGuard';

<ProjectPermissionGuard projectId={projectId} permission="canEdit">
  <button onClick={handleEdit}>Edit</button>
</ProjectPermissionGuard>

<ProjectPermissionGuard projectId={projectId} permission="canDelete">
  <button onClick={handleDelete}>Delete</button>
</ProjectPermissionGuard>
```

#### 3. Utiliser le hook directement

```tsx
import { useProjectPermissions } from '@idem/shared-auth-client';
import { authClient } from './lib/authClient';

function MyComponent({ projectId }) {
  const { hasPermission, loading } = useProjectPermissions(authClient, projectId);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {hasPermission('canEdit') && <button>Edit</button>}
      {hasPermission('canDeploy') && <button>Deploy</button>}
    </div>
  );
}
```

---

### Svelte (chart)

#### 1. Ajouter la route Teams

```svelte
<!-- src/routes/teams/+page.svelte -->
<script>
  import TeamManagement from '$lib/components/teams/TeamManagement.svelte';
</script>

<TeamManagement />
```

#### 2. Protéger une action avec permissions

```svelte
<script>
  import ProjectPermissionGuard from '$lib/components/permissions/ProjectPermissionGuard.svelte';

  export let projectId: string;
</script>

<ProjectPermissionGuard {projectId} permission="canEdit">
  <button on:click={handleEdit}>Edit</button>
</ProjectPermissionGuard>

<ProjectPermissionGuard {projectId} permission="canDelete">
  <button on:click={handleDelete}>Delete</button>
</ProjectPermissionGuard>
```

#### 3. Utiliser le store directement

```svelte
<script>
  import { createProjectPermissionsStore } from '@idem/shared-auth-client';
  import { authClient } from '$lib/stores/auth';

  export let projectId: string;

  $: permissionsStore = createProjectPermissionsStore(authClient, projectId);
  $: ({ permissions, loading } = $permissionsStore);
</script>

{#if loading}
  <p>Loading...</p>
{:else if permissions}
  {#if permissions.canEdit}
    <button>Edit</button>
  {/if}
  {#if permissions.canDeploy}
    <button>Deploy</button>
  {/if}
{/if}
```

---

### Angular (main-app)

#### 1. Ajouter la route Teams

```typescript
// app.routes.ts
import { TeamManagementComponent } from './components/teams/team-management.component';

export const routes: Routes = [
  {
    path: 'teams',
    component: TeamManagementComponent,
  },
];
```

#### 2. Protéger une route avec guard

```typescript
import { projectEditGuard, projectDeleteGuard } from './guards/project-edit.guard';

export const routes: Routes = [
  {
    path: 'project/:projectId/edit',
    component: ProjectEditComponent,
    canActivate: [projectEditGuard],
  },
  {
    path: 'project/:projectId/delete',
    component: ProjectDeleteComponent,
    canActivate: [projectDeleteGuard],
  },
];
```

#### 3. Utiliser la directive dans un template

```typescript
// Dans votre component
import { HasPermissionDirective } from './directives/has-permission.directive';
import { ProjectPermissionsService } from '@idem/shared-auth-client';
import { AuthClientService } from './services/auth-client.service';

@Component({
  imports: [CommonModule, HasPermissionDirective],
  // ...
})
export class MyComponent implements OnInit {
  constructor(
    private permissionsService: ProjectPermissionsService,
    private authClientService: AuthClientService
  ) {
    this.permissionsService.initialize(this.authClientService.getClient());
  }

  ngOnInit() {
    this.permissionsService.fetchPermissions(this.projectId);
  }
}
```

```html
<!-- Template -->
<button *appHasPermission="'canEdit'" (click)="edit()">Edit</button>
<button *appHasPermission="'canDelete'" (click)="delete()">Delete</button>
<button *appHasPermission="'canDeploy'" (click)="deploy()">Deploy</button>
```

---

## 🎯 Fonctionnalités Disponibles

### Gestion des Équipes

- ✅ Créer une équipe
- ✅ Voir toutes mes équipes
- ✅ Inviter des utilisateurs par email
- ✅ Voir les membres d'une équipe
- ✅ Gérer les rôles (owner, admin, member, viewer)

### Permissions sur Projets

- ✅ Vérifier si un utilisateur peut éditer
- ✅ Vérifier si un utilisateur peut supprimer
- ✅ Vérifier si un utilisateur peut déployer
- ✅ Vérifier si un utilisateur peut gérer les équipes
- ✅ Protéger des routes/composants avec des guards

### Invitations

- ✅ Inviter un utilisateur à rejoindre une équipe
- ✅ Email automatique avec identifiants
- ✅ Création automatique du compte Firebase

---

## 🔧 Personnalisation

### Changer l'URL de l'API

**React:**

```typescript
// src/lib/authClient.ts
apiBaseUrl: 'https://votre-api.com';
```

**Svelte:**

```typescript
// src/lib/stores/auth.ts
apiBaseUrl: 'https://votre-api.com';
```

**Angular:**

```typescript
// src/app/services/auth-client.service.ts
apiBaseUrl: 'https://votre-api.com';
```

### Personnaliser les styles

Tous les composants utilisent **Tailwind CSS**. Vous pouvez modifier les classes directement dans les fichiers.

---

## 📚 API Disponibles

Toutes les méthodes du `AuthClient` sont disponibles:

```typescript
// Teams
await authClient.createTeam({ name, description });
await authClient.getMyTeams();
await authClient.addTeamMember(teamId, { email, displayName, role });
await authClient.updateMemberRole(teamId, userId, role);
await authClient.removeMember(teamId, memberId);

// Invitations
await authClient.createInvitation({ email, displayName, invitationType, teamId, teamRole });
await authClient.acceptInvitation(token, tempPassword, newPassword);

// Permissions
await authClient.getProjectPermissions(projectId);
await authClient.checkProjectAccess(projectId);
await authClient.addTeamToProject(projectId, teamId, roles);
```

---

## ✅ Checklist de Déploiement

### Pour chaque application:

- [ ] Package `@idem/shared-auth-client` installé
- [ ] Variables d'environnement configurées
- [ ] Route `/teams` ajoutée
- [ ] Guards/directives de permissions implémentés
- [ ] Tests effectués
- [ ] Build réussi

---

## 🎉 C'est Prêt!

Le système d'autorisation est maintenant **complètement intégré** dans vos 3 applications:

✅ **React (appgen)** - Composants et hooks prêts à l'emploi
✅ **Svelte (chart)** - Composants et stores configurés  
✅ **Angular (main-app)** - Services, guards et directives implémentés

Il ne reste plus qu'à:

1. Installer les dépendances
2. Build les packages
3. Configurer l'API URL
4. Utiliser les composants dans vos applications

**Bon développement! 🚀**
