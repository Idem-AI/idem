<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Resource Limits</span>
            </h2>
        </div>
        <p class="text-sm text-light opacity-70">Limit your container resources by CPU & memory.</p>
    </div>

    <form wire:submit='submit' class="flex flex-col gap-6">
        {{-- CPU Limits Section --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">CPU Limits</h3>
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
            <x-forms.button canGate="update" :canResource="$resource" type='submit'>Save</x-forms.button>
        </div>
    </form>
</div>
