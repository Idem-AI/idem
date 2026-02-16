<div class="flex flex-col gap-4">
    @if (
        $resource->getMorphClass() == 'App\Models\Application' ||
            $resource->getMorphClass() == 'App\Models\StandalonePostgresql' ||
            $resource->getMorphClass() == 'App\Models\StandaloneRedis' ||
            $resource->getMorphClass() == 'App\Models\StandaloneMariadb' ||
            $resource->getMorphClass() == 'App\Models\StandaloneKeydb' ||
            $resource->getMorphClass() == 'App\Models\StandaloneDragonfly' ||
            $resource->getMorphClass() == 'App\Models\StandaloneClickhouse' ||
            $resource->getMorphClass() == 'App\Models\StandaloneMongodb' ||
            $resource->getMorphClass() == 'App\Models\StandaloneMysql')
        {{-- Header Idem Style --}}
        <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <h2 class="text-2xl font-bold text-light">
                        <span class="i-underline">Storages</span>
                    </h2>
                    <x-helper
                        helper="For Preview Deployments, storage has a <span class='text-helper'>-pr-#PRNumber</span> in their volume name, example: <span class='text-helper'>-pr-1</span>" />
                </div>
                @if ($resource?->build_pack !== 'dockercompose')
                    @can('update', $resource)
                        <div x-data="{
                            dropdownOpen: false,
                            volumeModalOpen: false,
                            fileModalOpen: false,
                            directoryModalOpen: false
                        }"
                            @close-storage-modal.window="
                            if ($event.detail === 'volume') volumeModalOpen = false;
                            if ($event.detail === 'file') fileModalOpen = false;
                            if ($event.detail === 'directory') directoryModalOpen = false;
                        ">
                            <div class="relative" @click.outside="dropdownOpen = false">
                                <x-forms.button @click="dropdownOpen = !dropdownOpen">
                                    + Add
                                    <svg class="w-4 h-4 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none"
                                        viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round"
                                            d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                                    </svg>
                                </x-forms.button>

                                <div x-show="dropdownOpen" @click.away="dropdownOpen=false"
                                    x-transition:enter="ease-out duration-200" x-transition:enter-start="opacity-0 -translate-y-2"
                                    x-transition:enter-end="opacity-100 translate-y-0" 
                                    x-transition:leave="ease-in duration-150" x-transition:leave-start="opacity-100 translate-y-0"
                                    x-transition:leave-end="opacity-0 -translate-y-2"
                                    class="absolute top-0 z-50 mt-12 min-w-max right-0"
                                    x-cloak>
                                    <div class="glass-card p-2 min-w-[200px]">
                                        <div class="flex flex-col gap-1">
                                            <button @click="volumeModalOpen = true; dropdownOpen = false" 
                                                class="flex items-center gap-3 px-3 py-2 text-sm text-light hover:bg-white/5 rounded transition-colors w-full text-left">
                                                <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>Volume Mount</span>
                                            </button>
                                            <button @click="fileModalOpen = true; dropdownOpen = false"
                                                class="flex items-center gap-3 px-3 py-2 text-sm text-light hover:bg-white/5 rounded transition-colors w-full text-left">
                                                <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                                <span>File Mount</span>
                                            </button>
                                            <button @click="directoryModalOpen = true; dropdownOpen = false"
                                                class="flex items-center gap-3 px-3 py-2 text-sm text-light hover:bg-white/5 rounded transition-colors w-full text-left">
                                                <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                <span>Directory Mount</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {{-- Volume Modal --}}
                            <template x-teleport="body">
                                <div x-show="volumeModalOpen" @keydown.window.escape="volumeModalOpen=false"
                                    class="fixed top-0 left-0 lg:px-0 px-4 z-99 flex items-center justify-center w-screen h-screen">
                                    <div x-show="volumeModalOpen" x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
                                        x-transition:leave="ease-in duration-100" x-transition:leave-start="opacity-100"
                                        x-transition:leave-end="opacity-0" @click="volumeModalOpen=false"
                                        class="absolute inset-0 w-full h-full bg-black/20 backdrop-blur-xs"></div>
                                    <div x-show="volumeModalOpen" x-trap.inert.noscroll="volumeModalOpen"
                                        x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0 -translate-y-2 sm:scale-95"
                                        x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave="ease-in duration-100"
                                        x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave-end="opacity-0 -translate-y-2 sm:scale-95"
                                        class="glass-card relative w-full py-6 min-w-full lg:min-w-[36rem] max-w-fit px-6">
                                        <div class="flex items-center justify-between pb-4 mb-4 border-b border-glass">
                                            <h3 class="text-2xl font-bold text-light">Add Volume Mount</h3>
                                            <button @click="volumeModalOpen=false"
                                                class="absolute top-0 right-0 flex items-center justify-center w-8 h-8 mt-5 mr-5 rounded-full text-light hover:bg-white/10 outline-0 transition-colors">
                                                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none"
                                                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="relative flex items-center justify-center w-auto"
                                            x-init="$watch('volumeModalOpen', value => {
                                                if (value) {
                                                    $nextTick(() => {
                                                        const input = $el.querySelector('input');
                                                        input?.focus();
                                                    })
                                                }
                                            })">
                                            <form class="flex flex-col w-full gap-4"
                                                wire:submit='submitPersistentVolume'>
                                                <div class="text-sm text-light opacity-70">
                                                    Docker Volumes mounted to the container.
                                                </div>
                                                @if ($isSwarm)
                                                    <div class="glass-card p-4 border-l-4 border-warning">
                                                        <div class="flex items-start gap-3">
                                                            <svg class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                            <div class="text-sm text-warning">
                                                                <span class="font-semibold">Swarm Mode detected:</span> You need to set a shared volume (EFS/NFS/etc) on all the worker nodes if you would like to use persistent volumes.
                                                            </div>
                                                        </div>
                                                    </div>
                                                @endif
                                                <div class="flex flex-col gap-2">
                                                    <x-forms.input canGate="update" :canResource="$resource" placeholder="pv-name"
                                                        id="name" label="Name" required helper="Volume name." />
                                                    @if ($isSwarm)
                                                        <x-forms.input canGate="update" :canResource="$resource"
                                                            placeholder="/root" id="host_path" label="Source Path" required
                                                            helper="Directory on the host system." />
                                                    @else
                                                        <x-forms.input canGate="update" :canResource="$resource"
                                                            placeholder="/root" id="host_path" label="Source Path"
                                                            helper="Directory on the host system." />
                                                    @endif
                                                    <x-forms.input canGate="update" :canResource="$resource"
                                                        placeholder="/tmp/root" id="mount_path" label="Destination Path"
                                                        required helper="Directory inside the container." />
                                                    <x-forms.button canGate="update" :canResource="$resource" type="submit">
                                                        Add
                                                    </x-forms.button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            {{-- File Modal --}}
                            <template x-teleport="body">
                                <div x-show="fileModalOpen" @keydown.window.escape="fileModalOpen=false"
                                    class="fixed top-0 left-0 lg:px-0 px-4 z-99 flex items-center justify-center w-screen h-screen">
                                    <div x-show="fileModalOpen" x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
                                        x-transition:leave="ease-in duration-100" x-transition:leave-start="opacity-100"
                                        x-transition:leave-end="opacity-0" @click="fileModalOpen=false"
                                        class="absolute inset-0 w-full h-full bg-black/20 backdrop-blur-xs"></div>
                                    <div x-show="fileModalOpen" x-trap.inert.noscroll="fileModalOpen"
                                        x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0 -translate-y-2 sm:scale-95"
                                        x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave="ease-in duration-100"
                                        x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave-end="opacity-0 -translate-y-2 sm:scale-95"
                                        class="glass-card relative w-full py-6 min-w-full lg:min-w-[36rem] max-w-fit px-6">
                                        <div class="flex items-center justify-between pb-4 mb-4 border-b border-glass">
                                            <h3 class="text-2xl font-bold text-light">Add File Mount</h3>
                                            <button @click="fileModalOpen=false"
                                                class="absolute top-0 right-0 flex items-center justify-center w-8 h-8 mt-5 mr-5 rounded-full text-light hover:bg-white/10 outline-0 transition-colors">
                                                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none"
                                                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="relative flex items-center justify-center w-auto"
                                            x-init="$watch('fileModalOpen', value => {
                                                if (value) {
                                                    $nextTick(() => {
                                                        const input = $el.querySelector('input');
                                                        input?.focus();
                                                    })
                                                }
                                            })">
                                            <form class="flex flex-col w-full gap-4"
                                                wire:submit='submitFileStorage'>
                                                <div class="text-sm text-light opacity-70">
                                                    Actual file mounted from the host system to the container.
                                                </div>
                                                <div class="flex flex-col gap-2">
                                                    <x-forms.input canGate="update" :canResource="$resource"
                                                        placeholder="/etc/nginx/nginx.conf" id="file_storage_path"
                                                        label="Destination Path" required
                                                        helper="File location inside the container" />
                                                    <x-forms.textarea canGate="update" :canResource="$resource" label="Content"
                                                        id="file_storage_content"></x-forms.textarea>
                                                    <x-forms.button canGate="update" :canResource="$resource" type="submit">
                                                        Add
                                                    </x-forms.button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            {{-- Directory Modal --}}
                            <template x-teleport="body">
                                <div x-show="directoryModalOpen" @keydown.window.escape="directoryModalOpen=false"
                                    class="fixed top-0 left-0 lg:px-0 px-4 z-99 flex items-center justify-center w-screen h-screen">
                                    <div x-show="directoryModalOpen" x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
                                        x-transition:leave="ease-in duration-100" x-transition:leave-start="opacity-100"
                                        x-transition:leave-end="opacity-0" @click="directoryModalOpen=false"
                                        class="absolute inset-0 w-full h-full bg-black/20 backdrop-blur-xs"></div>
                                    <div x-show="directoryModalOpen" x-trap.inert.noscroll="directoryModalOpen"
                                        x-transition:enter="ease-out duration-100"
                                        x-transition:enter-start="opacity-0 -translate-y-2 sm:scale-95"
                                        x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave="ease-in duration-100"
                                        x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
                                        x-transition:leave-end="opacity-0 -translate-y-2 sm:scale-95"
                                        class="glass-card relative w-full py-6 min-w-full lg:min-w-[36rem] max-w-fit px-6">
                                        <div class="flex items-center justify-between pb-4 mb-4 border-b border-glass">
                                            <h3 class="text-2xl font-bold text-light">Add Directory Mount</h3>
                                            <button @click="directoryModalOpen=false"
                                                class="absolute top-0 right-0 flex items-center justify-center w-8 h-8 mt-5 mr-5 rounded-full text-light hover:bg-white/10 outline-0 transition-colors">
                                                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none"
                                                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="relative flex items-center justify-center w-auto"
                                            x-init="$watch('directoryModalOpen', value => {
                                                if (value) {
                                                    $nextTick(() => {
                                                        const input = $el.querySelector('input');
                                                        input?.focus();
                                                    })
                                                }
                                            })">
                                            <form class="flex flex-col w-full gap-4"
                                                wire:submit='submitFileStorageDirectory'>
                                                <div class="text-sm text-light opacity-70">
                                                    Directory mounted from the host system to the container.
                                                </div>
                                                <div class="flex flex-col gap-2">
                                                    <x-forms.input canGate="update" :canResource="$resource"
                                                        placeholder="{{ application_configuration_dir() }}/{{ $resource->uuid }}/etc/nginx"
                                                        id="file_storage_directory_source" label="Source Directory"
                                                        required helper="Directory on the host system." />
                                                    <x-forms.input canGate="update" :canResource="$resource"
                                                        placeholder="/etc/nginx" id="file_storage_directory_destination"
                                                        label="Destination Directory" required
                                                        helper="Directory inside the container." />
                                                    <x-forms.button canGate="update" :canResource="$resource" type="submit">
                                                        Add
                                                    </x-forms.button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    @endcan
                @endif
            </div>
            <p class="text-sm text-light opacity-70">Persistent storage to preserve data between deployments.</p>
        </div>
        @if ($resource?->build_pack === 'dockercompose')
            <x-info-card type="warning" title="Docker Compose Storage">
                <x-slot:icon>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </x-slot:icon>
                Please modify storage layout in your Docker Compose file or reload the compose file to reread the storage layout.
            </x-info-card>
        @else
            @if ($resource->persistentStorages()->get()->count() === 0 && $fileStorage->count() == 0)
                <div class="glass-card p-6">
                    <p class="text-center text-light opacity-60">No storage found.</p>
                </div>
            @endif
        @endif

        @php
            $hasVolumes = $this->volumeCount > 0;
            $hasFiles = $this->fileCount > 0;
            $hasDirectories = $this->directoryCount > 0;
            $defaultTab = $hasVolumes ? 'volumes' : ($hasFiles ? 'files' : 'directories');
        @endphp

        @if ($hasVolumes || $hasFiles || $hasDirectories)
            <div x-data="{
                activeTab: '{{ $defaultTab }}'
            }">
                {{-- Tabs Navigation Idem Style --}}
                <div class="glass-card p-1 mb-4">
                    <div class="flex gap-2">
                        <button @click="activeTab = 'volumes'"
                            :class="activeTab === 'volumes' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                            @if (!$hasVolumes) disabled @endif
                            class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasVolumes ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                            <span class="flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                </svg>
                                <span>Volumes</span>
                                <span class="text-xs opacity-60">({{ $this->volumeCount }})</span>
                            </span>
                        </button>
                        <button @click="activeTab = 'files'"
                            :class="activeTab === 'files' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                            @if (!$hasFiles) disabled @endif
                            class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasFiles ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                            <span class="flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span>Files</span>
                                <span class="text-xs opacity-60">({{ $this->fileCount }})</span>
                            </span>
                        </button>
                        <button @click="activeTab = 'directories'"
                            :class="activeTab === 'directories' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                            @if (!$hasDirectories) disabled @endif
                            class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasDirectories ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                            <span class="flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span>Directories</span>
                                <span class="text-xs opacity-60">({{ $this->directoryCount }})</span>
                            </span>
                        </button>
                    </div>
                </div>

                {{-- Tab Content --}}
                <div class="pt-4">
                    {{-- Volumes Tab --}}
                    <div x-show="activeTab === 'volumes'" class="flex flex-col gap-4">
                        @if ($hasVolumes)
                            <livewire:project.shared.storages.all :resource="$resource" />
                        @else
                            <div class="glass-card p-8">
                                <p class="text-center text-light opacity-60">No volumes configured.</p>
                            </div>
                        @endif
                    </div>

                    {{-- Files Tab --}}
                    <div x-show="activeTab === 'files'" class="flex flex-col gap-4">
                        @if ($hasFiles)
                            @foreach ($this->files as $fs)
                                <livewire:project.service.file-storage :fileStorage="$fs"
                                    wire:key="file-{{ $fs->id }}" />
                            @endforeach
                        @else
                            <div class="glass-card p-8">
                                <p class="text-center text-light opacity-60">No file mounts configured.</p>
                            </div>
                        @endif
                    </div>

                    {{-- Directories Tab --}}
                    <div x-show="activeTab === 'directories'" class="flex flex-col gap-4">
                        @if ($hasDirectories)
                            @foreach ($this->directories as $fs)
                                <livewire:project.service.file-storage :fileStorage="$fs"
                                    wire:key="directory-{{ $fs->id }}" />
                            @endforeach
                        @else
                            <div class="glass-card p-8">
                                <p class="text-center text-light opacity-60">No directory mounts configured.</p>
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        @endif
    @else
        {{-- Header Idem Style (else section) --}}
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-light mb-2">
                <span class="i-underline">{{ Str::headline($resource->name) }}</span>
            </h2>
        </div>

        @if ($resource->persistentStorages()->get()->count() === 0 && $fileStorage->count() == 0)
            <div class="glass-card p-6">
                <p class="text-center text-light opacity-60">No storage found.</p>
            </div>
        @endif

            @php
                $hasVolumes = $this->volumeCount > 0;
                $hasFiles = $this->fileCount > 0;
                $hasDirectories = $this->directoryCount > 0;
                $defaultTab = $hasVolumes ? 'volumes' : ($hasFiles ? 'files' : 'directories');
            @endphp

            @if ($hasVolumes || $hasFiles || $hasDirectories)
                <div x-data="{
                    activeTab: '{{ $defaultTab }}'
                }">
                    {{-- Tabs Navigation Idem Style --}}
                    <div class="glass-card p-1 mb-4">
                        <div class="flex gap-2">
                            <button @click="activeTab = 'volumes'"
                                :class="activeTab === 'volumes' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                                @if (!$hasVolumes) disabled @endif
                                class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasVolumes ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                                <span class="flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Volumes</span>
                                    <span class="text-xs opacity-60">({{ $this->volumeCount }})</span>
                                </span>
                            </button>
                            <button @click="activeTab = 'files'"
                                :class="activeTab === 'files' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                                @if (!$hasFiles) disabled @endif
                                class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasFiles ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                                <span class="flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span>Files</span>
                                    <span class="text-xs opacity-60">({{ $this->fileCount }})</span>
                                </span>
                            </button>
                            <button @click="activeTab = 'directories'"
                                :class="activeTab === 'directories' ? 'bg-accent/20 text-accent border-accent/30' : 'text-light/70 hover:text-light hover:bg-white/5 border-transparent'"
                                @if (!$hasDirectories) disabled @endif
                                class="flex-1 px-4 py-2.5 font-medium transition-all rounded border {{ $hasDirectories ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed' }}">
                                <span class="flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    <span>Directories</span>
                                    <span class="text-xs opacity-60">({{ $this->directoryCount }})</span>
                                </span>
                            </button>
                        </div>
                    </div>

                    {{-- Tab Content --}}
                    <div class="pt-4">
                        {{-- Volumes Tab --}}
                        <div x-show="activeTab === 'volumes'" class="flex flex-col gap-4">
                            @if ($hasVolumes)
                                <livewire:project.shared.storages.all :resource="$resource" />
                            @else
                                <div class="glass-card p-8">
                                    <p class="text-center text-light opacity-60">No volumes configured.</p>
                                </div>
                            @endif
                        </div>

                        {{-- Files Tab --}}
                        <div x-show="activeTab === 'files'" class="flex flex-col gap-4">
                            @if ($hasFiles)
                                @foreach ($this->files as $fs)
                                    <livewire:project.service.file-storage :fileStorage="$fs"
                                        wire:key="file-{{ $fs->id }}" />
                                @endforeach
                            @else
                                <div class="glass-card p-8">
                                    <p class="text-center text-light opacity-60">No file mounts configured.</p>
                                </div>
                            @endif
                        </div>

                        {{-- Directories Tab --}}
                        <div x-show="activeTab === 'directories'" class="flex flex-col gap-4">
                            @if ($hasDirectories)
                                @foreach ($this->directories as $fs)
                                    <livewire:project.service.file-storage :fileStorage="$fs"
                                        wire:key="directory-{{ $fs->id }}" />
                                @endforeach
                            @else
                                <div class="glass-card p-8">
                                    <p class="text-center text-light opacity-60">No directory mounts configured.</p>
                                </div>
                            @endif
                        </div>
                    </div>
                </div>
            @endif
        </div>
    @endif
</div>
