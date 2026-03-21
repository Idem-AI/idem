<div>
    <x-slot:title>
        {{ data_get_str($database, 'name')->limit(10) }} > Configuration | Coolify
    </x-slot>
    
    {{-- Header Moderne --}}
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">
            <span class="i-underline">Database Configuration</span>
        </h1>
        <p class="text-base text-gray-400">Manage your database settings and deployment options</p>
    </div>
    
    <livewire:project.shared.configuration-checker :resource="$database" />
    <livewire:project.database.heading :database="$database" />
    
    <div class="flex flex-col lg:flex-row gap-6 mt-6">
        {{-- Sidebar Navigation Moderne --}}
        <div class="lg:w-64 flex-shrink-0">
            <nav class="sticky top-6 glass-card p-4">
                {{-- Section: Configuration --}}
                <div class="mb-5">
                    <div class="text-xs uppercase tracking-widest text-blue-400 font-bold mb-3 px-1">
                        CONFIGURATION
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.configuration') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.configuration', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                        </svg>
                        <span>General</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.environment-variables') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.environment-variables', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                        </svg>
                        <span>Variables</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.persistent-storage') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.persistent-storage', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                        </svg>
                        <span>Storage</span>
                    </a>
                </div>

                {{-- Section: Deployment --}}
                <div class="mb-5">
                    <div class="text-xs uppercase tracking-widest text-purple-400 font-bold mb-3 px-1">
                        DEPLOYMENT
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.servers') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.servers', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                        </svg>
                        <span>Servers</span>
                    </a>
                    
                    @can('update', $database)
                        <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                            :class="'{{ request()->routeIs('project.database.import-backups') }}' === '1' 
                                ? 'glass text-light glow-primary' 
                                : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                            href="{{ route('project.database.import-backups', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                            </svg>
                            <span>Import Backups</span>
                        </a>
                    @endcan
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.webhooks') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.webhooks', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>Webhooks</span>
                    </a>
                </div>

                {{-- Section: Monitoring --}}
                <div class="mb-5">
                    <div class="text-xs uppercase tracking-widest text-green-400 font-bold mb-3 px-1">
                        MONITORING
                    </div>
                    
                    <a class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                        :class="'{{ request()->routeIs('project.database.resource-limits') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.resource-limits', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        <span>Resource Limits</span>
                    </a>
                    
                    <a class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                        :class="'{{ request()->routeIs('project.database.resource-operations') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.resource-operations', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        <span>Operations</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.metrics') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.metrics', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>Metrics</span>
                    </a>
                </div>

                {{-- Section: Other --}}
                <div>
                    <div class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3 px-1">
                        OTHER
                    </div>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.tags') }}' === '1' 
                            ? 'glass text-light glow-primary' 
                            : 'text-light opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.tags', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                        <span>Tags</span>
                    </a>
                    
                    <a class='group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all'
                        :class="'{{ request()->routeIs('project.database.danger') }}' === '1' 
                            ? 'glass text-danger glow-secondary' 
                            : 'text-danger opacity-70 hover:opacity-100 hover:glass'"
                        href="{{ route('project.database.danger', ['project_uuid' => $project->uuid, 'environment_uuid' => $environment->uuid, 'database_uuid' => $database->uuid]) }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        <span>Danger Zone</span>
                    </a>
                </div>
            </nav>
        </div>

        {{-- Main Content --}}
        <div class="flex-1 min-w-0 glass-card p-8">
            @if ($currentRoute === 'project.database.configuration')
                @if ($database->type() === 'standalone-postgresql')
                    <livewire:project.database.postgresql.general :database="$database" />
                @elseif ($database->type() === 'standalone-redis')
                    <livewire:project.database.redis.general :database="$database" />
                @elseif ($database->type() === 'standalone-mongodb')
                    <livewire:project.database.mongodb.general :database="$database" />
                @elseif ($database->type() === 'standalone-mysql')
                    <livewire:project.database.mysql.general :database="$database" />
                @elseif ($database->type() === 'standalone-mariadb')
                    <livewire:project.database.mariadb.general :database="$database" />
                @elseif ($database->type() === 'standalone-keydb')
                    <livewire:project.database.keydb.general :database="$database" />
                @elseif ($database->type() === 'standalone-dragonfly')
                    <livewire:project.database.dragonfly.general :database="$database" />
                @elseif ($database->type() === 'standalone-clickhouse')
                    <livewire:project.database.clickhouse.general :database="$database" />
                @endif
            @elseif ($currentRoute === 'project.database.environment-variables')
                <livewire:project.shared.environment-variable.all :resource="$database" />
            @elseif ($currentRoute === 'project.database.servers')
                <livewire:project.shared.destination :resource="$database" />
            @elseif ($currentRoute === 'project.database.persistent-storage')
                <livewire:project.service.storage :resource="$database" />
            @elseif ($currentRoute === 'project.database.import-backups')
                <livewire:project.database.import :resource="$database" />
            @elseif ($currentRoute === 'project.database.webhooks')
                <livewire:project.shared.webhooks :resource="$database" />
            @elseif ($currentRoute === 'project.database.resource-limits')
                <livewire:project.shared.resource-limits :resource="$database" />
            @elseif ($currentRoute === 'project.database.resource-operations')
                <livewire:project.shared.resource-operations :resource="$database" />
            @elseif ($currentRoute === 'project.database.metrics')
                <livewire:project.shared.metrics :resource="$database" />
            @elseif ($currentRoute === 'project.database.tags')
                <livewire:project.shared.tags :resource="$database" />
            @elseif ($currentRoute === 'project.database.danger')
                <livewire:project.shared.danger :resource="$database" />
            @endif
        </div>
    </div>
</div>
