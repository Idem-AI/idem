<div>
    {{-- Header Idem Style --}}
    <div class="mb-6">
        <h2 class="text-2xl font-bold text-light mb-2">
            <span class="i-underline">Tags</span>
        </h2>
        <p class="text-sm text-light opacity-70">Organize your resources with tags.</p>
    </div>

    {{-- Add Tag Section --}}
    <div class="glass-card p-6 mb-6">
        <h3 class="text-lg font-semibold text-accent mb-4">Add Tags</h3>
        @can('update', $resource)
            <form wire:submit='submit' class="flex items-end gap-2">
                <div class="flex-1 max-w-md">
                    <x-forms.input label="Create new or assign existing tags"
                        helper="You add more at once with space separated list: web api something<br><br>If the tag does not exists, it will be created."
                        wire:model="newTags" placeholder="example: prod app1 user" />
                </div>
                <x-forms.button type="submit">Add</x-forms.button>
            </form>
        @else
            <div class="glass-card p-4 bg-warning/10">
                <div class="flex items-start gap-3 text-warning">
                    <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <div>
                        <h4 class="font-semibold mb-1">Access Restricted</h4>
                        <p class="text-sm opacity-90">You don't have permission to manage tags. Contact your team administrator to request access.</p>
                    </div>
                </div>
            </div>
        @endcan
    </div>
    {{-- Assigned Tags Section --}}
    @if (data_get($this->resource, 'tags') && count(data_get($this->resource, 'tags')) > 0)
        <div class="glass-card p-6 mb-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Assigned Tags</h3>
            <div class="flex flex-wrap gap-2">
                @foreach (data_get($this->resource, 'tags') as $tagId => $tag)
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 text-accent border border-accent/30 text-sm font-medium">
                        <span>{{ $tag->name }}</span>
                        @can('update', $resource)
                            <button wire:click="deleteTag('{{ $tag->id }}')" type="button" class="hover:text-danger transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        @endcan
                    </span>
                @endforeach
            </div>
        </div>
    @endif
    {{-- Available Tags Section --}}
    @can('update', $resource)
        @if (count($filteredTags) > 0)
            <div class="glass-card p-6">
                <h3 class="text-lg font-semibold text-accent mb-2">Available Tags</h3>
                <p class="text-sm text-light opacity-60 mb-4">Click to add quickly</p>
                <div class="flex flex-wrap gap-2">
                    @foreach ($filteredTags as $tag)
                        <button wire:click="addTag('{{ $tag->id }}','{{ $tag->name }}')" type="button"
                            class="inline-flex items-center px-3 py-1.5 rounded-full bg-glass text-light border border-glass hover:border-accent hover:bg-accent/10 transition-all text-sm font-medium">
                            {{ $tag->name }}
                        </button>
                    @endforeach
                </div>
            </div>
        @endif
    @endcan
</div>
