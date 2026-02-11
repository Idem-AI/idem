<!-- Step 2: Trigger Configuration -->
<div class="space-y-8">
    
    <!-- Trigger Mode Selection -->
    <div class="space-y-4">
        <h3 class="font-bold text-slate-900 mb-4">🔔 Comment déclencher le pipeline?</h3>
        
        <div class="space-y-3">
            <!-- Webhook Mode -->
            <div
                wire:click="setTriggerMode('webhook')"
                class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                    {{ $this->triggerMode === 'webhook'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }}"
            >
                <div class="flex items-start gap-3">
                    <div class="text-2xl mt-1">🪝</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-900">Automatique (Webhook GitHub)</h4>
                        <p class="text-slate-600 text-sm mt-1">
                            Lance le pipeline automatiquement à chaque push
                        </p>
                        <p class="text-slate-500 text-xs mt-2">
                            ✓ Recommandé • ✓ Plus rapide • ✓ Intégration GitHub
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Manual Mode -->
            <div
                wire:click="setTriggerMode('manual')"
                class="cursor-pointer p-4 border-2 rounded-lg transition-all duration-200
                    {{ $this->triggerMode === 'manual'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }}"
            >
                <div class="flex items-start gap-3">
                    <div class="text-2xl mt-1">🖱️</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-900">Manuel</h4>
                        <p class="text-slate-600 text-sm mt-1">
                            Lancez le pipeline manuellement depuis le dashboard
                        </p>
                        <p class="text-slate-500 text-xs mt-2">
                            ✓ Total control • ✓ Sans surprise • ✓ Bon pour tests
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Branch Configuration (Webhook Mode Only) -->
    @if ($this->triggerMode === 'webhook')
        <div class="space-y-4 pt-6 border-t border-slate-200">
            <h3 class="font-bold text-slate-900">🌿 Sur quelles branches?</h3>
            
            <!-- Quick Branch Selection -->
            <div class="space-y-2">
                <p class="text-sm text-slate-600">Branches courantes:</p>
                <div class="flex flex-wrap gap-2">
                    @foreach (['main', 'develop', 'production'] as $branch)
                        <button
                            wire:click="toggleBranch('{{ $branch }}')"
                            class="px-3 py-2 border-2 rounded-lg font-medium text-sm transition-all duration-200
                                {{ in_array($branch, $this->selectedBranches)
                                    ? 'border-blue-600 bg-blue-100 text-blue-900'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
                                }}"
                        >
                            {{ $branch }}
                        </button>
                    @endforeach
                </div>
            </div>
            
            <!-- Custom Branches -->
            <div class="space-y-2 pt-4">
                <label class="block text-sm font-medium text-slate-900">
                    Ou ajouter des branches personnalisées:
                </label>
                <input
                    type="text"
                    wire:model.lazy="allBranches"
                    placeholder="staging, feature/*, etc. (séparées par des virgules)"
                    class="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
            
            <!-- Selected Branches Display -->
            <div class="mt-4 p-4 bg-slate-50 rounded-lg">
                <p class="text-sm font-medium text-slate-900 mb-2">Branches sélectionnées:</p>
                @if (!empty($this->selectedBranches))
                    <div class="flex flex-wrap gap-2">
                        @foreach ($this->selectedBranches as $branch)
                            <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm">
                                {{ $branch }}
                                <button
                                    wire:click="toggleBranch('{{ $branch }}')"
                                    class="text-blue-600 hover:text-blue-900 font-bold"
                                >
                                    ×
                                </button>
                            </span>
                        @endforeach
                    </div>
                @else
                    <p class="text-slate-500 text-sm italic">Aucune branche sélectionnée</p>
                @endif
            </div>
        </div>
    @endif
    
    <!-- Info Box -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <p class="text-blue-900 text-sm">
            <span class="font-bold">💡 Conseil:</span> 
            Commencez avec le mode automatique sur <code class="bg-white px-1.5 py-0.5 rounded text-xs border border-blue-300">main</code>. 
            Vous pourrez toujours ajouter d'autres branches plus tard.
        </p>
    </div>
    
</div>
