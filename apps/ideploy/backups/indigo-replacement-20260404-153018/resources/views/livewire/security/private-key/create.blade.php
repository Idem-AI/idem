<div class="p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
    {{-- Info Section --}}
    <div class="mb-6 p-4 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg">
        <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="text-sm text-gray-300">
                <p class="mb-1">Private Keys are used to connect to your servers without passwords.</p>
                <p class="font-semibold text-[#4F46E5]">You should not use passphrase protected keys.</p>
            </div>
        </div>
    </div>
    
    {{-- Generate Buttons --}}
    <div class="flex gap-3 mb-6">
        <button 
            type="button"
            wire:click="generateNewEDKey" 
            class="flex-1 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors text-sm">
            Generate ED25519 Key
        </button>
        <button 
            type="button"
            wire:click="generateNewRSAKey"
            class="px-4 py-2.5 border border-[#4F46E5] text-[#4F46E5] hover:bg-[#4F46E5]/10 font-semibold rounded-lg transition-colors text-sm">
            Generate RSA Key
        </button>
    </div>
    
    <form class="flex flex-col gap-4" wire:submit='createPrivateKey'>
        <div class="flex gap-2">
            <x-forms.input id="name" label="Name" required />
            <x-forms.input id="description" label="Description" />
        </div>
        <x-forms.textarea realtimeValidation id="value" rows="10"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" label="Private Key" required />
        <x-forms.input id="publicKey" readonly label="Public Key" />
        
        {{-- Warning --}}
        <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div class="text-sm">
                    <p class="font-semibold text-amber-400 mb-1">ACTION REQUIRED</p>
                    <p class="text-gray-300">Copy the 'Public Key' to your server's <code class="px-1.5 py-0.5 bg-[#0a0e1a] rounded text-xs">~/.ssh/authorized_keys</code> file</p>
                </div>
            </div>
        </div>
        
        {{-- Submit Button --}}
        <div class="flex justify-end pt-2">
            <button 
                type="submit"
                class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                Continue
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
            </button>
        </div>
    </form>
</div>
