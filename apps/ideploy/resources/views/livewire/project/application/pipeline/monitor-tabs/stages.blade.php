<div class="space-y-6">
    <!-- Stages Timeline -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white">
        <h3 class="font-bold text-slate-900 mb-6">📊 Stages Timeline</h3>

        <div class="space-y-6">
            @php
                // Récupérer les stages depuis l'exécution
                $rawStagesStatus = $currentExecution->stages_status ?? [];
                
                // Définir l'ordre et les métadonnées des stages
                $stagesConfig = [
                    'git_clone' => ['emoji' => '📥', 'label' => 'Git Clone'],
                    'language_detection' => ['emoji' => '🔍', 'label' => 'Language Detection'],
                    'sonarqube' => ['emoji' => '📊', 'label' => 'SonarQube Analysis'],
                    'trivy' => ['emoji' => '🔒', 'label' => 'Trivy Security Scan'],
                    'deploy' => ['emoji' => '🚀', 'label' => 'Deployment'],
                ];
                
                // Formatter les stages avec durée calculée
                $stagesStatus = [];
                foreach ($stagesConfig as $stageId => $config) {
                    $stageData = $rawStagesStatus[$stageId] ?? ['status' => 'pending'];
                    
                    // Calculer la durée si les timestamps existent
                    $duration = 0;
                    if (!empty($stageData['started_at']) && !empty($stageData['finished_at'])) {
                        try {
                            $start = new \DateTime($stageData['started_at']);
                            $end = new \DateTime($stageData['finished_at']);
                            $duration = $end->getTimestamp() - $start->getTimestamp();
                        } catch (\Exception $e) {
                            $duration = 0;
                        }
                    }
                    
                    $stagesStatus[$stageId] = array_merge($stageData, [
                        'duration' => $duration,
                        'emoji' => $config['emoji'],
                        'label' => $config['label'],
                    ]);
                }
                
                $totalDuration = array_sum(array_column($stagesStatus, 'duration'));
            @endphp

            @foreach($stagesStatus as $stageName => $stageInfo)
                <div class="space-y-2">
                    <!-- Stage Header -->
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">{{ $stageInfo['emoji'] ?? '⚙️' }}</span>
                            <div>
                                <h4 class="font-bold text-slate-900">{{ $stageInfo['label'] ?? ucfirst($stageName) }}</h4>
                                <p class="text-xs text-slate-600">
                                    @switch($stageInfo['status'] ?? 'pending')
                                        @case('success')
                                            Completed successfully
                                        @break
                                        @case('failed')
                                            Failed with errors
                                        @break
                                        @case('running')
                                            Currently running
                                        @break
                                        @case('skipped')
                                            Skipped
                                        @break
                                        @default
                                            Waiting to start
                                    @endswitch
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold text-slate-900">
                                {{ $stageInfo['duration'] ?? 0 }}s
                            </div>
                            @if(!empty($stageInfo['error']))
                                <div class="text-xs text-red-600 mt-1">
                                    {{ Str::limit($stageInfo['error'], 30) }}
                                </div>
                            @endif
                        </div>
                    </div>

                    <!-- Status Badge & Progress -->
                    <div class="flex items-center gap-3">
                        <div class="flex-1 space-y-1">
                            <!-- Progress Bar -->
                            <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                <div
                                    class="h-3 rounded-full transition-all duration-300 {{ match($stageInfo['status'] ?? 'pending') {
                                        'running' => 'bg-gradient-to-r from-blue-500 to-blue-400 w-2/3 animate-pulse',
                                        'success' => 'bg-gradient-to-r from-green-500 to-green-400 w-full',
                                        'failed' => 'bg-gradient-to-r from-red-500 to-red-400 w-full',
                                        'skipped' => 'bg-slate-400 w-0',
                                        default => 'bg-yellow-500 w-0'
                                    } }}"
                                ></div>
                            </div>

                            <!-- Status text -->
                            <div class="flex gap-2 items-center">
                                <span class="text-xs font-bold px-2 py-1 rounded-full {{ match($stageInfo['status'] ?? 'pending') {
                                    'running' => 'bg-blue-100 text-blue-800',
                                    'success' => 'bg-green-100 text-green-800',
                                    'failed' => 'bg-red-100 text-red-800',
                                    'skipped' => 'bg-gray-100 text-gray-800',
                                    default => 'bg-yellow-100 text-yellow-800'
                                } }}">
                                    @switch($stageInfo['status'] ?? 'pending')
                                        @case('running')
                                            🔄 Running
                                        @break
                                        @case('success')
                                            ✅ Success
                                        @break
                                        @case('failed')
                                            ❌ Failed
                                        @break
                                        @case('skipped')
                                            ⏭️ Skipped
                                        @break
                                        @default
                                            ⏳ Pending
                                    @endswitch
                                </span>
                            </div>
                        </div>

                        <!-- Expand Button -->
                        <button class="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-all">
                            👀 View
                        </button>
                    </div>

                    <!-- Divider -->
                    @if (!$loop->last)
                        <div class="flex items-center gap-4 py-2">
                            <div class="w-0 h-0"></div>
                            <div class="flex-1 h-px bg-slate-200"></div>
                        </div>
                    @endif
                </div>
            @endforeach
        </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-3 gap-4">
        <div class="p-4 rounded-lg border border-slate-200 bg-white text-center">
            <p class="text-sm text-slate-600 mb-2">Total Duration</p>
            <p class="text-2xl font-bold text-slate-900">{{ $totalDuration }}s</p>
        </div>
        <div class="p-4 rounded-lg border border-slate-200 bg-white text-center">
            <p class="text-sm text-slate-600 mb-2">Completed</p>
            <p class="text-2xl font-bold text-green-600">
                {{ collect($stagesStatus)->where('status', 'success')->count() }}/{{ count($stagesStatus) }}
            </p>
        </div>
        <div class="p-4 rounded-lg border border-slate-200 bg-white text-center">
            <p class="text-sm text-slate-600 mb-2">Failed</p>
            <p class="text-2xl font-bold text-red-600">
                {{ collect($stagesStatus)->where('status', 'failed')->count() }}
            </p>
        </div>
    </div>

    <!-- Stage Artifacts -->
    <div class="p-6 rounded-lg border border-slate-200 bg-white">
        <h3 class="font-bold text-slate-900 mb-4">📦 Artifacts & Reports</h3>
        <div class="space-y-2">
            <a href="#" class="flex items-center gap-2 p-3 hover:bg-slate-50 rounded-lg transition-all border border-slate-200 hover:border-blue-300">
                <span class="text-lg">📊</span>
                <span class="flex-1">
                    <span class="font-semibold text-slate-900">Coverage Report</span>
                    <p class="text-xs text-slate-600">89% coverage</p>
                </span>
                <span class="text-slate-400">→</span>
            </a>
            <a href="#" class="flex items-center gap-2 p-3 hover:bg-slate-50 rounded-lg transition-all border border-slate-200 hover:border-blue-300">
                <span class="text-lg">📝</span>
                <span class="flex-1">
                    <span class="font-semibold text-slate-900">Test Results</span>
                    <p class="text-xs text-slate-600">45 tests passed</p>
                </span>
                <span class="text-slate-400">→</span>
            </a>
            <a href="#" class="flex items-center gap-2 p-3 hover:bg-slate-50 rounded-lg transition-all border border-slate-200 hover:border-blue-300">
                <span class="text-lg">🐳</span>
                <span class="flex-1">
                    <span class="font-semibold text-slate-900">Docker Image</span>
                    <p class="text-xs text-slate-600">myapp:v1.0.5</p>
                </span>
                <span class="text-slate-400">→</span>
            </a>
        </div>
    </div>
</div>
