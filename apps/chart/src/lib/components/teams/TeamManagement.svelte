<script lang="ts">
  import { authStore } from '$lib/stores/auth';
  import TeamCard from './TeamCard.svelte';
  import CreateTeamModal from './CreateTeamModal.svelte';
  import InviteUserModal from './InviteUserModal.svelte';

  let showCreateModal = false;
  let showInviteModal: string | null = null;

  $: ({ teams, loading, error } = $authStore);

  async function handleCreateTeam(event: CustomEvent<{ name: string; description: string }>) {
    await authStore.createTeam(event.detail.name, event.detail.description);
    showCreateModal = false;
  }

  async function handleInviteUser(
    event: CustomEvent<{ email: string; displayName: string; role: string }>
  ) {
    if (showInviteModal) {
      await authStore.inviteUser(
        event.detail.email,
        event.detail.displayName,
        showInviteModal,
        event.detail.role
      );
      showInviteModal = null;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-8 flex items-center justify-between">
    <h1 class="text-3xl font-bold text-gray-900">My Teams</h1>
    <button
      on:click={() => (showCreateModal = true)}
      class="rounded-lg bg-blue-500 px-6 py-2 text-white transition-colors hover:bg-blue-600">
      + Create Team
    </button>
  </div>

  {#if loading}
    <div class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
        <p class="mt-4 text-gray-600">Loading teams...</p>
      </div>
    </div>
  {:else if error}
    <div class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <div class="mb-4 text-xl text-red-500">⚠️</div>
        <p class="text-red-600">Error: {error.message}</p>
        <button
          on:click={() => authStore.fetchTeams()}
          class="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          Retry
        </button>
      </div>
    </div>
  {:else if teams.length === 0}
    <div class="py-12 text-center">
      <p class="mb-4 text-gray-500">You don't have any teams yet.</p>
      <button
        on:click={() => (showCreateModal = true)}
        class="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600">
        Create Your First Team
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each teams as team (team.id)}
        <TeamCard {team} on:invite={() => (showInviteModal = team.id)} />
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <CreateTeamModal on:close={() => (showCreateModal = false)} on:create={handleCreateTeam} />
{/if}

{#if showInviteModal}
  <InviteUserModal
    teamId={showInviteModal}
    on:close={() => (showInviteModal = null)}
    on:invite={handleInviteUser} />
{/if}
