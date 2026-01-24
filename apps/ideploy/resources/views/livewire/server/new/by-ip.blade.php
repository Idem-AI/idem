<div class="w-full">
    @if ($limit_reached)
        <x-limit-reached name="servers" />
    @else
        <form class="flex flex-col w-full gap-3 p-6 bg-[#0a0e1a] rounded-xl border border-gray-800/50" wire:submit='submit'>
            {{-- Main Fields in One Row --}}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <x-forms.input id="name" label="Name" required />
                <x-forms.input id="ip" label="IP/Domain" required helper="IP or domain" />
                <x-forms.input type="number" id="port" label="Port" required />
                <x-forms.input id="user" label="User" required />
            </div>

            {{-- Second Row --}}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <x-forms.input id="description" label="Description" />
                <x-forms.select label="Private Key" id="private_key_id">
                    <option disabled>Select a private key</option>
                    @foreach ($private_keys as $key)
                        @if ($loop->first)
                            <option selected value="{{ $key->id }}">{{ $key->name }}</option>
                        @else
                            <option value="{{ $key->id }}">{{ $key->name }}</option>
                        @endif
                    @endforeach
                </x-forms.select>
                <div class="flex items-end">
                    <x-forms.checkbox instantSave type="checkbox" id="is_build_server" label="Build Server?" />
                </div>
            </div>
            
            {{-- Swarm Options (Collapsed) --}}
            <div class="border-t border-gray-800/30 pt-2 mt-1">
                <div class="text-xs text-gray-400 mb-2">
                    <span class="text-[#4F46E5]">Docker Swarm</span> <span class="text-gray-600">(experimental)</span> - <a class='text-[#4F46E5] hover:text-[#6366F1] underline' href='https://coolify.io/docs/knowledge-base/docker/swarm' target='_blank'>docs</a> | 
                    <span class="text-gray-500">⚠️ Non-root experimental - <a class="text-[#4F46E5] hover:text-[#6366F1] underline" target="_blank" href="https://coolify.io/docs/knowledge-base/server/non-root-user">docs</a></span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    @if ($is_swarm_worker || $is_build_server)
                        <x-forms.checkbox disabled instantSave type="checkbox" id="is_swarm_manager" label="Swarm Manager?" />
                    @else
                        <x-forms.checkbox type="checkbox" instantSave id="is_swarm_manager" label="Swarm Manager?" />
                    @endif
                    
                    @if ($is_swarm_manager || $is_build_server)
                        <x-forms.checkbox disabled instantSave type="checkbox" id="is_swarm_worker" label="Swarm Worker?" />
                    @else
                        <x-forms.checkbox type="checkbox" instantSave id="is_swarm_worker" label="Swarm Worker?" />
                    @endif
                    
                    @if ($is_swarm_worker && count($swarm_managers) > 0)
                        <div class="col-span-2">
                            <x-forms.select label="Swarm Cluster" id="selected_swarm_cluster" required>
                                @foreach ($swarm_managers as $server)
                                    @if ($loop->first)
                                        <option selected value="{{ $server->id }}">{{ $server->name }}</option>
                                    @else
                                        <option value="{{ $server->id }}">{{ $server->name }}</option>
                                    @endif
                                @endforeach
                            </x-forms.select>
                        </div>
                    @endif
                </div>
            </div>
            
            {{-- Géolocalisation & Spécifications (Admins uniquement) --}}
            @if(auth()->user() && auth()->user()->idem_role === 'admin')
                <div class="border-t border-red-500/20 pt-4 mt-3">
                    <div class="flex items-center gap-2 mb-3">
                        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"></path>
                        </svg>
                        <h4 class="text-sm font-semibold text-red-400">Admin: Géolocalisation & Spécifications</h4>
                        <span class="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">ADMIN ONLY</span>
                    </div>
                    
                    {{-- Géolocalisation --}}
                    <div class="mb-4">
                        <h5 class="text-xs font-medium text-gray-400 mb-2">📍 Géolocalisation</h5>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <x-forms.select label="Pays" id="country_code" helper="Sélectionnez le pays du serveur">
                                <option value="">-- Sélectionner --</option>
                                @foreach($african_countries as $country)
                                    <option value="{{ $country['code'] }}">{{ $country['name'] }}</option>
                                @endforeach
                            </x-forms.select>
                            <x-forms.input id="city" label="Ville" helper="Ex: Douala, Dakar" />
                            <x-forms.input type="number" step="0.000001" id="latitude" label="Latitude" helper="Ex: 4.0511" />
                            <x-forms.input type="number" step="0.000001" id="longitude" label="Longitude" helper="Ex: 9.7679" />
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                            Région auto-remplie: <span class="text-blue-400 font-medium">{{ $region ?? 'Non définie' }}</span>
                        </div>
                    </div>
                    
                    {{-- Spécifications --}}
                    <div class="mb-4">
                        <h5 class="text-xs font-medium text-gray-400 mb-2">⚙️ Spécifications Serveur</h5>
                        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <x-forms.input type="number" id="cpu_cores" label="CPU Cores" helper="Ex: 8" />
                            <x-forms.input type="number" id="ram_mb" label="RAM (MB)" helper="Ex: 16384" />
                            <x-forms.input type="number" id="disk_gb" label="Disk (GB)" helper="Ex: 500" />
                            <x-forms.input type="number" id="max_applications" label="Max Apps" helper="Limite d'apps" />
                            <div class="flex items-end">
                                <x-forms.checkbox type="checkbox" id="is_available" label="Disponible?" />
                            </div>
                        </div>
                    </div>
                </div>
            @endif
            
            {{-- Submit Button --}}
            <div class="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-800/30">
                <button type="submit" 
                        class="px-6 py-2 text-sm font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-all flex items-center gap-2">
                    Continue
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                </button>
            </div>
        </form>
    @endif
</div>
