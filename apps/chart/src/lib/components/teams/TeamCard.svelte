<script lang="ts">
  import type { TeamModel } from '@idem/shared-auth-client';
  import { createEventDispatcher } from 'svelte';

  export let team: TeamModel;

  const dispatch = createEventDispatcher();
</script>

<div class="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
  <div class="mb-4 flex items-start justify-between">
    <h2 class="text-xl font-semibold text-gray-900">{team.name}</h2>
    <span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
      {team.members.length}
      {team.members.length === 1 ? 'member' : 'members'}
    </span>
  </div>

  {#if team.description}
    <p class="mb-4 text-sm text-gray-600">{team.description}</p>
  {/if}

  <div class="mb-4 space-y-2">
    <h3 class="text-sm font-medium text-gray-700">Members:</h3>
    <div class="space-y-1">
      {#each team.members.slice(0, 3) as member (member.userId)}
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-700">{member.displayName}</span>
          <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
            {member.role}
          </span>
        </div>
      {/each}
      {#if team.members.length > 3}
        <p class="text-xs text-gray-500">
          +{team.members.length - 3} more
        </p>
      {/if}
    </div>
  </div>

  <button
    on:click={() => dispatch('invite')}
    class="w-full rounded bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100">
    Invite User
  </button>
</div>
