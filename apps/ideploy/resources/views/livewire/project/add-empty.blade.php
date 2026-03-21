<div class="w-full min-w-[32rem]" x-data>
    {{-- Progress Steps --}}
    <div class="flex items-center gap-2 mb-6">
        @foreach([1 => 'Projet', 2 => 'Hébergement', 3 => 'Région'] as $n => $label)
            <div class="flex items-center {{ $n < 3 ? 'flex-1' : '' }}">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        {{ $step > $n ? 'bg-coollabs text-white' : ($step === $n ? 'bg-coollabs text-white ring-2 ring-coollabs/30' : 'bg-coolgray-300/30 text-coolgray-300') }}">
                        @if($step > $n)
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                        @else
                            {{ $n }}
                        @endif
                    </div>
                    <span class="text-xs font-medium {{ $step === $n ? 'text-white' : 'text-coolgray-300' }}">{{ $label }}</span>
                </div>
                @if($n < 3)
                    <div class="flex-1 mx-3 h-px {{ $step > $n ? 'bg-coollabs' : 'bg-coolgray-300/20' }} transition-colors"></div>
                @endif
            </div>
        @endforeach
    </div>

    {{-- Step 1: Project Info --}}
    @if($step === 1)
        <form wire:submit.prevent="nextStep" class="flex flex-col gap-4">
            <x-forms.input
                placeholder="Mon Super Projet"
                id="name"
                label="Nom du projet"
                required
                autofocus />
            <x-forms.input
                placeholder="Une brève description de ce projet"
                id="description"
                label="Description" />
            <p class="text-xs text-coolgray-300">
                Un environnement <span class="text-warning font-semibold">production</span> sera créé automatiquement.
            </p>
            <div class="flex justify-end pt-2">
                <button type="submit"
                    class="px-5 py-2.5 bg-coollabs hover:bg-coollabs-100 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                    Continuer
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>
        </form>
    @endif

    {{-- Step 2: Hosting Type --}}
    @if($step === 2)
        <div class="flex flex-col gap-4">
            <div>
                <h3 class="text-sm font-semibold text-white mb-1">Choisissez votre environnement d'hébergement</h3>
                <p class="text-xs text-coolgray-300">Où souhaitez-vous déployer les ressources de ce projet ?</p>
            </div>

            {{-- Option SaaS --}}
            <div wire:click="selectType('saas')"
                class="group relative p-5 border-2 rounded-xl cursor-pointer transition-all
                    {{ $deployment_type === 'saas' ? 'border-coollabs bg-coollabs/5' : 'border-coolgray-300/20 hover:border-coollabs/50 hover:bg-coollabs/5' }}">
                <div class="absolute top-3 right-3">
                    <span class="px-2 py-0.5 text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25 rounded-full">
                        Recommandé
                    </span>
                </div>
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 rounded-xl bg-coollabs/10 border border-coollabs/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg class="w-6 h-6 text-coollabs" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-bold text-white mb-1">Idem SaaS</h4>
                        <p class="text-xs text-coolgray-300 mb-3">Infrastructure gérée par Idem — haute disponibilité, zéro maintenance.</p>
                        <div class="flex flex-wrap gap-2">
                            @foreach(['Auto-scaling', 'Sauvegardes auto', 'Support inclus', 'Zéro config serveur'] as $feat)
                                <span class="px-2 py-0.5 text-[10px] bg-coolgray-300/10 text-coolgray-300 rounded-md">{{ $feat }}</span>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>

            {{-- Option Own Server --}}
            <div wire:click="selectType('own')"
                class="group relative p-5 border-2 rounded-xl cursor-pointer transition-all
                    {{ $deployment_type === 'own' ? 'border-coollabs bg-coollabs/5' : 'border-coolgray-300/20 hover:border-coolgray-300/40 hover:bg-coolgray-300/5' }}">
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 rounded-xl bg-coolgray-300/10 border border-coolgray-300/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg class="w-6 h-6 text-coolgray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-bold text-white mb-1">Mon propre serveur</h4>
                        <p class="text-xs text-coolgray-300 mb-3">Déployez sur votre infrastructure existante avec un contrôle total.</p>
                        <div class="flex flex-wrap gap-2">
                            @foreach(['Contrôle total', 'Configuration custom', 'Infra existante'] as $feat)
                                <span class="px-2 py-0.5 text-[10px] bg-coolgray-300/10 text-coolgray-300 rounded-md">{{ $feat }}</span>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-between pt-2">
                <button type="button" wire:click="prevStep"
                    class="px-4 py-2 text-sm text-coolgray-300 hover:text-white transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    Retour
                </button>
            </div>
        </div>
    @endif

    {{-- Step 3: Region (SaaS only) --}}
    @if($step === 3)
        <div class="flex flex-col gap-4">
            <div>
                <h3 class="text-sm font-semibold text-white mb-1">Choisissez votre région d'hébergement</h3>
                <p class="text-xs text-coolgray-300">Sélectionnez la région la plus proche de vos utilisateurs finaux.</p>
            </div>

            @foreach($countries as $group)
                <div>
                    <p class="text-xs font-semibold text-coolgray-300 uppercase tracking-wider mb-2">{{ $group['label'] }}</p>
                    <div class="grid grid-cols-2 gap-2">
                        @foreach($group['countries'] as $country)
                            <button type="button" wire:click="selectRegion('{{ $country['code'] }}')"
                                class="flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                                    {{ $deployment_region === $country['code']
                                        ? 'border-coollabs bg-coollabs/10 ring-1 ring-coollabs/40'
                                        : 'border-coolgray-300/15 hover:border-coolgray-300/35 hover:bg-coolgray-300/5' }}">
                                <span class="text-xl leading-none">{{ $country['flag'] }}</span>
                                <p class="text-xs font-semibold text-white truncate flex-1">{{ $country['name'] }}</p>
                                @if($deployment_region === $country['code'])
                                    <div class="ml-auto flex-shrink-0">
                                        <svg class="w-4 h-4 text-coollabs" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                    </div>
                                @endif
                            </button>
                        @endforeach
                    </div>
                </div>
            @endforeach

            @error('deployment_region')
                <p class="text-xs text-red-400">{{ $message }}</p>
            @enderror

            <div class="flex justify-between pt-2">
                <button type="button" wire:click="prevStep"
                    class="px-4 py-2 text-sm text-coolgray-300 hover:text-white transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                    Retour
                </button>
                <button type="button" wire:click="submit"
                    @if(!$deployment_region) disabled @endif
                    class="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2
                        {{ $deployment_region
                            ? 'bg-coollabs hover:bg-coollabs-100 text-white'
                            : 'bg-coolgray-300/20 text-coolgray-300 cursor-not-allowed' }}">
                    Créer le projet
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </button>
            </div>
        </div>
    @endif
</div>
