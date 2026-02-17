<div>
    {{-- Header Idem Style - Danger --}}
    <div class="mb-8">
        <div class="flex items-center gap-3 mb-3">
            <div class="icon-container" style="background: linear-gradient(135deg, rgba(211, 64, 83, 0.2), rgba(211, 64, 83, 0.1)); border-color: rgba(211, 64, 83, 0.3);">
                <svg class="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-danger">
                    <span class="i-underline" style="text-decoration-color: oklch(0.58 0.2 25);">Danger Zone</span>
                </h2>
                <p class="text-sm text-danger opacity-70 mt-1">⚠️ Woah. I hope you know what you are doing.</p>
            </div>
        </div>
    </div>

    {{-- Warning Card --}}
    <div class="alert-box error mb-6">
        <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <div>
            <h4 class="font-semibold mb-1">⚠️ Destructive Actions</h4>
            <p class="text-sm opacity-90">The actions below are irreversible. Please proceed with extreme caution.</p>
        </div>
    </div>

    {{-- Delete Resource Section --}}
    <div class="section-card" style="border: 2px solid rgba(211, 64, 83, 0.3);">
        <div class="flex items-center gap-2 mb-4">
            <span class="category-badge" style="background: linear-gradient(135deg, rgba(211, 64, 83, 0.2), rgba(211, 64, 83, 0.1)); border-color: rgba(211, 64, 83, 0.3); color: var(--color-error);">Danger</span>
            <h3 class="text-lg font-semibold text-danger flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Delete Resource
            </h3>
        </div>
        <p class="text-sm text-light opacity-70 mb-4">This will stop your containers, delete all related data, etc. <span class="font-semibold text-danger">⚠️ Beware! There is no coming back!</span></p>

        @if ($canDelete)
            <x-modal-confirmation title="Confirm Resource Deletion?" buttonTitle="Delete" isErrorButton submitAction="delete"
                buttonTitle="Delete" :checkboxes="$checkboxes" :actions="['Permanently delete all containers of this resource.']" confirmationText="{{ $resourceName }}"
                confirmationLabel="Please confirm the execution of the actions by entering the Resource Name below"
                shortConfirmationLabel="Resource Name" />
        @else
            <x-info-card type="danger" title="Insufficient Permissions">
                <x-slot:icon>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                    </svg>
                </x-slot:icon>
                You don't have permission to delete this resource. Contact your team administrator for access.
            </x-info-card>
        @endif
    </div>
</div>
