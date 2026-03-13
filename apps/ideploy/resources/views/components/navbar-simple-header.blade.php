{{-- Header Sidebar comme Main App --}}
<div class="px-5 py-4 border-b border-white/5">
    <div class="flex items-center gap-3">
        <button class="lg:hidden p-2 rounded-lg hover:bg-white/5">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
        </button>
        
        <img src="{{ asset('ideploy-logo.svg') }}" alt="IDEM" class="w-12 h-12 rounded-xl" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="w-12 h-12 bg-[#0046FF] rounded-xl flex items-center justify-center font-black text-white text-xl" style="display:none;">ID</div>
        
        <span class="text-2xl font-bold text-white">IDEM</span>
        <span class="ml-auto px-2.5 py-1 text-xs font-semibold bg-orange-500/20 text-orange-400 rounded-full">Beta</span>
    </div>
</div>
