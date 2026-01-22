<div x-data x-init="$nextTick(() => { if ($refs.autofocusInput) $refs.autofocusInput.focus(); })">
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <h1 class="text-2xl font-bold text-white mb-2">Create a new Application</h1>
        <p class="text-sm text-gray-400">Deploy an existing Docker Image from any Registry</p>
    </div>
    
    <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit="submit">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-lg font-semibold text-white">Docker Image</h2>
            <button type="submit" class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Save
            </button>
        </div>
        <div class="space-y-4">
            <x-forms.input id="imageName" label="Image Name" placeholder="nginx, docker.io/nginx:latest, ghcr.io/user/app:v1.2.3, or nginx:stable@sha256:abc123..."
                helper="Enter the Docker image name with optional registry. You can also paste a complete reference like 'nginx:stable@sha256:abc123...' and the fields below will be auto-filled."
                required autofocus />
            <div class="relative grid grid-cols-1 gap-4 md:grid-cols-2">
                <x-forms.input id="imageTag" label="Tag (optional)" placeholder="latest"
                    helper="Enter a tag like 'latest' or 'v1.2.3'. Leave empty if using SHA256." />
                <div
                    class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center z-10">
                    <div
                        class="px-2 py-1 bg-white dark:bg-coolgray-100 border border-neutral-300 dark:border-coolgray-300 rounded text-xs font-bold text-neutral-500 dark:text-neutral-400">
                        OR
                    </div>
                </div>
                <x-forms.input id="imageSha256" label="SHA256 Digest (optional)"
                    placeholder="59e02939b1bf39f16c93138a28727aec520bb916da021180ae502c61626b3cf0"
                    helper="Enter only the 64-character hex digest (without 'sha256:' prefix)" />
            </div>
        </div>
    </form>
</div>
