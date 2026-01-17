<div class="min-h-screen bg-[#0a0a0a] text-white p-8">
    
    {{-- Header --}}
    <div class="max-w-6xl mx-auto mb-8">
        @if($step !== 'mode')
        <button wire:click="back" class="mb-4 text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            BACK
        </button>
        @endif
        <h1 class="text-3xl font-bold mb-2">Development Configuration</h1>
        <p class="text-gray-400">Configure your application development settings</p>
    </div>
    
    {{-- Content --}}
    <div class="max-w-6xl mx-auto">
        
        @if($step === 'mode')
            @include('livewire.project.resource.wizard.step-mode')
        @elseif($step === 'config')
            @include('livewire.project.resource.wizard.step-architecture')
        @elseif($step === 'summary')
            @include('livewire.project.resource.wizard.step-summary')
        @endif
        
    </div>
    
</div>
