<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let teamId: string;

  const dispatch = createEventDispatcher();

  let email = '';
  let displayName = '';
  let role = 'member';
  let loading = false;

  async function handleSubmit() {
    loading = true;
    try {
      dispatch('invite', { email, displayName, role });
      alert('Invitation sent successfully!');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      loading = false;
    }
  }
</script>

<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
  <div class="w-full max-w-md rounded-lg bg-white p-6">
    <h2 class="mb-4 text-2xl font-bold">Invite User</h2>
    <form on:submit|preventDefault={handleSubmit}>
      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700"> Email * </label>
        <input
          type="email"
          bind:value={email}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="user@example.com"
          required />
      </div>

      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700"> Display Name * </label>
        <input
          type="text"
          bind:value={displayName}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="John Doe"
          required />
      </div>

      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-gray-700"> Role * </label>
        <select
          bind:value={role}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
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
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>
    </form>
  </div>
</div>
