<div>
    @if($compact)
        {{-- Version compacte pour navigation --}}
        <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full
            {{ $quota['percentage'] >= 80 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
               ($quota['percentage'] >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
               'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200') }}">
            {{ $quota['used'] }}/{{ $quota['unlimited'] ? '∞' : $quota['limit'] }}
        </span>
    @else
        {{-- Version complète avec détails --}}
        <div class="flex items-center justify-between">
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {{ $type === 'apps' ? 'Applications' : 'Servers' }}
                    </span>
                    <span class="text-sm font-semibold {{ $quota['percentage'] >= 80 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white' }}">
                        {{ $quota['used'] }} / {{ $quota['unlimited'] ? '∞' : $quota['limit'] }}
                    </span>
                </div>
                
                @if(!$quota['unlimited'])
                    <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div class="h-2 rounded-full transition-all duration-300
                            {{ $quota['percentage'] >= 80 ? 'bg-red-600' : 
                               ($quota['percentage'] >= 50 ? 'bg-yellow-500' : 'bg-green-500') }}"
                            style="width: {{ min($quota['percentage'], 100) }}%">
                        </div>
                    </div>
                    
                    @if($showDetails && $quota['percentage'] >= 80)
                        <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                            ⚠️ Limit almost reached. 
                            <a href="{{ route('idem.subscription') }}" class="underline font-medium hover:text-red-700 dark:hover:text-red-300">
                                Upgrade now
                            </a>
                        </p>
                    @endif
                @else
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ✨ Unlimited
                    </p>
                @endif
            </div>
        </div>
    @endif
</div>
