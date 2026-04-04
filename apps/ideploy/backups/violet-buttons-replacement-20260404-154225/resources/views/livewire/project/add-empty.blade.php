<div class="w-full" style="min-width: 34rem">

    {{-- Stepper --}}
    <div class="flex items-center mb-8">
        @foreach([1 => 'Projet', 2 => 'Hébergement', 3 => 'Région'] as $n => $label)
            <div class="flex flex-col items-center {{ $n < 3 ? 'flex-1' : '' }}">
                <div class="flex items-center w-full">
                    @if($n > 1)
                        <div class="flex-1 h-px transition-colors duration-300 {{ $step >= $n ? 'bg-primary' : 'bg-gray-700' }}"></div>
                    @endif
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300
                        {{ $step > $n
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : ($step === $n
                                ? 'bg-primary text-white ring-4 ring-primary/20 shadow-lg shadow-primary/20'
                                : 'bg-gray-800 text-gray-500 border border-gray-700') }}">
                        @if($step > $n)
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        @else
                            {{ $n }}
                        @endif
                    </div>
                    @if($n < 3)
                        <div class="flex-1 h-px transition-colors duration-300 {{ $step > $n ? 'bg-primary' : 'bg-gray-700' }}"></div>
                    @endif
                </div>
                <span class="text-[11px] font-semibold mt-2 transition-colors duration-300 {{ $step === $n ? 'text-white' : ($step > $n ? 'text-primary' : 'text-gray-600') }}">
                    {{ $label }}
                </span>
            </div>
        @endforeach
    </div>

    {{-- ── Step 1 : Infos du projet ── --}}
    @if($step === 1)
        <form wire:submit.prevent="nextStep" class="flex flex-col gap-5">

            <div>
                <label class="block text-sm font-semibold text-gray-200 mb-1.5">
                    Nom du projet <span class="text-red-400 ml-0.5">*</span>
                </label>
                <input wire:model="name" type="text"
                    placeholder="Mon Super Projet"
                    autofocus
                    class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm
                           placeholder-gray-600 transition-all
                           focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
                @error('name')
                    <p class="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
                        {{ $message }}
                    </p>
                @enderror
            </div>

            <div>
                <label class="block text-sm font-semibold text-gray-200 mb-1.5">Description</label>
                <textarea wire:model="description" rows="2"
                    placeholder="Une brève description du projet (optionnel)"
                    class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm
                           placeholder-gray-600 resize-none transition-all
                           focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"></textarea>
                @error('description')
                    <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
                @enderror
            </div>

            <div class="flex items-start gap-3 px-4 py-3 bg-amber-500/6 border border-amber-500/15 rounded-xl">
                <svg class="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
                <p class="text-xs text-amber-200/70 leading-relaxed">Un environnement <span class="font-bold text-amber-300">production</span> sera créé automatiquement avec le projet.</p>
            </div>

            <div class="flex justify-end pt-1">
                <button type="submit" class="inner-button">
                    Continuer
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>

        </form>
    @endif

    {{-- ── Step 2 : Type d'hébergement ── --}}
    @if($step === 2)
        <div class="flex flex-col gap-3">

            <div class="mb-2">
                <h3 class="text-base font-bold text-white mb-1">Type d'hébergement</h3>
                <p class="text-sm text-gray-400">Où souhaitez-vous héberger les ressources de ce projet ?</p>
            </div>

            {{-- Idem SaaS --}}
            <div wire:click="selectType('saas')"
                class="relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200
                    border-primary/60 bg-primary/5 hover:bg-primary/8 hover:border-primary/80">
                <div class="absolute top-4 right-4">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full">
                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        Recommandé
                    </span>
                </div>
                <div class="flex items-start gap-4 pr-28">
                    <div class="w-12 h-12 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
                        <svg class="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 00.75-7.414 5.25 5.25 0 00-10.233-2.33 3 3 0 00-4.004 4.244A4.5 4.5 0 002.25 15z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-[15px] font-bold text-white mb-1.5">Idem SaaS</h4>
                        <p class="text-sm text-gray-300 mb-3 leading-relaxed">Infrastructure managée par Idem — haute disponibilité, zéro maintenance côté serveur.</p>
                        <div class="flex flex-wrap gap-1.5">
                            @foreach(['Auto-scaling', 'Sauvegardes auto', 'Support 24/7', 'Zéro config'] as $feat)
                                <span class="px-2.5 py-1 text-[11px] font-medium bg-gray-800 text-gray-300 border border-gray-700/80 rounded-lg">{{ $feat }}</span>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>

            {{-- Own Server --}}
            <div wire:click="selectType('own')"
                class="relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200
                    border-gray-700/60 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-800/40">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700/80 flex items-center justify-center shrink-0">
                        <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-[15px] font-bold text-white mb-1.5">Mon propre serveur</h4>
                        <p class="text-sm text-gray-300 mb-3 leading-relaxed">Déployez sur votre infrastructure existante avec un contrôle total sur l'environnement.</p>
                        <div class="flex flex-wrap gap-1.5">
                            @foreach(['Contrôle total', 'Config custom', 'Infra existante'] as $feat)
                                <span class="px-2.5 py-1 text-[11px] font-medium bg-gray-800 text-gray-300 border border-gray-700/80 rounded-lg">{{ $feat }}</span>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-start pt-2">
                <button type="button" wire:click="prevStep"
                    class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Retour
                </button>
            </div>
        </div>
    @endif

    {{-- ── Step 3 : Région ── --}}
    @if($step === 3)
        <div class="flex flex-col gap-4">

            <div class="mb-1">
                <h3 class="text-base font-bold text-white mb-1">Région d'hébergement</h3>
                <p class="text-sm text-gray-400">Choisissez la région la plus proche de vos utilisateurs.</p>
            </div>

            @foreach($countries as $group)
                <div>
                    <div class="flex items-center gap-3 mb-2.5">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.12em]">{{ $group['label'] }}</span>
                        <div class="flex-1 h-px bg-gray-800"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        @foreach($group['countries'] as $country)
                            <button type="button" wire:click="selectRegion('{{ $country['code'] }}')"
                                class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-150
                                    {{ $deployment_region === $country['code']
                                        ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/20'
                                        : 'border-gray-700/50 bg-gray-900/30 hover:border-gray-600/70 hover:bg-gray-800/50' }}">
                                <span class="text-[18px] leading-none">{{ $country['flag'] }}</span>
                                <span class="text-sm font-semibold text-white flex-1 truncate">{{ $country['name'] }}</span>
                                @if($deployment_region === $country['code'])
                                    <svg class="w-3.5 h-3.5 text-violet-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                    </svg>
                                @endif
                            </button>
                        @endforeach
                    </div>
                </div>
            @endforeach

            @error('deployment_region')
                <p class="text-xs text-red-400 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
                    {{ $message }}
                </p>
            @enderror

            <div class="flex items-center justify-between pt-2">
                <button type="button" wire:click="prevStep"
                    class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Retour
                </button>
                <button type="button" wire:click="submit"
                    @if(!$deployment_region) disabled @endif
                    class="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                        {{ $deployment_region
                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:-translate-y-px active:translate-y-0'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50' }}">
                    Créer le projet
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
            </div>

        </div>
    @endif

</div>
