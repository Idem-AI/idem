{{-- Footer Sidebar avec Crédits et Avatar --}}
<div class="px-4 py-3 border-t border-white/5">
    @auth
        @php
            $isAdmin = auth()->user()->isIdemAdmin();
            $team = auth()->user()->currentTeam();
            $credits = $team->idem_credits ?? 0;
        @endphp
        
        <div class="flex items-center justify-between gap-3">
            {{-- Crédits (si non-admin) --}}
            @if(!$isAdmin)
                <div class="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <span class="text-xs font-medium text-emerald-400">{{ number_format($credits) }} €</span>
                </div>
            @endif
            
            {{-- Avatar Utilisateur --}}
            <div x-data="{ open: false }" class="relative ml-auto">
                <button @click="open = !open" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    @if(auth()->user()->photo_url)
                        <img src="{{ auth()->user()->photo_url }}" 
                             alt="{{ auth()->user()->name }}" 
                             class="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30">
                    @else
                        <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span class="text-sm font-bold text-white">
                                {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                            </span>
                        </div>
                    @endif
                </button>
            </div>
        </div>
    @endauth
</div>
