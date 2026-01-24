<script lang="ts">
  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<div class="flex flex-1 overflow-hidden {className}">
  <div class="flex h-full w-full animate-pulse">
    <!-- Left panel skeleton -->
    <div class="hidden w-[30%] min-w-[15%] p-6 pt-0 md:block">
      <div class="flex h-full flex-col gap-6">
        <!-- Editor card skeleton -->
        <div class="bg-card rounded-lg border">
          <div class="flex items-center justify-between border-b p-4">
            <div class="flex space-x-2">
              <div class="bg-muted h-6 w-16 rounded"></div>
              <div class="bg-muted h-6 w-16 rounded"></div>
            </div>
            <div class="bg-muted h-6 w-6 rounded"></div>
          </div>
          <div class="space-y-2 p-4">
            <div class="bg-muted h-4 w-3/4 rounded"></div>
            <div class="bg-muted h-4 w-1/2 rounded"></div>
            <div class="bg-muted h-4 w-5/6 rounded"></div>
            <div class="bg-muted h-4 w-2/3 rounded"></div>
          </div>
        </div>

        <!-- Diagram viewer skeleton -->
        <div class="bg-card rounded-lg border p-4">
          <div class="bg-muted mb-4 h-6 w-32 rounded"></div>
          <div class="space-y-3">
            <div class="bg-muted h-8 rounded"></div>
            <div class="bg-muted h-8 rounded"></div>
            <div class="bg-muted h-8 rounded"></div>
          </div>
        </div>

        <!-- Description area skeleton -->
        <div class="rounded-2xl bg-gray-700 px-4 py-2">
          <div class="mb-2 h-6 rounded bg-gray-600"></div>
          <div class="flex items-center justify-between">
            <div class="flex space-x-2">
              <div class="h-6 w-6 rounded bg-gray-600"></div>
              <div class="h-6 w-6 rounded bg-gray-600"></div>
            </div>
            <div class="h-6 w-16 rounded bg-gray-600"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Resizer skeleton -->
    <div class="bg-border w-1"></div>

    <!-- Right panel skeleton -->
    <div class="flex-1 p-6 pt-0">
      <div class="bg-card h-full rounded-lg border">
        <div class="flex items-center justify-between border-b p-4">
          <div class="flex items-center space-x-4">
            <div class="bg-muted h-6 w-24 rounded"></div>
            <div class="flex space-x-2">
              <div class="bg-muted h-6 w-6 rounded"></div>
              <div class="bg-muted h-6 w-6 rounded"></div>
              <div class="bg-muted h-6 w-6 rounded"></div>
            </div>
          </div>
          <div class="flex space-x-2">
            <div class="bg-muted h-6 w-16 rounded"></div>
            <div class="bg-muted h-6 w-16 rounded"></div>
          </div>
        </div>
        <div class="h-full p-4">
          <div class="bg-muted h-full animate-pulse rounded"></div>
        </div>
      </div>
    </div>
  </div>
</div>
