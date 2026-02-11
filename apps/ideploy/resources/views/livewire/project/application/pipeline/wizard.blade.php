<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
    <div class="max-w-4xl mx-auto">
        
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-4xl font-bold text-slate-900 mb-2">
                        🚀 Configuration du Pipeline CI/CD
                    </h1>
                    <p class="text-slate-600">
                        {{ $application->name }} • {{ ucfirst($this->selectedTemplate ?? 'Détection...') }}
                    </p>
                </div>
                <div class="text-right">
                    <div class="text-4xl font-bold text-blue-600">{{ $this->getStepProgress() }}%</div>
                    <p class="text-sm text-slate-600">Étape {{ $this->currentStep }} / {{ $this::TOTAL_STEPS }}</p>
                </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                    class="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                    style="width: {{ $this->getStepProgress() }}%"
                ></div>
            </div>
        </div>
        
        <!-- Step Indicators -->
        <div class="mb-8 grid grid-cols-5 gap-2">
            @for ($i = 1; $i <= $this::TOTAL_STEPS; $i++)
                <button
                    wire:click="goToStep({{ $i }})"
                    class="py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200
                        {{ $this->currentStep === $i 
                            ? 'bg-blue-600 text-white shadow-lg scale-105' 
                            : ($i < $this->currentStep 
                                ? 'bg-green-500 text-white' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            ) }}"
                >
                    @if ($i < $this->currentStep)
                        ✓
                    @else
                        {{ $i }}
                    @endif
                </button>
            @endfor
        </div>
        
        <!-- Main Content -->
        <div class="bg-white rounded-xl shadow-lg p-8 mb-8">
            
            <!-- Error Message -->
            @if ($this->errorMessage)
                <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-red-700 font-medium">⚠️ {{ $this->errorMessage }}</p>
                </div>
            @endif
            
            <!-- Success Message -->
            @if ($this->successMessage)
                <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p class="text-green-700 font-medium">{{ $this->successMessage }}</p>
                </div>
            @endif
            
            <h2 class="text-2xl font-bold text-slate-900 mb-6">
                {{ $this->getStepTitle() }}
            </h2>
            
            <!-- Step 1: Template Selection -->
            @if ($this->currentStep === 1)
                @include('livewire.project.application.pipeline.wizard-step-1')
            @endif
            
            <!-- Step 2: Trigger Configuration -->
            @if ($this->currentStep === 2)
                @include('livewire.project.application.pipeline.wizard-step-2')
            @endif
            
            <!-- Step 3: Stages Configuration -->
            @if ($this->currentStep === 3)
                @include('livewire.project.application.pipeline.wizard-step-3')
            @endif
            
            <!-- Step 4: Notifications -->
            @if ($this->currentStep === 4)
                @include('livewire.project.application.pipeline.wizard-step-4')
            @endif
            
            <!-- Step 5: Review & Confirm -->
            @if ($this->currentStep === 5)
                @include('livewire.project.application.pipeline.wizard-step-5')
            @endif
            
        </div>
        
        <!-- Navigation Buttons -->
        <div class="flex justify-between items-center gap-4">
            <!-- Previous Button -->
            <button
                @if ($this->currentStep > 1)
                    wire:click="previousStep"
                @else
                    disabled
                @endif
                class="px-6 py-3 rounded-lg font-medium transition-all duration-200
                    {{ $this->currentStep > 1
                        ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }}"
            >
                ← Précédent
            </button>
            
            <!-- Step Indicator -->
            <div class="text-sm text-slate-600 font-medium">
                Étape {{ $this->currentStep }} sur {{ $this::TOTAL_STEPS }}
            </div>
            
            <!-- Next / Finish Button -->
            @if ($this->currentStep < $this::TOTAL_STEPS)
                <button
                    wire:click="nextStep"
                    class="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium 
                        hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    @if (!$this->validateCurrentStep()) disabled @endif
                >
                    Suivant →
                </button>
            @else
                <button
                    wire:click="savePipeline"
                    @if ($this->isLoading) disabled @endif
                    class="px-6 py-3 bg-green-600 text-white rounded-lg font-medium 
                        hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center gap-2"
                >
                    @if ($this->isLoading)
                        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sauvegarde...
                    @else
                        ✅ Terminer & Sauvegarder
                    @endif
                </button>
            @endif
        </div>
        
    </div>
</div>
