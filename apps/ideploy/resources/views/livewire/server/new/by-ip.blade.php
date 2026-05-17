<div class="w-full" style="min-width: 34rem">

    @if ($limit_reached)
        <x-limit-reached name="servers" />
    @else

        {{-- ── Stepper dynamique : 3 étapes (non-admin) ou 4 étapes (admin) ── --}}
        @php
            $stepLabels = $is_admin
                ? [1 => 'Identité', 2 => 'SSH', 3 => 'Options', 4 => 'Admin']
                : [1 => 'Identité', 2 => 'SSH', 3 => 'Options'];
            $totalSteps = count($stepLabels);
        @endphp
        <div class="flex items-center mb-8">
            @foreach($stepLabels as $n => $label)
                <div class="flex flex-col items-center {{ $n < $totalSteps ? 'flex-1' : '' }}">
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
                        @if($n < $totalSteps)
                            <div class="flex-1 h-px transition-colors duration-300 {{ $step > $n ? 'bg-primary' : 'bg-gray-700' }}"></div>
                        @endif
                    </div>
                    <span class="text-[11px] font-semibold mt-2 transition-colors duration-300 {{ $step === $n ? 'text-white' : ($step > $n ? 'text-primary' : 'text-gray-600') }}">
                        {{ $label }}
                    </span>
                </div>
            @endforeach
        </div>

        {{-- ══ STEP 1 — Identité du serveur ══ --}}
        @if($step === 1)
            <form wire:submit.prevent="nextStep" class="flex flex-col gap-5">

                <div>
                    <label class="block text-sm font-semibold text-gray-200 mb-1.5">
                        Nom du serveur <span class="text-red-400 ml-0.5">*</span>
                    </label>
                    <input wire:model="name" type="text"
                        placeholder="ex: prod-server-01"
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
                    <label class="block text-sm font-semibold text-gray-200 mb-1.5">
                        Description
                        <span class="text-xs font-normal text-gray-500 ml-1">(optionnel)</span>
                    </label>
                    <textarea wire:model="description" rows="2"
                        placeholder="Une brève description de ce serveur..."
                        class="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-white text-sm
                               placeholder-gray-600 resize-none transition-all
                               focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"></textarea>
                    @error('description')
                        <p class="mt-1.5 text-xs text-red-400">{{ $message }}</p>
                    @enderror
                </div>

                {{-- Ce qui sera connecté --}}
                <div class="flex flex-col gap-2">
                    @foreach([
                        ['color' => 'text-blue-400', 'label' => 'Serveur SSH', 'desc' => 'Connexion sécurisée via votre clé privée'],
                        ['color' => 'text-emerald-400', 'label' => 'Agent installé', 'desc' => 'Docker et les dépendances configurés automatiquement'],
                        ['color' => 'text-violet-400', 'label' => 'Prêt à déployer', 'desc' => 'Applications et bases de données sur votre infrastructure'],
                    ] as $item)
                        <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-900/50 border border-gray-800/60">
                            <svg class="w-3.5 h-3.5 {{ $item['color'] }} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span class="text-xs font-semibold text-white">{{ $item['label'] }}</span>
                            <span class="text-xs text-gray-500">— {{ $item['desc'] }}</span>
                        </div>
                    @endforeach
                </div>

                <div class="flex justify-end pt-1">
                    <button type="submit" class="inner-button flex items-center gap-4">
                        Continuer
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>

            </form>
        @endif

        {{-- ══ STEP 2 — Connexion SSH ══ --}}
        @if($step === 2)
            <form wire:submit.prevent="nextStep" class="flex flex-col gap-5">

                <div class="mb-2">
                    <h3 class="text-base font-bold text-white mb-1">Connexion SSH</h3>
                    <p class="text-sm text-gray-400">Identifiants d'accès pour établir la connexion sécurisée.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="md:col-span-1">
                        <x-forms.input id="ip" label="Adresse IP / Domaine" required placeholder="192.168.1.1" helper="IP ou nom de domaine" />
                    </div>
                    <x-forms.input type="number" id="port" label="Port SSH" required placeholder="22" />
                    <x-forms.input id="user" label="Utilisateur SSH" required placeholder="root" />
                </div>

                @if($private_keys->count() > 0)
                    <x-forms.select label="Clé privée" id="private_key_id">
                        <option disabled>Sélectionner une clé privée</option>
                        @foreach ($private_keys as $key)
                            @if ($loop->first)
                                <option selected value="{{ $key->id }}">{{ $key->name }}</option>
                            @else
                                <option value="{{ $key->id }}">{{ $key->name }}</option>
                            @endif
                        @endforeach
                    </x-forms.select>
                @else
                    <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div class="flex items-start gap-3 mb-3">
                            <svg class="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                            </svg>
                            <div class="flex-1">
                                <h4 class="text-sm font-semibold text-amber-400 mb-1">Clé privée requise</h4>
                                <p class="text-xs text-gray-400 mb-3">Vous devez créer une clé privée pour l'authentification SSH avant de continuer.</p>
                                <x-modal-input buttonTitle="Créer une clé privée" title="Nouvelle clé privée">
                                    <livewire:security.private-key.create from="server" />
                                </x-modal-input>
                            </div>
                        </div>
                    </div>
                @endif

                <div class="flex items-start gap-3 px-4 py-3 bg-blue-500/6 border border-blue-500/15 rounded-xl">
                    <svg class="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                    </svg>
                    <p class="text-xs text-blue-200/70 leading-relaxed">La clé doit correspondre à une clé publique dans <span class="font-mono text-blue-300">~/.ssh/authorized_keys</span> sur le serveur cible.</p>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <button type="button" wire:click="prevStep"
                        class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        Retour
                    </button>
                    <button type="submit" class="inner-button flex items-center gap-4" @if($private_keys->count() === 0) disabled @endif>
                        Continuer
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>

            </form>
        @endif

        {{-- ══ STEP 3 — Options (compact) ══ --}}
        @if($step === 3)
            <form wire:submit.prevent="{{ $is_admin ? 'nextStep' : 'submit' }}" class="flex flex-col gap-5">

                <div class="mb-2">
                    <h3 class="text-base font-bold text-white mb-1">Options du serveur</h3>
                    <p class="text-sm text-gray-400">Rôle du serveur et configuration du clustering.</p>
                </div>

                {{-- Build Server --}}
                <div class="p-4 rounded-xl border border-gray-700/60 bg-gray-900/40">
                    <x-forms.checkbox instantSave type="checkbox" id="is_build_server" label="Utiliser comme serveur de build" />
                    <p class="text-xs text-gray-500 mt-1.5 ml-5 leading-relaxed">Dédié à la construction d'images Docker, sans déploiement d'applications.</p>
                </div>

                {{-- Docker Swarm --}}
                <div class="p-4 rounded-xl border border-blue-500/15">
                    <div class="flex items-center gap-2.5 mb-3">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                        <span class="text-xs font-bold text-blue-400 uppercase tracking-wider">Docker Swarm</span>
                        <span class="px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-800 border border-gray-700 rounded-md">expérimental</span>
                        <a class="text-xs text-blue-400 hover:text-blue-300 underline ml-auto" href="https://ideploy.io/docs/knowledge-base/docker/swarm" target="_blank">docs →</a>
                    </div>
                    <p class="text-xs text-amber-400/80 mb-3 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                        Support non-root expérimental —
                        <a class="underline hover:text-amber-300" href="https://ideploy.io/docs/knowledge-base/server/non-root-user" target="_blank">voir la doc</a>
                    </p>
                    <div class="flex flex-wrap gap-4">
                        @if ($is_swarm_worker || $is_build_server)
                            <x-forms.checkbox disabled instantSave type="checkbox" id="is_swarm_manager" label="Swarm Manager" />
                        @else
                            <x-forms.checkbox type="checkbox" instantSave id="is_swarm_manager" label="Swarm Manager" />
                        @endif

                        @if ($is_swarm_manager || $is_build_server)
                            <x-forms.checkbox disabled instantSave type="checkbox" id="is_swarm_worker" label="Swarm Worker" />
                        @else
                            <x-forms.checkbox type="checkbox" instantSave id="is_swarm_worker" label="Swarm Worker" />
                        @endif

                        @if ($is_swarm_worker && count($swarm_managers) > 0)
                            <div class="w-full mt-1">
                                <x-forms.select label="Cluster Swarm" id="selected_swarm_cluster" required>
                                    @foreach ($swarm_managers as $server)
                                        @if ($loop->first)
                                            <option selected value="{{ $server->id }}">{{ $server->name }}</option>
                                        @else
                                            <option value="{{ $server->id }}">{{ $server->name }}</option>
                                        @endif
                                    @endforeach
                                </x-forms.select>
                            </div>
                        @endif
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <button type="button" wire:click="prevStep"
                        class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        Retour
                    </button>
                    @if($is_admin)
                        <button type="submit" class="inner-button flex items-center gap-4">
                            Continuer
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </button>
                    @else
                        <button type="submit" wire:loading.attr="disabled"
                            class="inner-button flex items-center gap-2 disabled:opacity-60">
                            <span wire:loading.remove wire:target="submit" class="flex items-center gap-2">
                                Connecter le serveur
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            </span>
                            <span wire:loading wire:target="submit" class="flex items-center gap-2">
                                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                Connexion...
                            </span>
                        </button>
                    @endif
                </div>

            </form>
        @endif

        {{-- ══ STEP 4 — Admin : Géolocalisation & Specs (admin only) ══ --}}
        @if($step === 4 && $is_admin)
            <form wire:submit.prevent="submit" class="flex flex-col gap-5">

                <div class="mb-2">
                    <h3 class="text-base font-bold text-white mb-1">Paramètres Admin</h3>
                    <p class="text-sm text-gray-400">Géolocalisation et spécifications matérielles du serveur.</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <x-forms.select label="Pays" id="country_code" helper="Pays du serveur">
                        <option value="">-- Sélectionner --</option>
                        @foreach($african_countries as $country)
                            <option value="{{ $country['code'] }}">{{ $country['name'] }}</option>
                        @endforeach
                    </x-forms.select>
                    <x-forms.input id="city" label="Ville" placeholder="ex: Douala" helper="Ex: Douala" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <x-forms.input type="number" step="0.000001" id="latitude" label="Latitude" placeholder="4.0511" />
                    <x-forms.input type="number" step="0.000001" id="longitude" label="Longitude" placeholder="9.7679" />
                </div>

                <p class="text-xs text-gray-500 -mt-2">Région auto-remplie : <span class="text-blue-400 font-semibold">{{ $region ?? 'Non définie' }}</span></p>

                <div class="grid grid-cols-2 gap-4">
                    <x-forms.input type="number" id="cpu_cores" label="CPU (cœurs)" placeholder="8" />
                    <x-forms.input type="number" id="ram_mb" label="RAM (Mo)" placeholder="16384" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <x-forms.input type="number" id="disk_gb" label="Disque (Go)" placeholder="500" />
                    <x-forms.input type="number" id="max_applications" label="Max apps" placeholder="50" />
                </div>

                <x-forms.checkbox type="checkbox" id="is_available" label="Serveur disponible à l'assignation ?" />

                <div class="flex items-center justify-between pt-1">
                    <button type="button" wire:click="prevStep"
                        class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        Retour
                    </button>
                    <button type="submit" wire:loading.attr="disabled"
                        class="inner-button flex items-center gap-2 disabled:opacity-60">
                        <span wire:loading.remove wire:target="submit" class="flex items-center gap-2">
                            Connecter le serveur
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </span>
                        <span wire:loading wire:target="submit" class="flex items-center gap-2">
                            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Connexion...
                        </span>
                    </button>
                </div>

            </form>
        @endif

    @endif
</div>
