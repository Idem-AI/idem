<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="bg-muted hidden h-12 items-center justify-between gap-2 rounded-2xl p-3 md:flex">
  {@render children()}
</div>
