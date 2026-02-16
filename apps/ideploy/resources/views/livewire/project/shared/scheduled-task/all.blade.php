<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Scheduled Tasks</span>
            </h2>
            @can('update', $resource)
                <x-modal-input buttonTitle="+ Add" title="New Scheduled Task" :closeOutside="false">
                    @if ($resource->type() == 'application')
                        <livewire:project.shared.scheduled-task.add :type="$resource->type()" :id="$resource->id" :containerNames="$containerNames" />
                    @elseif ($resource->type() == 'service')
                        <livewire:project.shared.scheduled-task.add :type="$resource->type()" :id="$resource->id" :containerNames="$containerNames" />
                    @endif
                </x-modal-input>
            @endcan
        </div>
        <p class="text-sm text-light opacity-70">Automated tasks that run on a schedule.</p>
    </div>

    {{-- Tasks List --}}
    <div class="grid grid-cols-1 gap-4">
        @forelse($resource->scheduled_tasks as $task)
            @if ($resource->type() == 'application')
                <a class="glass-card p-5 hover:glow-primary transition-all"
                    href="{{ route('project.application.scheduled-tasks', [...$parameters, 'task_uuid' => $task->uuid]) }}">
                    <div class="flex flex-col gap-2">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h3 class="text-lg font-semibold text-light mb-1">
                                    {{ $task->name }}
                                    @if ($task->container)
                                        <span class="text-xs font-normal text-light opacity-60">({{ $task->container }})</span>
                                    @endif
                                </h3>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-sm text-light opacity-70">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span>{{ $task->frequency }}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                @php
                                    $lastStatus = data_get($task->latest_log, 'status', 'No runs yet');
                                @endphp
                                @if($lastStatus === 'No runs yet')
                                    <span class="text-light opacity-50">{{ $lastStatus }}</span>
                                @else
                                    <span class="px-2 py-0.5 rounded-full text-xs font-medium
                                        {{ $lastStatus === 'success' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger' }}">
                                        Last run: {{ $lastStatus }}
                                    </span>
                                @endif
                            </div>
                        </div>
                    </div>
                </a>
            @elseif ($resource->type() == 'service')
                <a class="glass-card p-5 hover:glow-primary transition-all"
                    href="{{ route('project.service.scheduled-tasks', [...$parameters, 'task_uuid' => $task->uuid]) }}">
                    <div class="flex flex-col gap-2">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h3 class="text-lg font-semibold text-light mb-1">
                                    {{ $task->name }}
                                    @if ($task->container)
                                        <span class="text-xs font-normal text-light opacity-60">({{ $task->container }})</span>
                                    @endif
                                </h3>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-sm text-light opacity-70">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span>{{ $task->frequency }}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                @php
                                    $lastStatus = data_get($task->latest_log, 'status', 'No runs yet');
                                @endphp
                                @if($lastStatus === 'No runs yet')
                                    <span class="text-light opacity-50">{{ $lastStatus }}</span>
                                @else
                                    <span class="px-2 py-0.5 rounded-full text-xs font-medium
                                        {{ $lastStatus === 'success' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger' }}">
                                        Last run: {{ $lastStatus }}
                                    </span>
                                @endif
                            </div>
                        </div>
                    </div>
                </a>
            @endif
        @empty
            <div class="glass-card p-6">
                <div class="text-center py-8 text-light opacity-60">
                    <p>No scheduled tasks configured.</p>
                </div>
            </div>
        @endforelse
    </div>
</div>
