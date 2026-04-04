<div>
    {{-- Header --}}
    <div class="mb-6 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50">
        <h1 class="text-2xl font-bold text-white mb-2">Create a new Application</h1>
        <p class="text-sm text-gray-400">Deploy a simple Dockerfile without Git repository</p>
    </div>
    
    <form class="flex flex-col gap-4 p-6 bg-[#0f1724] rounded-xl border border-gray-800/50" wire:submit="submit">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Dockerfile</h2>
            <button type="submit" class="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Save
            </button>
        </div>
        <x-forms.textarea useMonacoEditor monacoEditorLanguage="dockerfile" rows="20" id="dockerfile" autofocus
            placeholder='FROM nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
'></x-forms.textarea>
    </form>
</div>
