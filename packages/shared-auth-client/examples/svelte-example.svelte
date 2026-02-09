<!--
  Exemple d'intégration Svelte pour chart
  
  Installation:
  npm install @idem/shared-auth-client firebase
-->

<script lang="ts">
  /**
   * 1. Créer le store dans un fichier séparé (stores/auth.ts)
   */
  
  // stores/auth.ts
  import { AuthClient } from '@idem/shared-auth-client';
  import { createAuthStore, createProjectPermissionsStore } from '@idem/shared-auth-client';
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
    }
  });

  export const authStore = createAuthStore(authClient);
  export { authClient };
</script>

<!-- 2. Composant de gestion des équipes -->
<script lang="ts">
  import { authStore, authClient } from './stores/auth';
  import { createProjectPermissionsStore } from '@idem/shared-auth-client';
  
  let showCreateModal = false;
  let showInviteModal: string | null = null;
  
  $: ({ teams, loading, error } = $authStore);
  
  async function handleCreateTeam(name: string, description: string) {
    await authStore.createTeam(name, description);
    showCreateModal = false;
  }
  
  async function handleInviteUser(email: string, displayName: string, teamId: string, role: string) {
    await authStore.inviteUser(email, displayName, teamId, role);
    showInviteModal = null;
  }
</script>

<div class="team-management">
  <div class="header">
    <h1>My Teams</h1>
    <button on:click={() => showCreateModal = true}>
      Create Team
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading teams...</div>
  {:else if error}
    <div class="error">Error: {error.message}</div>
  {:else}
    <div class="teams-grid">
      {#each teams as team (team.id)}
        <div class="team-card">
          <h2>{team.name}</h2>
          <p>{team.description || ''}</p>
          <p class="members-count">
            {team.members.length} member{team.members.length !== 1 ? 's' : ''}
          </p>
          
          <div class="members-list">
            {#each team.members as member (member.userId)}
              <div class="member">
                <span>{member.displayName}</span>
                <span class="role">{member.role}</span>
              </div>
            {/each}
          </div>

          <button on:click={() => showInviteModal = team.id}>
            Invite User
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCreateModal}
    <CreateTeamModal
      on:close={() => showCreateModal = false}
      on:create={(e) => handleCreateTeam(e.detail.name, e.detail.description)}
    />
  {/if}

  {#if showInviteModal}
    <InviteUserModal
      teamId={showInviteModal}
      on:close={() => showInviteModal = null}
      on:invite={(e) => handleInviteUser(
        e.detail.email,
        e.detail.displayName,
        showInviteModal,
        e.detail.role
      )}
    />
  {/if}
</div>

<!-- 3. Composant avec vérification de permissions -->
<script lang="ts">
  export let projectId: string;
  
  $: permissionsStore = createProjectPermissionsStore(authClient, projectId);
  $: ({ permissions, loading: permLoading } = $permissionsStore);
</script>

<div class="project-actions">
  {#if permLoading}
    <div>Loading permissions...</div>
  {:else if permissions}
    {#if permissions.canEdit}
      <button on:click={() => console.log('Edit project')}>
        Edit Project
      </button>
    {/if}

    {#if permissions.canDeploy}
      <button on:click={() => console.log('Deploy project')}>
        Deploy
      </button>
    {/if}

    {#if permissions.canDelete}
      <button on:click={() => console.log('Delete project')} class="danger">
        Delete Project
      </button>
    {/if}

    {#if permissions.canManageTeams}
      <button on:click={() => console.log('Manage teams')}>
        Manage Teams
      </button>
    {/if}
  {:else}
    <div class="no-access">
      You don't have access to this project
    </div>
  {/if}
</div>

<style>
  .team-management {
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .teams-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .team-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    background: white;
  }

  .team-card h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
  }

  .members-count {
    color: #666;
    font-size: 0.875rem;
    margin: 0.5rem 0;
  }

  .members-list {
    margin: 1rem 0;
  }

  .member {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .role {
    color: #666;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: #007bff;
    color: white;
    cursor: pointer;
  }

  button:hover {
    background: #0056b3;
  }

  button.danger {
    background: #dc3545;
  }

  button.danger:hover {
    background: #c82333;
  }

  .loading, .error, .no-access {
    padding: 2rem;
    text-align: center;
  }

  .error {
    color: #dc3545;
  }
</style>
