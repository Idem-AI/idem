@can('create', App\Models\S3Storage::class)
    <div class="w-full">
        {{-- Info Section --}}
        <div class="mb-6 p-4 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div class="text-sm text-gray-300">
                    <p>Configure S3-compatible storage for backups and file storage. For more details, visit the 
                        <a class="text-[#4F46E5] hover:text-[#6366F1] underline" href="https://coolify.io/docs/knowledge-base/s3/introduction" target="_blank">Coolify Docs</a>.
                    </p>
                </div>
            </div>
        </div>
        
        <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit='submit'>
            <div class="flex gap-2">
                <x-forms.input required label="Name" id="name" />
                <x-forms.input label="Description" id="description" />
            </div>
            <x-forms.input required type="url" label="Endpoint" wire:model.blur="endpoint" />
            <div class="flex gap-2">
                <x-forms.input required label="Bucket" id="bucket" />
                <x-forms.input required helper="Region only required for AWS. Leave it as-is for other providers."
                    label="Region" id="region" />
            </div>
            <div class="flex gap-2">
                <x-forms.input required type="password" label="Access Key" id="key" />
                <x-forms.input required type="password" label="Secret Key" id="secret" />
            </div>

            {{-- Submit Button --}}
            <div class="flex justify-end pt-2">
                <button 
                    type="submit"
                    class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Validate Connection & Continue
                </button>
            </div>
        </form>
    </div>
@else
    <x-callout type="warning" title="Permission Required">
        You don't have permission to create new S3 storage configurations. Please contact your team administrator for
        access.
    </x-callout>
@endcan
