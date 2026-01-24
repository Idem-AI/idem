<x-layout>
    <x-slot:title>
        Sources | Coolify
    </x-slot>
    
    <div class="min-h-screen bg-[#0a0e1a] text-white p-6">
        {{-- Header --}}
        <div class="mb-6">
            <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-light text-gray-100">Sources</h1>
                @can('createAnyResource')
                    <x-modal-input buttonTitle="+ Add" title="New GitHub App" :closeOutside="false">
                        <x-slot:content>
                            <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                </svg>
                                Add
                            </button>
                        </x-slot:content>
                        <livewire:source.github.create />
                    </x-modal-input>
                @endcan
            </div>
            <p class="text-sm text-gray-400">Git sources for your applications.</p>
        </div>

        {{-- Sources Grid --}}
        <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            @forelse ($sources as $source)
                @if ($source->getMorphClass() === 'App\Models\GithubApp')
                    <a href="{{ route('source.github.show', ['github_app_uuid' => data_get($source, 'uuid')]) }}" class="group block">
                        <div @class([
                            'bg-[#151b2e] hover:bg-[#1a2137] border hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300',
                            'border-red-500' => is_null($source->app_id),
                            'border-gray-700' => !is_null($source->app_id),
                        ])>
                            {{-- Header --}}
                            <div class="p-5 border-b border-gray-700/50">
                                <div class="flex items-start gap-3">
                                    {{-- GitHub Icon --}}
                                    <div @class([
                                        'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg',
                                        'bg-gradient-to-br from-gray-700 to-gray-900' => !is_null($source->app_id),
                                        'bg-gradient-to-br from-red-500 to-rose-600' => is_null($source->app_id),
                                    ])>
                                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                        </svg>
                                    </div>
                                    
                                    {{-- Source Info --}}
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1">
                                            <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                                                {{ $source->name }}
                                            </h3>
                                            @if (is_null($source->app_id))
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                    Not Configured
                                                </span>
                                            @else
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                                    Active
                                                </span>
                                            @endif
                                        </div>
                                        @if (is_null($source->app_id))
                                            <p class="text-sm text-red-400">Configuration is not finished</p>
                                        @else
                                            @if ($source->organization)
                                                <p class="text-sm text-gray-400 truncate">Organization: {{ $source->organization }}</p>
                                            @else
                                                <p class="text-sm text-gray-400">Personal account</p>
                                            @endif
                                        @endif
                                    </div>
                                </div>
                            </div>
                            
                            {{-- Footer --}}
                            <div class="px-5 py-4 bg-gray-900/20">
                                <div class="flex items-center justify-between text-xs">
                                    <div class="flex items-center gap-2 text-gray-400">
                                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                        </svg>
                                        <span class="truncate">GitHub App</span>
                                    </div>
                                    <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </a>
                @endif
            @empty
                {{-- Empty State --}}
                <div class="col-span-full flex flex-col items-center justify-center py-16">
                    <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-10 h-10 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-300 mb-2">No sources found</h3>
                    <p class="text-sm text-gray-500 mb-4">Add a GitHub App to connect your repositories</p>
                    @can('createAnyResource')
                        <x-modal-input buttonTitle="Add GitHub App" title="New GitHub App" :closeOutside="false">
                            <livewire:source.github.create />
                        </x-modal-input>
                    @endcan
                </div>
            @endforelse
        </div>
    </div>
</x-layout>
