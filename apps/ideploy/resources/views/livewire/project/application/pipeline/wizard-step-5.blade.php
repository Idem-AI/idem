<!-- Step 5: Review & Confirm -->
<div class="space-y-6">
    
    <!-- Configuration Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Template Card -->
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-5">
            <h3 class="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <span class="text-xl">🎯</span> Template
            </h3>
            <p class="text-blue-800 font-medium">{{ ucfirst($this->selectedTemplate ?? 'N/A') }}</p>
            @if ($currentTemplate)
                <p class="text-blue-700 text-sm mt-2">{{ $currentTemplate->description }}</p>
            @endif
        </div>
        
        <!-- Trigger Card -->
        <div class="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-5">
            <h3 class="font-bold text-purple-900 mb-3 flex items-center gap-2">
                <span class="text-xl">🔔</span> Déclencheur
            </h3>
            <p class="text-purple-800 font-medium">
                @if ($this->triggerMode === 'webhook')
                    🪝 Automatique (Webhook)
                @else
                    🖱️ Manuel
                @endif
            </p>
            @if ($this->triggerMode === 'webhook' && !empty($this->selectedBranches))
                <p class="text-purple-700 text-sm mt-2">
                    Branches: <span class="font-medium">{{ implode(', ', $this->selectedBranches) }}</span>
                </p>
            @endif
        </div>
        
        <!-- Stages Card -->
        <div class="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-5">
            <h3 class="font-bold text-green-900 mb-3 flex items-center gap-2">
                <span class="text-xl">⚙️</span> Étapes
            </h3>
            <p class="text-green-800 font-medium">{{ count($this->selectedStages) }} étape(s)</p>
            <ul class="text-green-700 text-sm mt-2 space-y-1">
                @foreach ($this->selectedStages as $stage)
                    <li class="flex items-center gap-1">
                        <span>→</span> {{ str_replace('_', ' ', ucfirst($stage)) }}
                    </li>
                @endforeach
            </ul>
        </div>
        
        <!-- Notifications Card -->
        <div class="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-5">
            <h3 class="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span class="text-xl">📬</span> Notifications
            </h3>
            @if ($this->notificationMode === 'none')
                <p class="text-amber-800 font-medium">Désactivées</p>
            @else
                <p class="text-amber-800 font-medium">
                    @switch($this->notificationMode)
                        @case('failures')
                            Seulement les erreurs
                            @break
                        @case('all')
                            Tous les événements
                            @break
                    @endswitch
                </p>
                @if (!empty($this->notificationChannels))
                    <p class="text-amber-700 text-sm mt-2">
                        Canaux: <span class="font-medium">{{ implode(', ', $this->notificationChannels) }}</span>
                    </p>
                @endif
            @endif
        </div>
    </div>
    
    <!-- Webhook URL Info (if applicable) -->
    @if ($this->triggerMode === 'webhook')
        <div class="bg-slate-50 border-2 border-slate-200 rounded-lg p-6">
            <h3 class="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span class="text-xl">🪝</span> URL du Webhook GitHub
            </h3>
            <p class="text-slate-600 text-sm mb-3">
                Utilisez cette URL pour configurer le webhook GitHub:
            </p>
            <div class="flex items-center gap-2">
                <code class="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 break-all font-mono">
                    {{ route('webhook.github', $application->id) }}
                </code>
                <button
                    type="button"
                    onclick="navigator.clipboard.writeText('{{ route('webhook.github', $application->id) }}'); alert('Copié!');"
                    class="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-sm whitespace-nowrap"
                >
                    📋 Copier
                </button>
            </div>
            <p class="text-slate-500 text-xs mt-3">
                Cette URL sera automatiquement configurée sur GitHub après confirmation.
            </p>
        </div>
    @endif
    
    <!-- Confirmation Checkbox -->
    <div class="space-y-4 pt-6 border-t border-slate-200">
        <div class="flex items-start gap-3">
            <input
                type="checkbox"
                wire:model="isConfirmed"
                id="confirm-checkbox"
                class="w-5 h-5 mt-1 text-green-600 rounded focus:ring-green-500 border-slate-300 cursor-pointer"
            />
            <label for="confirm-checkbox" class="flex-1 cursor-pointer">
                <span class="font-medium text-slate-900">
                    Je confirme la configuration ci-dessus
                </span>
                <p class="text-slate-600 text-sm mt-1">
                    Vous pourrez modifier tous ces paramètres après la création.
                </p>
            </label>
        </div>
    </div>
    
    <!-- Final Summary -->
    <div class="bg-green-50 border-2 border-green-200 rounded-lg p-6">
        <h3 class="font-bold text-green-900 mb-3 flex items-center gap-2">
            <span class="text-2xl">✅</span> Prêt à démarrer!
        </h3>
        <p class="text-green-800 text-sm mb-4">
            Vous êtes sur le point de créer votre pipeline CI/CD. Une fois confirmé:
        </p>
        <ul class="text-green-700 text-sm space-y-2">
            <li class="flex items-center gap-2">
                <span class="text-green-600">✓</span>
                @if ($this->triggerMode === 'webhook')
                    Le webhook GitHub sera configuré automatiquement
                @else
                    Vous pourrez lancer le pipeline manuellement
                @endif
            </li>
            <li class="flex items-center gap-2">
                <span class="text-green-600">✓</span>
                Les {{ count($this->selectedStages) }} étape(s) seront exécutées dans l'ordre
            </li>
            @if ($this->notificationMode !== 'none')
                <li class="flex items-center gap-2">
                    <span class="text-green-600">✓</span>
                    Vous recevrez des notifications via {{ implode(', ', $this->notificationChannels) }}
                </li>
            @endif
            <li class="flex items-center gap-2">
                <span class="text-green-600">✓</span>
                Vous pourrez voir l'historique de toutes les exécutions
            </li>
        </ul>
    </div>
    
    <!-- Quick Start Guide Link -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p class="text-blue-900 text-sm">
            <span class="font-bold">📖</span> Besoin d'aide? 
            <a href="#" class="text-blue-600 hover:text-blue-800 font-medium underline">
                Consultez notre guide d'utilisation
            </a>
        </p>
    </div>
    
</div>
