<div class="w-full">
    {{-- IDEM: Server Quota Badge --}}
    <div class="mb-6 p-4 bg-blue-50 dark:bg-coolgray-100 rounded-lg border border-blue-200 dark:border-coolgray-200">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            🖥️ Your Server Quota
        </h3>
        @livewire('idem.quota-badge', ['type' => 'servers', 'showDetails' => true])
    </div>

    @if($limit_reached)
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div class="flex">
                <svg class="h-5 w-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
                        Server Limit Reached
                    </h3>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300">
                        You've reached your server limit. 
                        <a href="{{ route('idem.subscription') }}" class="font-medium underline hover:text-red-600">
                            Upgrade your plan
                        </a> to add more servers.
                    </p>
                </div>
            </div>
        </div>
    @endif

    <div class="flex flex-col gap-4">
        @can('viewAny', App\Models\CloudProviderToken::class)
            @if($can_use_cloud_providers)
                <div>
                    <x-modal-input title="Connect a Hetzner Server">
                        <x-slot:content>
                            <div class="relative gap-2 cursor-pointer box group">
                                <div class="flex items-center gap-4 mx-6">
                                    <svg class="w-10 h-10 flex-shrink-0" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="200" height="200" fill="#D50C2D" rx="8" />
                                        <path d="M40 40 H60 V90 H140 V40 H160 V160 H140 V110 H60 V160 H40 Z" fill="white" />
                                    </svg>
                                    <div class="flex flex-col justify-center flex-1">
                                        <div class="box-title">Connect a Hetzner Server</div>
                                        <div class="box-description">
                                            Deploy servers directly from your Hetzner Cloud account
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </x-slot:content>
                        <livewire:server.new.by-hetzner :private_keys="$private_keys" :limit_reached="$limit_reached" />
                    </x-modal-input>
                </div>

                <div class="border-t dark:border-coolgray-300 my-4"></div>
            @else
                {{-- Message pour plans Free et Basic --}}
                <div class="relative gap-2 box opacity-60">
                    <div class="flex items-center gap-4 mx-6">
                        <svg class="w-10 h-10 flex-shrink-0" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                            <rect width="200" height="200" fill="#D50C2D" rx="8" />
                            <path d="M40 40 H60 V90 H140 V40 H160 V160 H140 V110 H60 V160 H40 Z" fill="white" />
                        </svg>
                        <div class="flex flex-col justify-center flex-1">
                            <div class="flex items-center gap-2">
                                <div class="box-title">Connect a Hetzner Server</div>
                                <span class="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                    Pro Plan Required
                                </span>
                            </div>
                            <div class="box-description">
                                Cloud provider integration is available on Pro and Enterprise plans
                            </div>
                            <a href="{{ route('idem.subscription') }}" class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                ⬆️ Upgrade to Pro to unlock this feature
                            </a>
                        </div>
                    </div>
                </div>

                <div class="border-t dark:border-coolgray-300 my-4"></div>
            @endif
        @endcan

        <div>
            <h3 class="pb-2">Add Server by IP Address</h3>
            <livewire:server.new.by-ip :private_keys="$private_keys" :limit_reached="$limit_reached" />
        </div>
    </div>
</div>
