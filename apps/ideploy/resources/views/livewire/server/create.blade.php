<div class="w-full">

    {{-- Page header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                </svg>
            </div>
            <div class="flex-1">
                <h1 class="text-xl font-bold text-white">New Server</h1>
                <p class="text-sm text-gray-400">Connect a server via IP address or domain with SSH</p>
            </div>
            {{-- Server quota inline --}}
            <div class="flex items-center gap-3 px-4 py-2 bg-[#0a0e1a] border border-gray-800 rounded-lg">
                <svg class="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                </svg>
                <div class="text-xs">
                    <span class="text-gray-400">Quota: </span>
                    @livewire('idem.quota-badge', ['type' => 'servers', 'showDetails' => false])
                </div>
            </div>
        </div>
    </div>

    @if($limit_reached)
        <div class="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <svg class="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <div>
                <h3 class="text-sm font-semibold text-red-400 mb-1">Server Limit Reached</h3>
                <p class="text-sm text-gray-300">
                    You've reached your server limit.
                    <a href="{{ route('idem.subscription') }}" class="text-primary hover:text-primary/80 font-medium underline">Upgrade your plan</a>
                    to add more servers.
                </p>
            </div>
        </div>
    @endif

    @if($private_keys->count() === 0)
        <div class="p-6 bg-[#0f1724] rounded-xl border border-amber-500/30">
            <div class="flex items-start gap-4">
                <div class="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <h3 class="text-sm font-semibold text-amber-400 mb-1">Private Key Required</h3>
                    <p class="text-sm text-gray-400 mb-4">You need to create a private key before you can add a server. Private keys are used for SSH authentication.</p>
                    <livewire:security.private-key.create from="server" />
                </div>
            </div>
        </div>
    @else
        <livewire:server.new.by-ip :private_keys="$private_keys" :limit_reached="$limit_reached" />
    @endif

</div>
