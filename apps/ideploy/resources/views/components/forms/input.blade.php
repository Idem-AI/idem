<div @class([
    'flex-1' => $isMultiline,
    'w-full' => !$isMultiline,
])>
    @if ($label)
        <label class="flex gap-2 items-center mb-2 text-sm font-medium text-light">
            <span>{{ $label }}</span>
            @if ($required)
                <span class="text-danger text-xs">*</span>
            @endif
            @if ($helper)
                <x-helper :helper="$helper" />
            @endif
        </label>
    @endif
    @if ($type === 'password')
        <div class="relative" x-data="{ type: 'password' }">
            @if ($allowToPeak)
                <div x-on:click="changePasswordFieldType"
                    class="flex absolute inset-y-0 right-0 items-center pr-2 cursor-pointer dark:hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                        <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
                    </svg>
                </div>
            @endif
            <input autocomplete="{{ $autocomplete }}" value="{{ $value }}"
                {{ $attributes->merge(['class' => $defaultClass]) }} @required($required)
                @if ($modelBinding !== 'null') wire:model={{ $modelBinding }} wire:dirty.class="border-l-accent border-l-4" @endif
                wire:loading.attr="disabled"
                type="{{ $type }}" @readonly($readonly) @disabled($disabled) id="{{ $htmlId }}"
                name="{{ $name }}" placeholder="{{ $attributes->get('placeholder') }}"
                aria-placeholder="{{ $attributes->get('placeholder') }}"
                @if ($autofocus) x-ref="autofocusInput" @endif>

        </div>
    @else
        <input autocomplete="{{ $autocomplete }}" @if ($value) value="{{ $value }}" @endif
            {{ $attributes->merge(['class' => $defaultClass]) }} @required($required) @readonly($readonly)
            @if ($modelBinding !== 'null') wire:model={{ $modelBinding }} wire:dirty.class="border-l-accent border-l-4" @endif
            wire:loading.attr="disabled"
            type="{{ $type }}" @disabled($disabled) min="{{ $attributes->get('min') }}"
            max="{{ $attributes->get('max') }}" minlength="{{ $attributes->get('minlength') }}"
            maxlength="{{ $attributes->get('maxlength') }}"
            @if ($htmlId !== 'null') id={{ $htmlId }} @endif name="{{ $name }}"
            placeholder="{{ $attributes->get('placeholder') }}"
            @if ($autofocus) x-ref="autofocusInput" @endif>
    @endif
    @if (!$label && $helper)
        <div class="mt-1.5 text-xs text-light/60 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <x-helper :helper="$helper" />
        </div>
    @endif
    @error($modelBinding)
        <div class="mt-1.5 text-xs text-danger flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ $message }}</span>
        </div>
    @enderror
</div>
