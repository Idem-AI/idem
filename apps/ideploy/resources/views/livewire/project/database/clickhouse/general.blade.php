<div x-data="{ activeTab: 'basic' }">
    <form wire:submit="submit" class="max-w-7xl pb-32">
        {{-- Hero Header Ultra-Moderne --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/10 via-orange-600/10 to-red-600/10 border border-yellow-500/20 p-8 mb-8">
            <div class="absolute inset-0 opacity-10">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.3),transparent_50%)]" style="animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
            </div>
            
            <div class="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-3xl font-bold text-white mb-1">ClickHouse Database</h1>
                            <p class="text-sm text-gray-400">Configure your analytics database settings and credentials</p>
                        </div>
                    </div>
                </div>
                
                @can('update', $database)
                    <button type="submit" class="group relative px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-semibold text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105 whitespace-nowrap">
                        <div class="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span class="relative flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Save Changes
                        </span>
                    </button>
                @endcan
            </div>
        </div>

        {{-- Warning Message --}}
                @if ($database->started_at)
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <x-forms.input label="Admin User" id="clickhouseAdminUser"
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                        <x-forms.input label="Admin Password" id="clickhouseAdminPassword" type="password"
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                    </div>
                @else
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <x-forms.input label="Admin User" id="clickhouseAdminUser" canGate="update" :canResource="$database" />
                        <x-forms.input label="Admin Password" id="clickhouseAdminPassword" type="password" canGate="update" :canResource="$database" />
                    </div>
                @endif

        {{-- Section: Basic Information --}}
        <div x-data="{ expanded: true }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-yellow-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:shadow-yellow-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Basic Information</h3>
                        <p class="text-sm text-gray-400">Database name, description and image</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <x-forms.input label="Name" id="name" canGate="update" :canResource="$database" />
                    <x-forms.input label="Description" id="description" canGate="update" :canResource="$database" />
                    <x-forms.input label="Image" id="image" required
                        helper="For all available images, check here:<br><br><a target='_blank' href='https://hub.docker.com/r/clickhouse/clickhouse-server'>https://hub.docker.com/r/clickhouse/clickhouse-server</a>" canGate="update" :canResource="$database" />
                </div>
            </div>
        </div>

        {{-- Section: Credentials --}}
        <div x-data="{ expanded: false }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-green-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-green-400 transition-colors">Credentials</h3>
                        <p class="text-sm text-gray-400">Database passwords and user configuration</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                @if ($database->started_at)
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <x-forms.input label="Admin User" id="clickhouseAdminUser"
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                        <x-forms.input label="Admin Password" id="clickhouseAdminPassword" type="password"
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                    </div>
                @else
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <x-forms.input label="Admin User" id="clickhouseAdminUser" canGate="update" :canResource="$database" />
                        <x-forms.input label="Admin Password" id="clickhouseAdminPassword" type="password" canGate="update" :canResource="$database" />
                    </div>
                @endif
            </div>
        </div>

        {{-- Section: Network --}}
        <div x-data="{ expanded: false }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">Network</h3>
                        <p class="text-sm text-gray-400">Ports mappings and connection URLs</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                <x-forms.input placeholder="3000:8123" id="portsMappings" label="Ports Mappings"
                    helper="A comma separated list of ports you would like to map to the host system.<br><span class='inline-block font-bold dark:text-warning'>Example</span>3000:8123,3002:6380" canGate="update" :canResource="$database" />
                <x-forms.input label="ClickHouse URL (internal)"
                    helper="If you change the user/password/port, this could be different. This is with the default values."
                    type="password" readonly wire:model="dbUrl" canGate="update" :canResource="$database" />
                @if ($dbUrlPublic)
                    <x-forms.input label="ClickHouse URL (public)"
                        helper="If you change the user/password/port, this could be different. This is with the default values."
                        type="password" readonly wire:model="dbUrlPublic" canGate="update" :canResource="$database" />
                @endif
            </div>
        </div>

        {{-- Section: Proxy --}}
        <div x-data="{ expanded: false }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-orange-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">Proxy</h3>
                        <p class="text-sm text-gray-400">Public access and port configuration</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($isPublic)
                        <x-slide-over fullScreen>
                            <x-slot:title>Proxy Logs</x-slot:title>
                            <x-slot:content>
                                <livewire:project.shared.get-logs :server="$server" :resource="$database"
                                    container="{{ data_get($database, 'uuid') }}-proxy" lazy />
                            </x-slot:content>
                            <x-forms.button disabled="{{ !$isPublic }}"
                                @click="slideOverOpen=true">Logs</x-forms.button>
                        </x-slide-over>
                    @endif
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                <div class="mb-4">
                    <x-forms.checkbox instantSave id="isPublic" label="Make it publicly available" canGate="update" :canResource="$database" />
                </div>
                <x-forms.input placeholder="8123" disabled="{{ $isPublic }}"
                    id="publicPort" label="Public Port" canGate="update" :canResource="$database" />
                <x-forms.textarea placeholder="# maxmemory 256mb
# maxmemory-policy allkeys-lru
# timeout 300"
                    helper="You only need to provide the Redis directives you want to override — Redis will use default values for everything else. <br/><br/>⚠️ <strong>Important:</strong> Coolify automatically applies the requirepass directive using the password shown in the Password field above. If you override requirepass in your custom configuration, make sure it matches the password field to avoid authentication issues. <br/><br/>🔗 <strong>Tip:</strong> <a target='_blank' class='underline dark:text-white' href='https://raw.githubusercontent.com/redis/redis/7.2/redis.conf'>View the full Redis default configuration</a> to see what options are available."
                    label="Custom ClickHouse Configuration" rows="10" id="clickhouseConf" canGate="update" :canResource="$database" />
            </div>
        </div>

        {{-- Section: Advanced --}}
        <div x-data="{ expanded: false }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-gray-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-500/30 group-hover:shadow-gray-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-gray-400 transition-colors">Advanced</h3>
                        <p class="text-sm text-gray-400">Docker options and log drain settings</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                <x-forms.input
                    helper="You can add custom docker run options that will be used when your container is started.<br>Note: Not all options are supported, as they could mess up Coolify's automation and could cause bad experience for users.<br><br>Check the <a class='underline dark:text-white' href='https://coolify.io/docs/knowledge-base/docker/custom-commands'>docs.</a>"
                    placeholder="--cap-add SYS_ADMIN --device=/dev/fuse --security-opt apparmor:unconfined --ulimit nofile=1024:1024 --tmpfs /run:rw,noexec,nosuid,size=65536k"
                    id="customDockerRunOptions" label="Custom Docker Options" canGate="update" :canResource="$database" />
                <x-forms.checkbox helper="Drain logs to your configured log drain endpoint in your Server settings."
                    instantSave="instantSaveAdvanced" id="isLogDrainEnabled" label="Drain Logs" canGate="update" :canResource="$database" />
            </div>
        </div>
    </form>
</div>
