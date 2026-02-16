<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Health Checks</span>
            </h2>
            <div class="flex items-center gap-2">
                @if (!$healthCheckEnabled)
                    <x-modal-confirmation title="Confirm Healthcheck Enable?" buttonTitle="Enable Healthcheck"
                        submitAction="toggleHealthcheck" :actions="['Enable healthcheck for this resource.']"
                        warningMessage="If the health check fails, your application will become inaccessible. Please review the <a href='https://coolify.io/docs/knowledge-base/health-checks' target='_blank' class='underline text-white'>Health Checks</a> guide before proceeding!"
                        step2ButtonText="Enable Healthcheck" :confirmWithText="false" :confirmWithPassword="false"
                        isHighlightedButton>
                    </x-modal-confirmation>
                @else
                    <x-forms.button canGate="update" :canResource="$resource" wire:click="toggleHealthcheck">Disable Healthcheck</x-forms.button>
                @endif
            </div>
        </div>
        <p class="text-sm text-light opacity-70">Define how your resource's health should be checked.</p>
    </div>

    <form wire:submit='submit' class="flex flex-col gap-6">
        {{-- Warning if custom healthcheck found --}}
        @if ($customHealthcheckFound)
            <div class="glass-card p-4 bg-warning/10">
                <div class="flex items-start gap-3 text-warning">
                    <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <div>
                        <h4 class="font-semibold mb-1">Caution</h4>
                        <p class="text-sm opacity-90">A custom health check has been detected. If you enable this health check, it will disable the custom one and use this instead.</p>
                    </div>
                </div>
            </div>
        @endif

        {{-- Configuration Section --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Configuration</h3>
            <div class="flex flex-col gap-4">
        <div class="flex gap-2">
            <x-forms.select canGate="update" :canResource="$resource" id="healthCheckMethod" label="Method" required>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
            </x-forms.select>
            <x-forms.select canGate="update" :canResource="$resource" id="healthCheckScheme" label="Scheme" required>
                <option value="http">http</option>
                <option value="https">https</option>
            </x-forms.select>
            <x-forms.input canGate="update" :canResource="$resource" id="healthCheckHost" placeholder="localhost" label="Host" required />
            <x-forms.input canGate="update" :canResource="$resource" type="number" id="healthCheckPort"
                helper="If no port is defined, the first exposed port will be used." placeholder="80" label="Port" />
            <x-forms.input canGate="update" :canResource="$resource" id="healthCheckPath" placeholder="/health" label="Path" required />
        </div>

        <div class="pt-2 border-t border-glass">
            <div class="flex gap-2">
                <x-forms.input canGate="update" :canResource="$resource" type="number" id="healthCheckReturnCode" placeholder="200" label="Return Code"
                    required />
                <x-forms.input canGate="update" :canResource="$resource" id="healthCheckResponseText" placeholder="OK" label="Response Text" />
            </div>
        </div>

        <div class="pt-2 border-t border-glass">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <x-forms.input canGate="update" :canResource="$resource" min="1" type="number" id="healthCheckInterval" placeholder="30"
                    label="Interval (s)" required />
                <x-forms.input canGate="update" :canResource="$resource" type="number" id="healthCheckTimeout" placeholder="30" label="Timeout (s)"
                    required />
                <x-forms.input canGate="update" :canResource="$resource" type="number" id="healthCheckRetries" placeholder="3" label="Retries" required />
                <x-forms.input canGate="update" :canResource="$resource" min=1 type="number" id="healthCheckStartPeriod" placeholder="30"
                    label="Start Period (s)" required />
            </div>
        </div>

        <div class="pt-2">
            <x-forms.button canGate="update" :canResource="$resource" type="submit">Save</x-forms.button>
        </div>
            </div>
        </div>
    </form>
</div>