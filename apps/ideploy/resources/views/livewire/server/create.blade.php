<div class="w-full">
    {{-- IDEM: Server Quota Badge --}}
    <div class="mb-6 p-4 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg">
        <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
            <div class="flex-1">
                <h3 class="text-sm font-semibold text-white mb-3">
                    Your Server Quota
                </h3>
                @livewire('idem.quota-badge', ['type' => 'servers', 'showDetails' => true])
            </div>
        </div>
    </div>

    @if($limit_reached)
        <div class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div class="flex items-start gap-3">
                <svg class="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <div>
                    <h3 class="text-sm font-semibold text-red-400 mb-1">
                        Server Limit Reached
                    </h3>
                    <p class="text-sm text-gray-300">
                        You've reached your server limit. 
                        <a href="{{ route('idem.subscription') }}" class="text-[#4F46E5] hover:text-[#6366F1] font-medium underline">
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

                <div class="border-t border-gray-800/50 my-4"></div>
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
                                <span class="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                                    Pro Plan Required
                                </span>
                            </div>
                            <div class="box-description">
                                Cloud provider integration is available on Pro and Enterprise plans
                            </div>
                            <a href="{{ route('idem.subscription') }}" class="mt-2 text-sm text-[#4F46E5] hover:text-[#6366F1] hover:underline">
                                ⬆️ Upgrade to Pro to unlock this feature
                            </a>
                        </div>
                    </div>
                </div>

                <div class="border-t border-gray-800/50 my-4"></div>
            @endif
        @endcan

        <div>
            <h3 class="text-lg font-semibold text-white mb-4">Add Server by IP Address</h3>
            <livewire:server.new.by-ip :private_keys="$private_keys" :limit_reached="$limit_reached" />
        </div>
    </div>
</div>
