<form wire:submit='submit'>
    <div class="flex items-center justify-between mb-4">
        <div>
            <h2 class="text-xl font-bold text-light">Preview Deployments</h2>
            <p class="text-sm text-light opacity-70 mt-1">Preview Deployments based on pull requests are here</p>
        </div>
        @can('update', $application)
            <div class="flex gap-2">
                <button type="submit" class="inner-button">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                </button>
                <button type="button" wire:click="resetToDefault" class="outer-button">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset to Default
                </button>
            </div>
        @endcan
    </div>
    <div class="flex flex-col gap-2 pb-4">
        <x-forms.input id="previewUrlTemplate" label="Preview URL Template"
            helper="Templates:<br/><span class='text-helper'>@@{{ random }}</span> to generate random sub-domain each time a PR is deployed<br/><span class='text-helper'>@@{{ pr_id }}</span> to use pull request ID as sub-domain or <span class='text-helper'>@@{{ domain }}</span> to replace the domain name with the application's domain name." canGate="update" :canResource="$application" />
        @if ($previewUrlTemplate)
            <div class="">Domain Preview: {{ $previewUrlTemplate }}</div>
        @endif
    </div>
</form>
