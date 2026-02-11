<!-- Step 1: Template Selection -->
<div class="space-y-6">
    
    <!-- Auto-Detected Badge -->
    @if ($this->detectedTemplate)
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-blue-900 font-medium">
                ✨ Nous avons détecté: <span class="font-bold">{{ ucfirst($this->detectedTemplate) }}</span>
            </p>
            <p class="text-blue-700 text-sm mt-1">Vous pouvez le modifier en sélectionnant un autre template ci-dessous.</p>
        </div>
    @endif
    
    <!-- Templates Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @foreach ($templates as $template)
            <div
                wire:click="selectTemplate('{{ $template->key }}')"
                class="cursor-pointer p-6 border-2 rounded-lg transition-all duration-200
                    {{ $this->selectedTemplate === $template->key
                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                    }}"
            >
                <!-- Header -->
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h3 class="font-bold text-lg text-slate-900">
                            {{ $template->name }}
                        </h3>
                        @if ($this->detectedTemplate === $template->key)
                            <span class="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                ✓ Détecté
                            </span>
                        @endif
                    </div>
                    <div class="text-4xl">
                        @switch($template->key)
                            @case('nodejs')
                                🟩
                                @break
                            @case('python')
                                🐍
                                @break
                            @case('docker')
                                🐳
                                @break
                            @case('static')
                                🌐
                                @break
                            @case('custom')
                                ⚙️
                                @break
                        @endswitch
                    </div>
                </div>
                
                <!-- Description -->
                <p class="text-slate-600 text-sm mb-4">
                    {{ $template->description }}
                </p>
                
                <!-- Language Info -->
                <div class="flex items-center gap-2 text-xs text-slate-500">
                    <span class="inline-block px-2 py-1 bg-slate-100 rounded">
                        {{ $template->language }}
                    </span>
                </div>
                
                <!-- Selection Indicator -->
                @if ($this->selectedTemplate === $template->key)
                    <div class="mt-4 pt-4 border-t border-blue-200">
                        <span class="text-blue-600 font-semibold text-sm">✓ Sélectionné</span>
                    </div>
                @endif
            </div>
        @endforeach
    </div>
    
    <!-- Info Box -->
    @if ($currentTemplate)
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-6">
            <h4 class="font-semibold text-slate-900 mb-2">📋 Étapes incluses:</h4>
            @if ($currentTemplate->default_stages)
                <ul class="space-y-2">
                    @foreach (array_keys($currentTemplate->default_stages) as $stage)
                        <li class="text-slate-600 text-sm flex items-center gap-2">
                            <span class="text-blue-500">→</span>
                            <span class="capitalize">{{ str_replace('_', ' ', $stage) }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
        </div>
    @endif
    
</div>
