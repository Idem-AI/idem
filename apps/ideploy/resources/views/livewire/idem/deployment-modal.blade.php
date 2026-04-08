<div>
    @if($showModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-center justify-center min-h-screen px-4 text-center">
                {{-- Background overlay --}}
                <div class="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm" wire:click="close"></div>

                <div class="relative inline-block w-full max-w-lg text-left bg-surface-1 rounded-glass overflow-hidden shadow-2xl transform transition-all border border-[rgba(255,255,255,0.05)]">
                    
                    {{-- Minimal Header --}}
                    <div class="px-6 py-5 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-surface-base">
                        <div>
                            <h3 class="text-sm font-medium text-text-primary" id="modal-title">Select Environment</h3>
                            <p class="text-[11px] text-text-tertiary mt-0.5">Choose the architectural path for deployment.</p>
                        </div>
                        <button wire:click="close" class="p-1.5 rounded hover:bg-surface-2 transition-colors text-text-tertiary hover:text-text-primary">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    {{-- The Choice: Stacked Minimal Grid --}}
                    <div class="divide-y divide-[rgba(255,255,255,0.05)]">
                        {{-- Path 1: Managed --}}
                        <div class="relative">
                            <input type="radio" id="deploy-managed" wire:model.live="deployOnManaged" value="true" class="sr-only peer">
                            <label for="deploy-managed" 
                                   class="group block p-6 cursor-pointer transition-colors hover:bg-surface-2
                                          peer-checked:bg-[rgba(20,71,230,0.02)]">
                                <div class="absolute left-0 top-0 bottom-0 w-[2px] bg-primary-500 scale-y-0 peer-checked:scale-y-100 transition-transform origin-center"></div>
                                
                                <div class="flex items-start justify-between">
                                    <div>
                                        <div class="flex items-center gap-2 mb-1.5">
                                            <h4 class="text-sm font-medium text-text-primary group-hover:text-primary-400 transition-colors">IDEM Managed Portal</h4>
                                            <span class="text-[9px] font-medium px-1.5 py-0.5 rounded border border-[rgba(255,255,255,0.05)] bg-surface-3 text-primary-400 uppercase tracking-widest">Recommended</span>
                                        </div>
                                        <p class="text-[11px] text-text-tertiary">Automated provisioning on our global infrastructure.</p>
                                    </div>
                                    
                                    {{-- Radio Ring --}}
                                    <div class="w-4 h-4 rounded-full border border-[rgba(255,255,255,0.1)] flex items-center justify-center mt-0.5 group-hover:border-[rgba(255,255,255,0.2)] transition-colors
                                                peer-checked:border-primary-500 peer-checked:group-hover:border-primary-400">
                                        <div class="w-2 h-2 rounded-full bg-primary-500 scale-0 peer-checked:scale-100 transition-transform"></div>
                                    </div>
                                </div>

                                @if($deployOnManaged)
                                    <div class="mt-5 pt-5 border-t border-[rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label class="block text-[10px] font-medium text-text-tertiary uppercase tracking-widest mb-2">Strategy Configuration</label>
                                        <x-forms.select wire:model="serverStrategy" class="bg-surface-1 border border-[rgba(255,255,255,0.05)] text-xs h-8 py-0 pl-2">
                                            @foreach($availableStrategies as $key => $label)
                                                <option value="{{ $key }}">{{ $label }}</option>
                                            @endforeach
                                        </x-forms.select>
                                    </div>
                                @endif
                            </label>
                        </div>

                        {{-- Path 2: Personal --}}
                        <div class="relative" x-data="{ showNoServersModal: false }">
                            <input type="radio" id="deploy-personal" wire:model.live="deployOnManaged" value="false" class="sr-only peer" @if(!$canAddServers) disabled @endif>
                            <label for="deploy-personal" 
                                   @if(count($personalServers ?? []) === 0) x-on:click.prevent="showNoServersModal = true" @endif
                                   class="group block p-6 cursor-pointer transition-colors hover:bg-surface-2
                                          peer-checked:bg-[rgba(34,211,238,0.02)]
                                          @if(!$canAddServers) opacity-50 cursor-not-allowed @endif">
                                <div class="absolute left-0 top-0 bottom-0 w-[2px] bg-accent-500 scale-y-0 peer-checked:scale-y-100 transition-transform origin-center"></div>
                                <div class="flex items-start justify-between">
                                    <div>
                                        <h4 class="text-sm font-medium text-text-primary group-hover:text-accent-400 transition-colors mb-1.5">Private Mesh Nodes</h4>
                                        <p class="text-[11px] text-text-tertiary">Connect and deploy to your own custom hardware.</p>
                                    </div>
                                    <div class="w-4 h-4 rounded-full border border-[rgba(255,255,255,0.1)] flex items-center justify-center mt-0.5 group-hover:border-[rgba(255,255,255,0.2)] transition-colors
                                                peer-checked:border-accent-500 peer-checked:group-hover:border-accent-400">
                                        <div class="w-2 h-2 rounded-full bg-accent-500 scale-0 peer-checked:scale-100 transition-transform"></div>
                                    </div>
                                </div>

                                @if(!$deployOnManaged && $canAddServers)
                                    <div class="mt-5 pt-5 border-t border-[rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label class="block text-[10px] font-medium text-text-tertiary uppercase tracking-widest mb-2">Target Node</label>
                                        @if($personalServers?->count() > 0)
                                            <x-forms.select wire:model="personalServerId" class="bg-surface-1 border border-[rgba(255,255,255,0.05)] text-xs h-8 py-0 pl-2">
                                                <option value="">Scan for node...</option>
                                                @foreach($personalServers as $server)
                                                    <option value="{{ $server->id }}">{{ $server->name }} @ {{ $server->ip }}</option>
                                                @endforeach
                                            </x-forms.select>
                                        @else
                                            <div class="flex items-center justify-between">
                                                <p class="text-xs text-text-tertiary">No active nodes detected in your mesh.</p>
                                                <a href="{{ route('server.create') }}" class="text-[10px] font-medium text-primary-400 border border-[rgba(255,255,255,0.05)] px-2 py-1 rounded bg-surface-3 hover:bg-surface-4 transition-colors">Link Node</a>
                                            </div>
                                        @endif
                                    </div>
                                @endif

                                @if(!$canAddServers)
                                    <div class="mt-3">
                                        <p class="text-[10px] font-medium text-orange-400 uppercase tracking-widest">
                                            Quota Reached ({{ $serverQuota['used'] }}/{{ $serverQuota['limit'] }})
                                        </p>
                                    </div>
                                @endif
                            </label>

                            {{-- The No Servers Modal --}}
                            <template x-teleport="body">
                                <div x-show="showNoServersModal" class="fixed inset-0 z-[100] flex items-center justify-center px-4" style="display: none;">
                                    <div x-show="showNoServersModal" 
                                         x-transition:enter="ease-out duration-300"
                                         x-transition:enter-start="opacity-0"
                                         x-transition:enter-end="opacity-100"
                                         x-transition:leave="ease-in duration-200"
                                         x-transition:leave-start="opacity-100"
                                         x-transition:leave-end="opacity-0"
                                         class="fixed inset-0 bg-black/60 backdrop-blur-sm" x-on:click="showNoServersModal = false"></div>
                                    
                                    <div x-show="showNoServersModal"
                                         x-transition:enter="ease-out duration-300"
                                         x-transition:enter-start="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                         x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100"
                                         x-transition:leave="ease-in duration-200"
                                         x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100"
                                         x-transition:leave-end="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                         class="relative bg-surface-1 border border-[rgba(255,255,255,0.05)] rounded-glass shadow-2xl p-6 sm:p-8 max-w-md w-full transform transition-all text-left">
                                        
                                        <div class="mb-6 flex items-start gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                                            </div>
                                            <div>
                                                <h3 class="text-sm font-medium text-text-primary mb-2">No Private Nodes Detected</h3>
                                                <p class="text-xs text-text-tertiary leading-relaxed">You don't have any personal servers. Please add a server first or choose IDEM Managed Servers.</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center justify-end gap-3 pt-6 border-t border-[rgba(255,255,255,0.05)]">
                                            <button type="button" x-on:click="showNoServersModal = false" class="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors px-3">Cancel</button>
                                            <a href="/servers" class="inner-button px-5 py-2 inline-flex items-center justify-center text-xs font-medium">Add Server</a>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>

                    {{-- Footer Actions --}}
                    <div class="px-6 py-4 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] flex items-center justify-end gap-3">
                        <button type="button" wire:click="close" class="text-xs font-medium text-text-tertiary hover:text-text-primary px-3 py-1.5 transition-colors">Cancel</button>
                        <button type="button" wire:click="confirm" class="inner-button px-5 py-2 text-xs font-medium">Confirm Path</button>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
