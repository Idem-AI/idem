<div x-data="{ activeTab: 'basic' }">
    <form wire:submit="submit" class="max-w-7xl pb-32">
        {{-- Hero Header Ultra-Moderne --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-600/10 to-pink-600/10 border border-blue-500/20 p-8 mb-8">
            <div class="absolute inset-0 opacity-10">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.3),transparent_50%)]" style="animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
            </div>
            
            <div class="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-3xl font-bold text-white mb-1">MariaDB Database</h1>
                            <p class="text-sm text-gray-400">Configure your database settings and credentials</p>
                        </div>
                    </div>
                </div>
                
                @can('update', $database)
                    <button type="submit" class="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 whitespace-nowrap">
                        <div class="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
        <div class="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="flex-1">
                    <p class="text-sm font-medium text-orange-400">Important</p>
                    <p class="text-sm text-gray-300 mt-1">If you change the values in the database, please sync it here, otherwise automations (like backups) won't work.</p>
                </div>
            </div>
        </div>

        {{-- Section: Basic Information --}}
        <div x-data="{ expanded: true }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Basic Information</h3>
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
                        helper="For all available images, check here:<br><br><a target='_blank' href='https://hub.docker.com/_/mariadb'>https://hub.docker.com/_/mariadb</a>" canGate="update" :canResource="$database" />
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
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <x-forms.input label="Root Password" id="mariadbRootPassword" type="password" required
                            helper="If you change this in the database, please sync it here, otherwise automations (like backups) won't work." canGate="update" :canResource="$database" />
                        <x-forms.input label="Normal User" id="mariadbUser" required
                            helper="If you change this in the database, please sync it here, otherwise automations (like backups) won't work." canGate="update" :canResource="$database" />
                        <x-forms.input label="Normal User Password" id="mariadbPassword" type="password" required
                            helper="If you change this in the database, please sync it here, otherwise automations (like backups) won't work." canGate="update" :canResource="$database" />
                    </div>
                    <x-forms.input label="Initial Database" id="mariadbDatabase"
                        placeholder="If empty, it will be the same as Username." readonly
                        helper="You can only change this in the database." canGate="update" :canResource="$database" />
                @else
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <x-forms.input label="Root Password" id="mariadbRootPassword" type="password"
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                        <x-forms.input label="Normal User" id="mariadbUser" required
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                        <x-forms.input label="Normal User Password" id="mariadbPassword" type="password" required
                            helper="You can only change this in the database." canGate="update" :canResource="$database" />
                    </div>
                    <x-forms.input label="Initial Database" id="mariadbDatabase"
                        placeholder="If empty, it will be the same as Username."
                        helper="You can only change this in the database." canGate="update" :canResource="$database" />
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
                <x-forms.input placeholder="3000:5432" id="portsMappings" label="Ports Mappings"
                    helper="A comma separated list of ports you would like to map to the host system.<br><span class='inline-block font-bold dark:text-warning'>Example</span>3000:5432,3002:5433" canGate="update" :canResource="$database" />
                <x-forms.input label="MariaDB URL (internal)"
                    helper="If you change the user/password/port, this could be different. This is with the default values."
                    type="password" readonly wire:model="db_url" />
                @if ($db_url_public)
                    <x-forms.input label="MariaDB URL (public)"
                        helper="If you change the user/password/port, this could be different. This is with the default values."
                        type="password" readonly wire:model="db_url_public" />
                @endif
            </div>
        </div>

        {{-- Section: SSL Configuration --}}
        <div x-data="{ expanded: false }" class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 mb-6">
            <div @click="expanded = !expanded" class="flex items-center justify-between p-6 cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all duration-300 group-hover:scale-110">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">SSL Configuration</h3>
                        <p class="text-sm text-gray-400">Secure connections and certificates</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    @if ($enableSsl && $certificateValidUntil)
                        <x-modal-confirmation title="Regenerate SSL Certificates"
                            buttonTitle="Regenerate SSL Certificates" :actions="[
                                'The SSL certificate of this database will be regenerated.',
                                'You must restart the database after regenerating the certificate to start using the new certificate.',
                            ]"
                            submitAction="regenerateSslCertificate" :confirmWithText="false" :confirmWithPassword="false" />
                    @endif
                    <span class="text-xs text-gray-500 font-medium" x-text="expanded ? 'Click to collapse' : 'Click to expand'"></span>
                    <svg :class="expanded ? 'rotate-180' : ''" class="w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            
            <div x-show="expanded" x-collapse x-cloak class="px-6 pb-6">
                @if ($enableSsl && $certificateValidUntil)
                    <div class="mb-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                        <p class="text-sm text-gray-300 mb-2">Certificate Valid Until:</p>
                        @if (now()->gt($certificateValidUntil))
                            <p class="text-red-400 font-semibold">{{ $certificateValidUntil->format('d.m.Y H:i:s') }} - Expired</p>
                        @elseif(now()->addDays(30)->gt($certificateValidUntil))
                            <p class="text-orange-400 font-semibold">{{ $certificateValidUntil->format('d.m.Y H:i:s') }} - Expiring soon</p>
                        @else
                            <p class="text-green-400 font-semibold">{{ $certificateValidUntil->format('d.m.Y H:i:s') }}</p>
                        @endif
                    </div>
                @endif
                
                <div class="mb-4">
                    @if (str($database->status)->contains('exited'))
                        <x-forms.checkbox id="enableSsl" label="Enable SSL"
                            wire:model.live="enableSsl" instantSave="instantSaveSSL" canGate="update" :canResource="$database" />
                    @else
                        <x-forms.checkbox id="enableSsl" label="Enable SSL"
                            wire:model.live="enableSsl" instantSave="instantSaveSSL" disabled
                            helper="Database should be stopped to change this settings." />
                    @endif
                </div>
                @if ($enableSsl)
                    <div class="mx-2">
                        @if (str($database->status)->contains('exited'))
                            <x-forms.select id="sslMode" label="SSL Mode" wire:model.live="sslMode"
                                instantSave="instantSaveSSL"
                                helper="Choose the SSL verification mode for MySQL connections" canGate="update" :canResource="$database">
                                <option value="PREFERRED" title="Prefer secure connections">Prefer (secure)</option>
                                <option value="REQUIRED" title="Require secure connections">Require (secure)</option>
                                <option value="VERIFY_CA" title="Verify CA certificate">Verify CA (secure)</option>
                                <option value="VERIFY_IDENTITY" title="Verify full certificate">Verify Full (secure)
                                </option>
                            </x-forms.select>
                        @else
                            <x-forms.select id="sslMode" label="SSL Mode" instantSave="instantSaveSSL"
                                disabled helper="Database should be stopped to change this settings.">
                                <option value="PREFERRED" title="Prefer secure connections">Prefer (secure)</option>
                                <option value="REQUIRED" title="Require secure connections">Require (secure)</option>
                                <option value="VERIFY_CA" title="Verify CA certificate">Verify CA (secure)</option>
                                <option value="VERIFY_IDENTITY" title="Verify full certificate">Verify Full (secure)
                                </option>
                            </x-forms.select>
                        @endif
                    </div>
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
                    @if (data_get($database, 'is_public'))
                        <x-slide-over fullScreen>
                            <x-slot:title>Proxy Logs</x-slot:title>
                            <x-slot:content>
                                <livewire:project.shared.get-logs :server="$server" :resource="$database"
                                    container="{{ data_get($database, 'uuid') }}-proxy" lazy />
                            </x-slot:content>
                            <x-forms.button disabled="{{ !data_get($database, 'is_public') }}"
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
                <x-forms.input placeholder="5432" disabled="{{ $isPublic }}"
                    id="publicPort" label="Public Port" canGate="update" :canResource="$database" />
                <x-forms.textarea label="Custom Mysql Configuration" rows="10" id="mariadbConf" canGate="update" :canResource="$database" />
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
