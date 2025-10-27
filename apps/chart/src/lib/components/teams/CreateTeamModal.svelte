<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let name = '';
  let description = '';
  let loading = false;

  async function handleSubmit() {
    loading = true;
    try {
      dispatch('create', { name, description });
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team. Please try again.');
    } finally {
      loading = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
  <div class="w-full max-w-md rounded-lg bg-white p-6">
    <h2 class="mb-4 text-2xl font-bold">Create Team</h2>
    <form on:submit|preventDefault={handleSubmit}>
      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700"> Team Name * </label>
        <input
          type="text"
          bind:value={name}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter team name"
          required />
      </div>

      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-gray-700"> Description </label>
        <textarea
          bind:value={description}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter team description"
          rows="3" />
      </div>

      <div class="flex gap-3">
        <button
          type="button"
          on:click={() => dispatch('close')}
          class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          disabled={loading}>
          Cancel
        </button>
        <button
          type="submit"
          class="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          disabled={loading}>
          {loading ? 'Creating...' : 'Create Team'}
        </button>
      </div>
    </form>
  </div>
</div>
