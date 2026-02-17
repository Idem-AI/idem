<div>
    {{-- Header Idem Style --}}
    <div class="mb-8">
        <div class="flex items-center gap-3 mb-3">
            <div class="icon-container">
                <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-light">
                    <span class="i-underline">Resource Limits</span>
                </h2>
                <p class="text-sm text-light opacity-70 mt-1">Configure CPU and memory limits for optimal performance</p>
            </div>
        </div>
    </div>

    <form wire:submit='submit' class="flex flex-col gap-6">
        {{-- CPU Limits Section --}}
        <div class="section-card">
            <div class="flex items-center gap-2 mb-4">
                <span class="category-badge">Limits</span>
                <h3 class="text-lg font-semibold text-light">Resource Allocation</h3>
            </div>
            <div class="flex gap-2">
            <x-forms.input canGate="update" :canResource="$resource" placeholder="1.5"
                helper="0 means use all CPUs. Floating point number, like 0.002 or 1.5. More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/engine/reference/run/#cpu-share-constraint'>here</a>."
                label="Number of CPUs" id="limitsCpus" />
            <x-forms.input canGate="update" :canResource="$resource" placeholder="0-2"
                helper="Empty means, use all CPU sets. 0-2 will use CPU 0, CPU 1 and CPU 2. More info <a class='underline dark:text-white'  target='_blank' href='https://docs.docker.com/engine/reference/run/#cpu-share-constraint'>here</a>."
                label="CPU sets to use" id="limitsCpuset" />
            <x-forms.input canGate="update" :canResource="$resource" placeholder="1024"
                helper="More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/engine/reference/run/#cpu-share-constraint'>here</a>."
                label="CPU Weight" id="limitsCpuShares" />
            </div>
        </div>

        {{-- Memory Limits Section --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Memory Limits</h3>
            <div class="flex flex-col gap-3">
            <div class="flex gap-2">
                <x-forms.input canGate="update" :canResource="$resource"
                    helper="Examples: 69b (byte) or 420k (kilobyte) or 1337m (megabyte) or 1g (gigabyte).<br>More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/compose/compose-file/05-services/#mem_reservation'>here</a>."
                    label="Soft Memory Limit" id="limitsMemoryReservation" />
                <x-forms.input canGate="update" :canResource="$resource"
                    helper="0-100.<br>More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/compose/compose-file/05-services/#mem_swappiness'>here</a>."
                    type="number" min="0" max="100" label="Swappiness"
                    id="limitsMemorySwappiness" />
            </div>
            <div class="flex gap-2">
                <x-forms.input canGate="update" :canResource="$resource"
                    helper="Examples: 69b (byte) or 420k (kilobyte) or 1337m (megabyte) or 1g (gigabyte).<br>More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/compose/compose-file/05-services/#mem_limit'>here</a>."
                    label="Maximum Memory Limit" id="limitsMemory" />
                <x-forms.input canGate="update" :canResource="$resource"
                    helper="Examples:69b (byte) or 420k (kilobyte) or 1337m (megabyte) or 1g (gigabyte).<br>More info <a class='underline dark:text-white' target='_blank' href='https://docs.docker.com/compose/compose-file/05-services/#memswap_limit'>here</a>."
                    label="Maximum Swap Limit" id="limitsMemorySwap" />
            </div>
            </div>
        </div>

        {{-- Save Button --}}
        <div>
            @can('update', $resource)
                <button type='submit' class="inner-button">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Resource Limits
                </button>
            @endcan
        </div>
    </form>
</div>
