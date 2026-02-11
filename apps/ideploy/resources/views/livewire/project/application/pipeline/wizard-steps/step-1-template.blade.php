<div>
    <h2 class="text-2xl font-bold text-slate-900 mb-6">Step 1: Select a Template</h2>
    
    <!-- Auto-detected template info -->
    @if ($detectedTemplate)
        <div class="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-start gap-3">
                <span class="text-2xl">✨</span>
                <div>
                    <h3 class="font-semibold text-green-900">Auto-Detected Project Type</h3>
                    <p class="text-sm text-green-800 mt-1">
                        We detected: <strong>{{ ucfirst($detectedTemplate) }}</strong>
                    </p>
                    <p class="text-xs text-green-700 mt-2">
                        You can still choose a different template below
                    </p>
                </div>
            </div>
        </div>
    @endif

    <!-- Template Selection Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @forelse($templates as $template)
            <button
                wire:click="selectTemplate('{{ $template->key }}')"
                class="p-6 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md
                    {{ $selectedTemplate === $template->key 
                        ? 'border-blue-600 bg-blue-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-slate-300' }}"
            >
                <!-- Template Icon -->
                <div class="text-4xl mb-3">
                    @switch($template->key)
                        @case('nodejs')
                            ⚡
                        @break
                        @case('python')
                            🐍
                        @break
                        @case('docker')
                            🐳
                        @break
                        @case('static')
                            📄
                        @break
                        @case('custom')
                            ⚙️
                        @break
                        @default
                            🚀
                    @endswitch
                </div>

                <!-- Template Info -->
                <h3 class="text-lg font-bold text-slate-900 mb-2">
                    {{ $template->name }}
                </h3>
                <p class="text-sm text-slate-600 mb-4">
                    {{ $template->description }}
                </p>

                <!-- Template Details -->
                <div class="space-y-2 text-xs">
                    <div class="flex items-center gap-2 text-slate-700">
                        <span>📦</span>
                        <span><strong>Stages:</strong> {{ count($template->default_stages ?? []) }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-slate-700">
                        <span>🛠️</span>
                        <span><strong>Tools:</strong> {{ count($template->recommended_tools ?? []) }}</span>
                    </div>
                </div>

                <!-- Selected Indicator -->
                @if ($selectedTemplate === $template->key)
                    <div class="mt-4 flex items-center gap-2 text-blue-600 font-semibold">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        Selected
                    </div>
                @endif
            </button>
        @empty
            <div class="col-span-2 p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
                <p class="text-slate-600">No templates available</p>
            </div>
        @endforelse
    </div>

    <!-- Template Details Section -->
    @if ($selectedTemplate && $currentTemplate)
        <div class="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 class="text-lg font-bold text-blue-900 mb-4">{{ $currentTemplate->name }} Details</h3>
            
            <div class="grid grid-cols-2 gap-6">
                <!-- Stages -->
                <div>
                    <h4 class="font-semibold text-slate-900 mb-3">Included Stages:</h4>
                    <ul class="space-y-2">
                        @forelse($currentTemplate->default_stages ?? [] as $stageName => $stageConfig)
                            <li class="flex items-center gap-2 text-sm text-slate-700">
                                <span class="text-lg">
                                    @switch($stageName)
                                        @case('lint')
                                            📝
                                        @break
                                        @case('test')
                                            ✅
                                        @break
                                        @case('build')
                                            🔨
                                        @break
                                        @case('security')
                                            🔒
                                        @break
                                        @case('deploy')
                                            🚀
                                        @break
                                        @default
                                            ⚙️
                                    @endswitch
                                </span>
                                <span>{{ ucfirst($stageName) }}</span>
                                @if ($stageConfig['recommended'] ?? false)
                                    <span class="ml-auto text-xs bg-green-200 text-green-800 px-2 py-1 rounded">Recommended</span>
                                @endif
                            </li>
                        @empty
                            <li class="text-sm text-slate-600">No stages defined</li>
                        @endforelse
                    </ul>
                </div>

                <!-- Tools -->
                <div>
                    <h4 class="font-semibold text-slate-900 mb-3">Recommended Tools:</h4>
                    <div class="flex flex-wrap gap-2">
                        @forelse($currentTemplate->recommended_tools ?? [] as $tool)
                            <span class="text-xs bg-slate-200 text-slate-800 px-3 py-1 rounded-full">
                                {{ $tool }}
                            </span>
                        @empty
                            <span class="text-sm text-slate-600">No tools defined</span>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    @endif

    <!-- Info Box -->
    <div class="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p class="text-sm text-slate-700">
            <strong>💡 Tip:</strong> Templates are pre-configured based on your project type. They include recommended stages and tools, but you can customize everything in the next steps.
        </p>
    </div>
</div>
