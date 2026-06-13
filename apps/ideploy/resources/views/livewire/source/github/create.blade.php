@can('createAnyResource')
    <div class="w-full">

        {{-- Info Banner --}}
        <div class="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-sm text-gray-300">
                    This is required if you would like to get full integration (commit / pull request deployments, etc) with GitHub.
                </p>
            </div>
        </div>

        {{-- Form Card --}}
        <form wire:submit='createGitHubApp'
              class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">

            {{-- Name + Organization --}}
            <div class="flex gap-3">
                <x-forms.input id="name" label="Name" required />
                <x-forms.input
                    helper="If empty, your GitHub user will be used."
                    placeholder="If empty, your GitHub user will be used."
                    id="organization"
                    label="Organization (on GitHub)" />
            </div>

            @if (!isCloud())
                {{-- System Wide checkbox --}}
                <div class="flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] border border-gray-700/40 rounded-lg w-fit">
                    <x-forms.checkbox id="is_system_wide" label="System Wide"
                        helper="If checked, this GitHub App will be available for everyone in this Ideploy instance." />
                </div>
            @endif

            {{-- Self-hosted / Enterprise accordion --}}
            <div x-data="{
                    open: false,
                    toggle() { this.open = !this.open }
                }"
                 class="rounded-lg border border-gray-700/40 overflow-hidden">

                <button type="button"
                        @click="toggle()"
                        class="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.04] transition-colors duration-150">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                        Self-hosted / Enterprise GitHub
                    </div>
                    <svg class="w-4 h-4 text-gray-500 transition-transform duration-200"
                         :class="open ? 'rotate-180' : ''"
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>

                <div x-show="open"
                     x-transition:enter="transition ease-out duration-150"
                     x-transition:enter-start="opacity-0 -translate-y-1"
                     x-transition:enter-end="opacity-100 translate-y-0"
                     x-transition:leave="transition ease-in duration-100"
                     x-transition:leave-start="opacity-100"
                     x-transition:leave-end="opacity-0"
                     x-cloak
                     class="px-4 pb-4 pt-2 border-t border-gray-700/40">
                    <div class="flex flex-col gap-3 opacity-80">
                        <div class="flex gap-3">
                            <x-forms.input id="html_url" label="HTML Url" required />
                            <x-forms.input id="api_url" label="API Url" required />
                        </div>
                        <div class="flex gap-3">
                            <x-forms.input id="custom_user" label="Custom Git User" required />
                            <x-forms.input id="custom_port" type="number" label="Custom Git Port" required />
                        </div>
                    </div>
                </div>
            </div>

            {{-- Submit --}}
            <div class="flex justify-end pt-2">
                <button type="submit" class="inner-button">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Continue
                </button>
            </div>
        </form>
    </div>

@else
    <x-callout type="warning" title="Permission Required">
        You don't have permission to create new GitHub Apps. Please contact your team administrator for access.
    </x-callout>
@endcan
