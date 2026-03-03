@props([
    'message' => 'Information',
    'type' => 'info', // 'info', 'warning', 'success', 'error'
    'position' => 'top', // 'top', 'bottom', 'left', 'right'
    'class' => ''
])

<div class="group relative inline-flex items-center {{ $class }}">
    {{-- Info Icon --}}
    <button type="button" class="flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300 hover:scale-110"
        :class="{
            'text-accent hover:text-primary': @js($type) === 'info',
            'text-warning hover:text-danger': @js($type) === 'warning',
            'text-success hover:text-primary': @js($type) === 'success',
            'text-danger': @js($type) === 'error'
        }">
        @if ($type === 'info')
            <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
        @elseif ($type === 'warning')
            <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
        @elseif ($type === 'success')
            <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
        @elseif ($type === 'error')
            <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
        @endif
    </button>

    {{-- Tooltip/Popup --}}
    <div class="absolute hidden group-hover:flex z-50 animate-in fade-in duration-200"
        @class([
            'bg-glass-dark border border-glass-border rounded-lg px-3 py-2 text-sm text-light whitespace-nowrap shadow-lg backdrop-filter backdrop-blur-xl',
            'bottom-full left-1/2 transform -translate-x-1/2 mb-2' => $position === 'top',
            'top-full left-1/2 transform -translate-x-1/2 mt-2' => $position === 'bottom',
            'right-full top-1/2 transform -translate-y-1/2 mr-2' => $position === 'left',
            'left-full top-1/2 transform -translate-y-1/2 ml-2' => $position === 'right',
        ])>
        <div class="max-w-xs">
            {{ $message }}
        </div>
        {{-- Arrow --}}
        <div class="absolute w-2 h-2 bg-glass-dark border border-glass-border rotate-45"
            @class([
                'top-full left-1/2 transform -translate-x-1/2 -mt-1' => $position === 'top',
                'bottom-full left-1/2 transform -translate-x-1/2 mt-1' => $position === 'bottom',
                'left-full top-1/2 transform -translate-y-1/2 -ml-1' => $position === 'left',
                'right-full top-1/2 transform -translate-y-1/2 ml-1' => $position === 'right',
            ])>
        </div>
    </div>
</div>
