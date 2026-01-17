<div>
    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center justify-between">
            <div>
                <div class="flex items-center gap-3 mb-1">
                    <h1 class="text-2xl font-semibold text-white">CI/CD Pipeline</h1>
                    <span class="px-2.5 py-1 text-xs font-medium rounded {{ $pipelineEnabled ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700' }}">
                        {{ $pipelineEnabled ? 'Active' : 'Inactive' }}
                    </span>
                </div>
                <p class="text-sm text-gray-500">Build, test, and deploy your application with confidence</p>
            </div>
            
            <div class="flex gap-3">
                <button wire:click="openAddToolModal" class="px-4 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white text-sm hover:bg-gray-900 transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add Tool
                </button>
                <button wire:click="togglePipeline" class="px-4 py-2 {{ $pipelineEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-white hover:bg-gray-100 text-black' }} text-white rounded-lg text-sm font-medium transition-colors">
                    {{ $pipelineEnabled ? 'Disable Pipeline' : 'Enable Pipeline' }}
                </button>
            </div>
        </div>
    </div>

    {{-- Info Banner --}}
    @if($pipelineEnabled)
        <div class="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div class="flex-1">
                    <h3 class="text-sm font-medium text-blue-400 mb-1">Pipeline Active</h3>
                    <p class="text-xs text-blue-300/80">Every push triggers this pipeline. Stages run in order, and blocking stages prevent deployment on failure.</p>
                </div>
            </div>
        </div>
    @endif

    {{-- Pipeline Stages --}}
    <div class="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-white">Pipeline Stages ({{ count($stages) }})</h2>
            <div class="flex items-center gap-2 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                    Enabled
                </span>
                <span class="flex items-center gap-1">
                    <span class="w-2 h-2 bg-gray-600 rounded-full"></span>
                    Disabled
                </span>
            </div>
        </div>

        @if(count($stages) === 0)
            {{-- Empty State --}}
            <div class="text-center py-16">
                <div class="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">No pipeline stages yet</h3>
                <p class="text-sm text-gray-500 mb-6">Click "Add Tool" to start building your CI/CD pipeline</p>
                <button wire:click="openAddToolModal" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors">
                    Add Your First Tool
                </button>
            </div>
        @else
            {{-- Stages List --}}
            <div class="space-y-3">
                @foreach($stages as $index => $stage)
                    <div class="bg-[#151b2e] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div class="flex items-start gap-4">
                            {{-- Order Number --}}
                            <div class="flex-shrink-0 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-semibold text-gray-400">
                                {{ $index + 1 }}
                            </div>
                            
                            {{-- Stage Info --}}
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-xl">{{ $stage['icon'] }}</span>
                                    <h3 class="text-sm font-semibold text-white">{{ $stage['name'] }}</h3>
                                    <span class="px-2 py-0.5 rounded text-xs font-medium {{ $stage['enabled'] ? 'bg-green-500/10 text-green-500' : 'bg-gray-700 text-gray-400' }}">
                                        {{ $stage['enabled'] ? 'Enabled' : 'Disabled' }}
                                    </span>
                                    @if($stage['blocking'] ?? false)
                                        <span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                            Blocking
                                        </span>
                                    @endif
                                </div>
                                <p class="text-xs text-gray-400 mb-2">{{ $stage['description'] }}</p>
                                <p class="text-xs text-gray-500">Tool: <span class="text-gray-400 font-medium">{{ $stage['tool'] }}</span></p>
                            </div>
                            
                            {{-- Actions --}}
                            <div class="flex-shrink-0 flex items-center gap-1">
                                {{-- Move Up --}}
                                @if($index > 0)
                                    <button wire:click="moveStageUp('{{ $stage['id'] }}')" class="p-1.5 text-gray-400 hover:text-white transition-colors" title="Move up">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                                        </svg>
                                    </button>
                                @endif
                                
                                {{-- Move Down --}}
                                @if($index < count($stages) - 1)
                                    <button wire:click="moveStageDown('{{ $stage['id'] }}')" class="p-1.5 text-gray-400 hover:text-white transition-colors" title="Move down">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                    </button>
                                @endif
                                
                                {{-- Toggle --}}
                                <button wire:click="toggleStage('{{ $stage['id'] }}')" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {{ $stage['enabled'] ? 'bg-green-600' : 'bg-gray-700' }}" title="Toggle">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {{ $stage['enabled'] ? 'translate-x-6' : 'translate-x-1' }}"></span>
                                </button>
                                
                                {{-- Configure --}}
                                <button wire:click="configureStage('{{ $stage['id'] }}')" class="p-1.5 text-gray-400 hover:text-white transition-colors" title="Configure">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    </svg>
                                </button>
                                
                                {{-- Delete --}}
                                <button wire:click="removeStage('{{ $stage['id'] }}')" class="p-1.5 text-gray-400 hover:text-red-400 transition-colors" title="Remove">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Arrow between stages --}}
                    @if($index < count($stages) - 1)
                        <div class="flex justify-center">
                            <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                            </svg>
                        </div>
                    @endif
                @endforeach
            </div>
        @endif
    </div>

    {{-- Add Tool Modal --}}
    @if($showAddToolModal)
        <div class="fixed inset-0 z-50 overflow-y-auto">
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeAddToolModal"></div>
            
            {{-- Modal --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-5xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <h2 class="text-xl font-semibold text-white">Add Pipeline Tool</h2>
                            <p class="text-sm text-gray-400 mt-1">Choose from {{ collect($availableTools)->sum(fn($cat) => count($cat['tools'])) }} available tools</p>
                        </div>
                        <button wire:click="closeAddToolModal" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Search --}}
                    <div class="px-6 py-4 border-b border-gray-800">
                        <div class="relative">
                            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <input wire:model.live="searchQuery" type="text" placeholder="Search tools..." class="w-full pl-10 pr-4 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600">
                        </div>
                    </div>
                    
                    {{-- Tools Grid --}}
                    <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
                        @foreach($this->getFilteredTools() as $categoryKey => $category)
                            <div class="mb-6 last:mb-0">
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="text-2xl">{{ $category['icon'] }}</span>
                                    <h3 class="text-sm font-semibold text-white">{{ $category['category'] }}</h3>
                                    <span class="text-xs text-gray-500">({{ count($category['tools']) }})</span>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    @foreach($category['tools'] as $tool)
                                        <div class="bg-[#151b2e] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
                                             wire:click="addToolToStage('{{ $tool['id'] }}', '{{ $categoryKey }}')">
                                            <div class="flex items-start gap-3 mb-2">
                                                <div class="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <span class="text-xl">{{ $category['icon'] }}</span>
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <h4 class="text-sm font-semibold text-white mb-0.5">{{ $tool['name'] }}</h4>
                                                    @if($tool['auto_detect'] ?? false)
                                                        <span class="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            Auto-detect
                                                        </span>
                                                    @endif
                                                </div>
                                            </div>
                                            <p class="text-xs text-gray-400">{{ $tool['description'] }}</p>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @endforeach
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-6 py-4 border-t border-gray-800 bg-[#0f0f0f]">
                        <button wire:click="closeAddToolModal" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif

    {{-- Config Modal --}}
    @if($showConfigModal && $currentStage)
        <div class="fixed inset-0 z-50 overflow-y-auto">
            {{-- Backdrop --}}
            <div class="fixed inset-0 bg-black/80 transition-opacity" wire:click="closeConfigModal"></div>
            
            {{-- Modal --}}
            <div class="flex min-h-full items-center justify-center p-4">
                <div class="relative w-full max-w-2xl bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl">
                    {{-- Header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div>
                            <h2 class="text-xl font-semibold text-white">Configure {{ $currentStage['name'] }}</h2>
                            <p class="text-sm text-gray-400 mt-1">Tool: {{ $currentStage['tool'] }}</p>
                        </div>
                        <button wire:click="closeConfigModal" class="text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    {{-- Config Form --}}
                    <div class="px-6 py-6">
                        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                            <p class="text-xs text-yellow-300">
                                🚧 Configuration UI coming soon! For now, configurations use default values.
                            </p>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Stage Name</label>
                                <input type="text" value="{{ $currentStage['name'] }}" disabled class="w-full px-4 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white text-sm focus:outline-none">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                <textarea disabled class="w-full px-4 py-2 bg-[#151b2e] border border-gray-700 rounded-lg text-white text-sm focus:outline-none resize-none" rows="2">{{ $currentStage['description'] }}</textarea>
                            </div>
                            
                            <div class="flex items-center gap-4">
                                <label class="flex items-center gap-2">
                                    <input type="checkbox" {{ $currentStage['blocking'] ? 'checked' : '' }} disabled class="w-4 h-4 rounded bg-gray-800 border-gray-700">
                                    <span class="text-sm text-gray-300">Blocking (prevents deployment on failure)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-6 py-4 border-t border-gray-800 bg-[#0f0f0f] flex justify-end gap-3">
                        <button wire:click="closeConfigModal" class="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button wire:click="saveStageConfig" class="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-medium transition-colors">
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
