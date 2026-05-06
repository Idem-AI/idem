<form class="flex flex-col w-full gap-2 rounded-sm" wire:submit='submit'>
    <x-forms.input placeholder="NODE_ENV" id="key" label="Name" required />
    <x-forms.textarea x-show="$wire.is_multiline === true" x-cloak id="value" label="Value" required />
    <x-forms.input x-show="$wire.is_multiline === false" x-cloak placeholder="production" id="value"
        x-bind:label="$wire.is_multiline === false && 'Value'" required />

    @if (!$shared)
        <x-forms.checkbox id="is_buildtime"
            helper="Make this variable available during Docker build process. Useful for build secrets and dependencies."
            label="Available at Buildtime" />

        <x-environment-variable-warning :problematic-variables="$problematicVariables" />

        <x-forms.checkbox id="is_runtime" helper="Make this variable available in the running container at runtime."
            label="Available at Runtime" />
        <x-forms.checkbox id="is_literal"
            helper="This means that when you use $VARIABLES in a value, it should be interpreted as the actual characters '$VARIABLES' and not as the value of a variable named VARIABLE.<br><br>Useful if you have $ sign in your value and there are some characters after it, but you would not like to interpolate it from another value. In this case, you should set this to true."
            label="Is Literal?" />
    @endif

    <x-forms.checkbox id="is_multiline" label="Is Multiline?" />
    <button type="submit" @click="slideOverOpen=false"
        class="inner-button w-full py-2.5 px-4 text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-2 mt-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
        </svg>
        Save Variable
    </button>
</form>
