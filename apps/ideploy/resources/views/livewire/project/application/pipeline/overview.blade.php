<div class="space-y-6">
    {{-- Header --}}
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-white mb-1">CI/CD Pipeline</h1>
            <p class="text-sm text-gray-400">Build, test, and deploy automatically</p>
        </div>
        <div class="flex gap-3">
            @if($pipelineEnabled)
                <button wire:click="runPipeline" 
                        class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Run Pipeline
                </button>
                
                <div x-data="{ copied: false }">
                    <button @click="navigator.clipboard.writeText('{{ $this->getWebhookUrl() }}'); copied = true; setTimeout(() => copied = false, 2000)" 
                            class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <span x-text="copied ? 'Copied!' : 'Webhook URL'"></span>
                    </button>
                </div>
            @endif
            
            <button wire:click="togglePipeline" 
                    class="px-4 py-2 rounded-lg text-sm font-medium {{ $pipelineEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700' }} text-white">
                {{ $pipelineEnabled ? 'Disable' : 'Enable' }} Pipeline
            </button>
        </div>
    </div>

    {{-- Your Pipeline --}}
    <div class="bg-[#0f1724] border border-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Your Pipeline ({{ count(array_filter($stages, fn($s) => $s['enabled'])) }} active)</h2>
            <span class="px-3 py-1 rounded-full text-xs font-medium {{ $pipelineEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400' }}">
                {{ $pipelineEnabled ? 'Active' : 'Inactive' }}
            </span>
        </div>

        @if(count($stages) === 0)
            <div class="text-center py-12">
                <div class="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                </div>
                <p class="text-gray-400 mb-4">No stages configured</p>
                <p class="text-sm text-gray-500">Add tools from the library below to build your pipeline</p>
            </div>
        @else
            <div class="space-y-2">
                @foreach($stages as $i => $stage)
                <div class="bg-[#151b2e] border border-gray-800 rounded-lg p-4 flex items-center gap-4">
                    <div class="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold text-gray-400">
                        {{ $i + 1 }}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-semibold text-white">{{ $stage['name'] }}</span>
                            <span class="text-xs px-2 py-0.5 rounded {{ $stage['enabled'] ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400' }}">
                                {{ $stage['enabled'] ? 'ON' : 'OFF' }}
                            </span>
                            @if($stage['blocking'] ?? false)
                            <span class="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Blocking</span>
                            @endif
                        </div>
                        <p class="text-xs text-gray-400">{{ $stage['description'] }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button wire:click="toggleStage('{{ $stage['id'] }}')" class="p-2 hover:bg-gray-700 rounded" title="Toggle">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                        <button wire:click="configureStage('{{ $stage['id'] }}')" class="p-2 hover:bg-gray-700 rounded" title="Configure">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                        </button>
                        <button wire:click="removeStage('{{ $stage['id'] }}')" class="p-2 hover:bg-red-900/50 rounded" title="Remove">
                            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
                @if(!$loop->last)
                <div class="flex justify-center">
                    <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                    </svg>
                </div>
                @endif
                @endforeach
            </div>
        @endif
    </div>

    {{-- Tools Library --}}
    <div class="bg-[#0f1724] border border-gray-800 rounded-lg p-6">
        <div class="mb-6">
            <h2 class="text-lg font-semibold text-white mb-2">Available Tools</h2>
            <p class="text-sm text-gray-400">Click on a tool to add it to your pipeline</p>
        </div>

        <div class="space-y-6">
            @foreach($availableTools as $categoryKey => $category)
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-xl">{{ $category['icon'] }}</span>
                    <h3 class="text-sm font-semibold text-white">{{ $category['category'] }}</h3>
                    <span class="text-xs text-gray-500">({{ count($category['tools']) }})</span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    @foreach($category['tools'] as $tool)
                    <button wire:click="addToolToStage('{{ $tool['id'] }}', '{{ $categoryKey }}')" 
                            class="bg-[#151b2e] border-2 border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-all group text-left">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-xl">{{ $category['icon'] }}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-semibold text-white truncate">{{ $tool['name'] }}</h4>
                                @if($tool['auto_detect'] ?? false)
                                <span class="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Auto</span>
                                @endif
                            </div>
                        </div>
                        <p class="text-xs text-gray-400 line-clamp-2">{{ $tool['description'] }}</p>
                    </button>
                    @endforeach
                </div>
            </div>
            @endforeach
        </div>
    </div>
</div>
