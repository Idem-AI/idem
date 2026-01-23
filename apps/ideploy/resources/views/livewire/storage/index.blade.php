<div class="min-h-screen bg-[#0a0e1a] text-white p-6">
    <x-slot:title>
        Storages | Coolify
    </x-slot>
    
    {{-- Header --}}
    <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl font-light text-gray-100">S3 Storages</h1>
            @can('create', App\Models\S3Storage::class)
                <x-modal-input buttonTitle="+ Add" title="New S3 Storage" :closeOutside="false">
                    <x-slot:content>
                        <button class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:shadow-lg hover:scale-105">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add
                        </button>
                    </x-slot:content>
                    <livewire:storage.create />
                </x-modal-input>
            @endcan
        </div>
        <p class="text-sm text-gray-400">S3 storages for backups.</p>
    </div>

    {{-- Storages Grid --}}
    <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        @forelse ($s3 as $storage)
            <a href="/storages/{{ $storage->uuid }}" class="group block">
                <div @class([
                    'bg-[#151b2e] hover:bg-[#1a2137] border hover:border-gray-600 rounded-xl overflow-hidden transition-all duration-300',
                    'border-red-500' => !$storage->is_usable,
                    'border-gray-700' => $storage->is_usable,
                ])>
                    {{-- Header --}}
                    <div class="p-5 border-b border-gray-700/50">
                        <div class="flex items-start gap-3">
                            {{-- Storage Icon --}}
                            <div @class([
                                'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg',
                                'bg-gradient-to-br from-orange-500 to-amber-600' => $storage->is_usable,
                                'bg-gradient-to-br from-red-500 to-rose-600' => !$storage->is_usable,
                            ])>
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                                </svg>
                            </div>
                            
                            {{-- Storage Info --}}
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
                                        {{ $storage->name }}
                                    </h3>
                                    {{-- Status Badge --}}
                                    @if ($storage->is_usable)
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                            Usable
                                        </span>
                                    @else
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                            Not Usable
                                        </span>
                                    @endif
                                </div>
                                <p class="text-sm text-gray-400 line-clamp-2">{{ $storage->description ?: 'No description' }}</p>
                            </div>
                        </div>
                    </div>
                    
                    {{-- Footer --}}
                    <div class="px-5 py-4 bg-gray-900/20">
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2 text-gray-400">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                                </svg>
                                <span class="truncate">S3 Storage</span>
                            </div>
                            <svg class="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </a>
        @empty
            {{-- Empty State --}}
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No storage found</h3>
                <p class="text-sm text-gray-500 mb-4">Add an S3 storage to enable backups</p>
                @can('create', App\Models\S3Storage::class)
                    <x-modal-input buttonTitle="Add Storage" title="New S3 Storage" :closeOutside="false">
                        <livewire:storage.create />
                    </x-modal-input>
                @endcan
            </div>
        @endforelse
    </div>
</div>
