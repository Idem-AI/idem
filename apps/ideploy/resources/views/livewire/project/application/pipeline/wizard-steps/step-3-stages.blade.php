<div>
    <h2 class="text-2xl font-bold text-slate-900 mb-6">Step 3: Configure Pipeline Stages</h2>

    <p class="text-slate-600 mb-6">
        Select which stages your pipeline should include:
    </p>

    <!-- Stages Selection -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        @php
            $stageEmojis = [
                'lint' => '📝',
                'test' => '✅',
                'build' => '🔨',
                'security' => '🔒',
                'deploy' => '🚀',
                'performance' => '⚡',
                'coverage' => '📊',
                'quality' => '🎯',
            ];
        @endphp

        @foreach($selectedStages as $stageKey)
            @php
                $stage = $availableStages[$stageKey] ?? null;
            @endphp

            @if ($stage)
                <div class="p-4 rounded-lg border-2 border-blue-300 bg-blue-50">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">
                                {{ $stageEmojis[$stageKey] ?? '⚙️' }}
                            </span>
                            <div>
                                <h3 class="font-bold text-slate-900">
                                    {{ ucfirst($stageKey) }}
                                </h3>
                                <p class="text-xs text-slate-600">
                                    {{ $stage['description'] ?? 'No description' }}
                                </p>
                            </div>
                        </div>
                        <button
                            wire:click="toggleStage('{{ $stageKey }}')"
                            class="px-3 py-1 text-red-600 hover:bg-red-100 rounded text-sm font-semibold"
                            type="button"
                        >
                            Remove
                        </button>
                    </div>

                    <!-- Stage Configuration -->
                    <div class="space-y-3 pt-3 border-t border-blue-200">
                        <!-- Timeout -->
                        <div>
                            <label class="text-xs font-semibold text-slate-700 block mb-1">
                                Timeout (seconds):
                            </label>
                            <input
                                type="number"
                                wire:model="stageConfigs.{{ $stageKey }}.timeout"
                                value="{{ $stageConfigs[$stageKey]['timeout'] ?? 600 }}"
                                min="60"
                                max="3600"
                                class="w-full px-3 py-1 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                            >
                        </div>

                        <!-- Retries -->
                        <div>
                            <label class="text-xs font-semibold text-slate-700 block mb-1">
                                Retries:
                            </label>
                            <input
                                type="number"
                                wire:model="stageConfigs.{{ $stageKey }}.retries"
                                value="{{ $stageConfigs[$stageKey]['retries'] ?? 0 }}"
                                min="0"
                                max="5"
                                class="w-full px-3 py-1 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                            >
                        </div>

                        <!-- Tools (if available) -->
                        @if (isset($stage['available_tools']) && count($stage['available_tools']) > 0)
                            <div>
                                <label class="text-xs font-semibold text-slate-700 block mb-1">
                                    Tools:
                                </label>
                                <div class="flex flex-wrap gap-1">
                                    @foreach($stage['available_tools'] as $tool)
                                        <label class="flex items-center gap-1 text-xs p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                wire:model="stageConfigs.{{ $stageKey }}.tools"
                                                value="{{ $tool }}"
                                                class="w-3 h-3 rounded"
                                            >
                                            <span>{{ $tool }}</span>
                                        </label>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                    </div>
                </div>
            @endif
        @endforeach

        <!-- Available Stages to Add -->
        @if (count($selectedStages) < count($availableStages ?? []))
            <div class="p-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col justify-center items-center">
                <p class="text-sm text-slate-600 font-semibold mb-3">Add More Stages</p>
                <div class="space-y-2 w-full">
                    @foreach($availableStages ?? [] as $stageKey => $stage)
                        @if (!in_array($stageKey, $selectedStages))
                            <button
                                wire:click="toggleStage('{{ $stageKey }}')"
                                class="w-full px-3 py-2 text-left text-sm hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-300"
                                type="button"
                            >
                                <span class="text-lg">{{ $stageEmojis[$stageKey] ?? '⚙️' }}</span>
                                <span class="ml-2 font-semibold text-slate-700">
                                    {{ ucfirst($stageKey) }}
                                </span>
                            </button>
                        @endif
                    @endforeach
                </div>
            </div>
        @endif
    </div>

    <!-- Stage Summary -->
    <div class="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 class="font-bold text-blue-900 mb-4">Pipeline Flow</h3>

        <div class="flex flex-col gap-2">
            @foreach($selectedStages as $index => $stageKey)
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        {{ $index + 1 }}
                    </div>
                    <div class="flex-grow">
                        <span class="font-semibold text-slate-900">{{ ucfirst($stageKey) }}</span>
                    </div>
                    <div class="text-xs text-slate-600 flex items-center gap-2">
                        <span>⏱️ {{ $stageConfigs[$stageKey]['timeout'] ?? 600 }}s</span>
                        <span>🔄 {{ $stageConfigs[$stageKey]['retries'] ?? 0 }} retries</span>
                    </div>
                </div>
                @if ($index < count($selectedStages) - 1)
                    <div class="ml-4 h-4 border-l-2 border-blue-300"></div>
                @endif
            @endforeach
        </div>
    </div>

    <!-- Info Box -->
    <div class="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p class="text-sm text-slate-700">
            <strong>💡 Tip:</strong> Stages run sequentially (one after another). If any stage fails, the pipeline stops.
        </p>
    </div>
</div>
