<div>
    {{-- Header --}}
    <div class="mb-8">
        <div class="flex items-center gap-3 mb-1">
            <div class="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-white">Danger Zone</h2>
                <p class="text-sm text-red-400/70 mt-0.5">Irreversible and destructive actions</p>
            </div>
        </div>
    </div>

    {{-- Warning Banner --}}
    <div class="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl mb-6">
        <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <div>
            <p class="text-sm font-semibold text-red-300 mb-0.5">Actions in this section are permanent</p>
            <p class="text-xs text-red-400/70">These operations cannot be undone. Please read carefully before proceeding.</p>
        </div>
    </div>

    {{-- Delete Resource Card --}}
    <div class="rounded-2xl border border-red-900/40 bg-gradient-to-b from-red-950/20 to-transparent overflow-hidden">
        {{-- Card Header --}}
        <div class="flex items-start justify-between gap-4 p-6 border-b border-red-900/30">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-bold text-white mb-1">Delete this resource</h3>
                    <p class="text-sm text-gray-400">
                        Permanently deletes all containers, volumes and associated data for
                        <strong class="text-red-300">{{ $resourceName }}</strong>.
                        This action <strong class="text-red-400">cannot be undone</strong>.
                    </p>
                </div>
            </div>
        </div>

        {{-- Card Footer with action --}}
        <div class="px-6 py-4 bg-red-950/10">
            @if ($canDelete)
                <div class="flex items-center justify-between gap-4">
                    <ul class="text-xs text-red-400/70 space-y-1 list-disc list-inside">
                        <li>All running containers will be stopped</li>
                        <li>All persistent data and volumes will be removed</li>
                        <li>Deployment history will be lost</li>
                    </ul>
                    <div class="flex-shrink-0">
                        <x-modal-confirmation title="Confirm Resource Deletion?" buttonTitle="Delete Resource" isErrorButton submitAction="delete"
                            :checkboxes="$checkboxes" :actions="['Permanently delete all containers of this resource.']" confirmationText="{{ $resourceName }}"
                            confirmationLabel="Please confirm the execution of the actions by entering the Resource Name below"
                            shortConfirmationLabel="Resource Name" />
                    </div>
                </div>
            @else
                <div class="flex items-center gap-3 py-1">
                    <div class="w-8 h-8 rounded-lg bg-gray-800/60 border border-gray-700/40 flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-400">Insufficient permissions</p>
                        <p class="text-xs text-gray-500">Contact your team administrator to delete this resource.</p>
                    </div>
                </div>
            @endif
        </div>
    </div>
</div>
