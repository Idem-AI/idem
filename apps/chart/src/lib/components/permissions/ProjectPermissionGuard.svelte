<script lang="ts">
  import { createProjectPermissionsStore, type RolePermissions } from '@idem/shared-auth-client';
  import { authClient } from '$lib/stores/auth';

  export let projectId: string;
  export let permission: keyof RolePermissions;

  $: permissionsStore = createProjectPermissionsStore(authClient, projectId);
  $: ({ permissions, loading } = $permissionsStore);
  $: hasPermission = permissions ? permissions[permission] : false;
</script>

{#if !loading && hasPermission}
  <slot />
{:else if !loading}
  <slot name="fallback" />
{/if}
