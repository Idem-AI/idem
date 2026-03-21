<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-light">
                <span class="i-underline">Swarm Configuration</span>
            </h2>
            @can('update', $application)
                <x-forms.button form="swarmForm" type="submit">Save</x-forms.button>
            @else
                <x-forms.button form="swarmForm" type="submit" disabled
                    title="You don't have permission to update this application. Contact your team administrator for access.">
                    Save
                </x-forms.button>
            @endcan
        </div>
        <p class="text-sm text-light opacity-70">Configure Docker Swarm deployment settings.</p>
    </div>

    <form wire:submit='submit' id="swarmForm" class="flex flex-col gap-6">
        {{-- Swarm Settings --}}
        <div class="glass-card p-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Deployment Settings</h3>
            <div class="flex flex-col gap-4">
                <div class="flex flex-col items-end gap-2 xl:flex-row">
                    <x-forms.input id="swarmReplicas" label="Replicas" required canGate="update" :canResource="$application" />
                    <x-forms.checkbox instantSave helper="If turned off, this resource will start on manager nodes too."
                        id="isSwarmOnlyWorkerNodes" label="Only Start on Worker nodes" canGate="update" :canResource="$application" />
                </div>
                <x-forms.textarea id="swarmPlacementConstraints" rows="7" label="Custom Placement Constraints"
                    placeholder="placement:
    constraints:
        - 'node.role == worker'" canGate="update" :canResource="$application" />
            </div>
        </div>
    </form>
</div>
