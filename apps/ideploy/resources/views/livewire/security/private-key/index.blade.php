<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-security.navbar />
    
    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-light text-gray-100">Private Keys</h1>
            @can('create', App\Models\PrivateKey::class)
                <x-modal-input buttonTitle="+ Add" title="New Private Key">
                    <x-slot:content>
                        <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add
                        </button>
                    </x-slot:content>
                    <livewire:security.private-key.create />
                </x-modal-input>
            @endcan
            @can('create', App\Models\PrivateKey::class)
                <x-modal-confirmation title="Confirm unused SSH Key Deletion?" buttonTitle="Delete unused SSH Keys" isErrorButton
                    submitAction="cleanupUnusedKeys" :actions="['All unused SSH keys (marked with unused) are permanently deleted.']" :confirmWithText="false" :confirmWithPassword="false" />
            @endcan
        </div>
        <p class="text-sm text-gray-400">SSH keys for server authentication.</p>
    </div>
    {{-- Keys Grid --}}
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        @forelse ($privateKeys as $key)
            @can('view', $key)
                {{-- Admin/Owner: Clickable link --}}
                <a href="{{ route('security.private-key.show', ['private_key_uuid' => data_get($key, 'uuid')]) }}" class="group block">
                    <div class="bg-[#151b2e] hover:bg-[#1a2137] border border-gray-700 hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300">
                        {{-- Header --}}
                        <div class="p-5 border-b border-gray-700/50">
                            <div class="flex items-start gap-3">
                                {{-- Key Icon --}}
                                <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                    </svg>
                                </div>
                                
                                {{-- Key Info --}}
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                                            {{ data_get($key, 'name') }}
                                        </h3>
                                        @if (!$key->isInUse())
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                <span class="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                                Unused
                                            </span>
                                        @else
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                                <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                                In Use
                                            </span>
                                        @endif
                                    </div>
                                    <p class="text-sm text-gray-400 line-clamp-2">{{ $key->description ?: 'No description' }}</p>
                                </div>
                            </div>
                        </div>
                        
                        {{-- Footer --}}
                        <div class="px-5 py-4 bg-gray-900/20">
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2 text-gray-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                    </svg>
                                    <span class="truncate">SSH Key</span>
                                </div>
                                <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </a>
            @else
                {{-- Member: Visible but not clickable --}}
                <div class="opacity-60 cursor-not-allowed" title="You don't have permission to view this private key">
                    <div class="bg-[#151b2e] border border-gray-700 rounded-xl overflow-hidden">
                        {{-- Header --}}
                        <div class="p-5 border-b border-gray-700/50">
                            <div class="flex items-start gap-3">
                                {{-- Key Icon --}}
                                <div class="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                    </svg>
                                </div>
                                
                                {{-- Key Info --}}
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="text-lg font-semibold text-gray-100 truncate">
                                            {{ data_get($key, 'name') }}
                                        </h3>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                            View Only
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-400 line-clamp-2">{{ $key->description ?: 'No description' }}</p>
                                </div>
                            </div>
                        </div>
                        
                        {{-- Footer --}}
                        <div class="px-5 py-4 bg-gray-900/20">
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2 text-gray-500">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                    </svg>
                                    <span class="truncate">SSH Key</span>
                                </div>
                                <svg class="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            @endcan
        @empty
            {{-- Empty State --}}
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No private keys found</h3>
                <p class="text-sm text-gray-500 mb-4">Add an SSH key to connect to servers</p>
                @can('create', App\Models\PrivateKey::class)
                    <x-modal-input buttonTitle="Add Private Key" title="New Private Key">
                        <livewire:security.private-key.create />
                    </x-modal-input>
                @endcan
            </div>
        @endforelse
    </div>
</div>
