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
                    <span class="text-[#4F46E5]">Docker Swarm</span> <span class="text-gray-600">(experimental)</span> - <a class='text-[#4F46E5] hover:text-[#6366F1] underline' href='https://ideploy.io/docs/knowledge-base/docker/swarm' target='_blank'>docs</a> |
                    <span class="text-gray-500">⚠️ Non-root experimental - <a class="text-[#4F46E5] hover:text-[#6366F1] underline" target="_blank" href="https://ideploy.io/docs/knowledge-base/server/non-root-user">docs</a></span>
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
