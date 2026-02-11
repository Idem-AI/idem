<!-- Step 3: Stages Configuration -->
<div class="space-y-6">
    
    <p class="text-slate-600 text-sm">
        Sélectionnez les étapes à exécuter dans votre pipeline. Les étapes recommandées sont déjà cochées.
    </p>
    
    <!-- Stages List -->
    <div class="space-y-3">
        @if ($currentTemplate && $currentTemplate->default_stages)
            @foreach ($currentTemplate->default_stages as $stageName => $stageConfig)
                <div
                    wire:click="toggleStage('{{ $stageName }}')"
                    class="cursor-pointer p-5 border-2 rounded-lg transition-all duration-200
                        {{ in_array($stageName, $this->selectedStages)
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }}"
                >
                    <!-- Stage Header -->
                    <div class="flex items-start gap-4">
                        <!-- Checkbox -->
                        <div class="pt-1">
                            <div class="w-6 h-6 rounded border-2 flex items-center justify-center
                                {{ in_array($stageName, $this->selectedStages)
                                    ? 'border-blue-600 bg-blue-600'
                                    : 'border-slate-300 bg-white'
                                }}"
                            >
                                @if (in_array($stageName, $this->selectedStages))
                                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                @endif
                            </div>
                        </div>
                        
                        <!-- Stage Info -->
                        <div class="flex-1">
                            <h4 class="font-bold text-slate-900 capitalize">
                                {{ str_replace('_', ' ', $stageName) }}
                            </h4>
                            
                            @if (isset($stageConfig['description']))
                                <p class="text-slate-600 text-sm mt-1">
                                    {{ $stageConfig['description'] }}
                                </p>
                            @endif
                            
                            <!-- Stage Details -->
                            @if (isset($stageConfig['tools']) && !empty($stageConfig['tools']))
                                <div class="mt-3 flex flex-wrap gap-2">
                                    @foreach ($stageConfig['tools'] as $tool)
                                        <span class="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-medium">
                                            {{ $tool }}
                                        </span>
                                    @endforeach
                                </div>
                            @endif
                        </div>
                    </div>
                </div>
            @endforeach
        @else
            <div class="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <p class="text-slate-600">Sélectionnez d'abord un template à l'étape 1</p>
            </div>
        @endif
    </div>
    
    <!-- Optional Stages Section -->
    @if ($currentTemplate && isset($currentTemplate->optional_stages) && !empty($currentTemplate->optional_stages))
        <div class="pt-6 border-t border-slate-200">
            <h3 class="font-bold text-slate-900 mb-4">➕ Étapes optionnelles</h3>
            
            <div class="space-y-3">
                @foreach ($currentTemplate->optional_stages as $stageName => $stageConfig)
                    <div
                        wire:click="toggleStage('{{ $stageName }}')"
                        class="cursor-pointer p-5 border-2 rounded-lg transition-all duration-200
                            {{ in_array($stageName, $this->selectedStages)
                                ? 'border-amber-600 bg-amber-50'
                                : 'border-slate-200 bg-white hover:border-amber-300'
                            }}"
                    >
                        <div class="flex items-start gap-4">
                            <div class="pt-1">
                                <div class="w-6 h-6 rounded border-2 flex items-center justify-center
                                    {{ in_array($stageName, $this->selectedStages)
                                        ? 'border-amber-600 bg-amber-600'
                                        : 'border-slate-300 bg-white'
                                    }}"
                                >
                                    @if (in_array($stageName, $this->selectedStages))
                                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    @endif
                                </div>
                            </div>
                            
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-slate-900 capitalize">
                                        {{ str_replace('_', ' ', $stageName) }}
                                    </h4>
                                    <span class="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                                        Optionnel
                                    </span>
                                </div>
                                
                                @if (isset($stageConfig['description']))
                                    <p class="text-slate-600 text-sm mt-1">
                                        {{ $stageConfig['description'] }}
                                    </p>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    @endif
    
    <!-- Summary -->
    <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-6">
        <h4 class="font-semibold text-slate-900 mb-2">📊 Résumé:</h4>
        <p class="text-slate-600 text-sm">
            <span class="font-bold">{{ count($this->selectedStages) }}</span> étape(s) sélectionnée(s)
            @if (count($this->selectedStages) > 0)
                : {{ implode(', ', array_map(fn($s) => str_replace('_', ' ', $s), $this->selectedStages)) }}
            @endif
        </p>
    </div>
    
</div>
