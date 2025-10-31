<div>
    @if($canProceed === false)
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
            <div class="flex items-start">
                <svg class="w-6 h-6 text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div class="flex-1">
                    <h3 class="text-red-200 font-bold mb-1">{{ __('Quota Limit Reached') }}</h3>
                    <p class="text-red-300 text-sm mb-3">{{ $message }}</p>
                    
                    @if($suggestedPlan)
                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <a href="{{ route('idem.plans') }}" 
                               class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                                </svg>
                                {{ __('Upgrade to :plan', ['plan' => $suggestedPlan]) }}
                            </a>
                            <a href="{{ route('idem.subscription') }}" 
                               class="text-blue-400 hover:text-blue-300 text-sm underline">
                                {{ __('View subscription details') }}
                            </a>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        {{-- Désactiver le formulaire si quota atteint --}}
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                // Désactiver tous les boutons de soumission
                const submitButtons = document.querySelectorAll('button[type="submit"], button[wire\\:click*="save"], button[wire\\:click*="store"], button[wire\\:click*="create"]');
                submitButtons.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    btn.title = '{{ $message }}';
                });

                // Désactiver les inputs
                const inputs = document.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    input.disabled = true;
                    input.classList.add('opacity-50');
                });
            });
        </script>
    @elseif($canProceed === true)
        <div class="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4">
            <div class="flex items-center">
                <svg class="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div class="flex-1">
                    <p class="text-green-200 text-sm">
                        @if($quotaType === 'app')
                            {{ __('You can create this application') }} ({{ $currentUsage }}/{{ $limit }} used)
                        @else
                            {{ __('You can add this server') }} ({{ $currentUsage }}/{{ $limit }} used)
                        @endif
                    </p>
                </div>
            </div>
        </div>
    @endif
</div>
