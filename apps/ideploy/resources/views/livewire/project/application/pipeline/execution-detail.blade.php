<div>
    <x-slot:title>
        {{ data_get_str($application, 'name')->limit(10) }} > Pipeline Detail | Coolify
    </x-slot>
    
    <livewire:project.shared.configuration-checker :resource="$application" />
    <livewire:project.application.heading :application="$application" />

<div class="min-h-screen bg-[#0a0a0a] text-white" wire:poll.3s>
    {{-- Header --}}
    <div class="border-b border-gray-800 bg-[#0f0f0f] px-6 py-4 mb-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <a href="{{ route('project.application.pipeline.executions', $parameters) }}" class="text-gray-400 hover:text-white transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                </a>
                
                <div>
                    <h1 class="text-2xl font-bold">Pipeline #{{ $execution->id ?? '247' }}</h1>
                    <p class="text-sm text-gray-400 mt-1">{{ $execution->commit_message ?? 'fix: update API endpoint validation' }}</p>
                </div>
            </div>

            <div class="flex items-center gap-3">
                @php
                    $status = $execution->status ?? 'success';
                @endphp
                
                @if($status === 'running')
                    <button wire:click="cancelExecution" class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition">
                        Cancel
                    </button>
                @endif
                
                <button wire:click="rerunExecution" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition">
                    Re-run
                </button>
            </div>
        </div>

        {{-- Metadata --}}
        <div class="mt-4 flex items-center gap-6 text-sm text-gray-400">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                <span>{{ $execution->branch ?? 'main' }}</span>
            </div>
            
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>{{ $execution->trigger_user ?? 'John Doe' }}</span>
            </div>
            
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Started 2 minutes ago</span>
            </div>
            
            @if($execution->duration_seconds ?? null)
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <span>{{ gmdate('i:s', $execution->duration_seconds ?? 225) }}</span>
                </div>
            @endif
        </div>
    </div>

    {{-- Main Content: 2 Columns Layout --}}
    <div class="px-6 flex gap-6">
        {{-- Left Sidebar: Jobs List --}}
        <div class="w-80 flex-shrink-0">
            <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg overflow-hidden sticky top-6">
                <div class="px-4 py-3 border-b border-gray-800">
                    <h3 class="font-semibold">Jobs</h3>
                </div>
                
                <div class="divide-y divide-gray-800">
                    @if($execution && $execution->jobs->count() > 0)
                        @foreach($execution->jobs as $job)
                            @php
                                $iconMap = [
                                    'language_detection' => 'code',
                                    'sonarqube' => 'clipboard',
                                    'trivy' => 'shield',
                                    'deploy' => 'rocket',
                                ];
                                $jobIcon = $iconMap[$job->name] ?? 'cog';
                                $jobColor = match($job->status) {
                                    'success' => 'green',
                                    'failed' => 'red',
                                    'running' => 'blue',
                                    default => 'gray'
                                };
                            @endphp
                        <div wire:click="selectJob({{ $job->id }})" 
                             class="px-4 py-3 hover:bg-gray-800/30 cursor-pointer transition {{ $selectedJobId === $job->id ? 'bg-gray-800/50 border-l-2 border-blue-500' : '' }}">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-medium">{{ ucwords(str_replace('_', ' ', $job->name)) }}</span>
                                <span class="text-gray-400">{{ $job->duration_seconds ? $job->duration_seconds . 's' : '—' }}</span>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="px-2 py-0.5 text-xs rounded {{ $job->status === 'success' ? 'bg-green-500/20 text-green-400' : ($job->status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400') }}">
                                    {{ ucfirst($job->status) }}
                                </span>
                            </div>
                        </div>
                    @endforeach
                @else
                    <div class="px-4 py-8 text-center text-gray-400">
                        <p>No jobs available</p>
                    </div>
                @endif
            </div>
        </div>

        {{-- Right Content: Logs & Dashboards --}}
        <div class="flex-1 space-y-6">
            @if($this->selectedJob)
                {{-- Job Info --}}
                <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            @php
                                $iconMap = [
                                    'language_detection' => 'code',
                                    'sonarqube' => 'clipboard',
                                    'trivy' => 'shield',
                                    'deploy' => 'rocket',
                                ];
                                $jobIcon = $iconMap[$this->selectedJob->name] ?? 'cog';
                                $jobColor = match($this->selectedJob->status) {
                                    'success' => 'green',
                                    'failed' => 'red',
                                    'running' => 'blue',
                                    default => 'gray'
                                };
                            @endphp
                            <div class="w-10 h-10 bg-{{ $jobColor }}-500/20 rounded-lg flex items-center justify-center">
                                <svg class="w-5 h-5 text-{{ $jobColor }}-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    @if($jobIcon === 'code')
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                                    @elseif($jobIcon === 'clipboard')
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    @elseif($jobIcon === 'shield')
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                                    @else
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
                                    @endif
                                </svg>
                            </div>
                            <div>
                                <h2 class="text-lg font-semibold">{{ ucwords(str_replace('_', ' ', $this->selectedJob->name)) }}</h2>
                                <p class="text-sm text-gray-400">Duration: {{ $this->selectedJob->duration_seconds ? $this->selectedJob->duration_seconds . 's' : '—' }}</p>
                            </div>
                        </div>
                        
                        <span class="px-3 py-1 {{ $this->selectedJob->status === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ($this->selectedJob->status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30') }} text-xs font-medium rounded-full border">
                            {{ strtoupper($this->selectedJob->status) }}
                        </span>
                    </div>
                </div>

                {{-- Dashboards (SonarQube & Trivy) --}}
                @if($this->selectedJob->name === 'sonarqube')
                    @php
                        $sonarResult = $this->selectedJob->scanResults()->where('tool', 'sonarqube')->first();
                    @endphp
                    <x-pipeline.sonarqube-dashboard :scanResult="$sonarResult" />
                @endif

                @if($this->selectedJob->name === 'trivy')
                    @php
                        $trivyResult = $this->selectedJob->scanResults()->where('tool', 'trivy')->first();
                    @endphp
                    <x-pipeline.trivy-dashboard :scanResult="$trivyResult" />
                @endif

            {{-- Logs --}}
            <div class="bg-[#0f0f0f] border border-gray-800 rounded-lg overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 class="font-semibold">Logs</h3>
                    <button class="text-sm text-gray-400 hover:text-white transition">
                        Download
                    </button>
                </div>
                
                <div class="bg-black p-4 max-h-96 overflow-y-auto font-mono text-xs">
                    @if($this->selectedJob && $this->selectedJob->logs)
                        <pre class="text-gray-300 whitespace-pre-wrap">{{ $this->selectedJob->logs }}</pre>
                    @else
                        <div class="text-gray-500 text-center py-8">
                            <p>No logs available for this job</p>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
</div>
