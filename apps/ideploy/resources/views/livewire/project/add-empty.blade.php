<div style="font-family:'Hanken Grotesk',sans-serif; color:#dae2fd; width:100%; box-sizing:border-box;">

<style>
.ms-i {
    font-family:'Material Symbols Outlined';
    font-weight:normal; font-style:normal;
    line-height:1; letter-spacing:normal; text-transform:none;
    display:inline-block; white-space:nowrap; direction:ltr;
    -webkit-font-smoothing:antialiased;
    font-variation-settings:'wght' 400;
}
.ms-i.fill { font-variation-settings:'FILL' 1,'wght' 400; }

.wd-input {
    width:100%; padding:.75rem 1rem; border-radius:.5rem;
    font-family:'Hanken Grotesk',sans-serif; font-size:16px;
    outline:none; transition:border-color .2s,box-shadow .2s;
    background:rgba(6,14,32,.55); border:1px solid rgba(67,70,85,.55);
    color:#dae2fd; box-sizing:border-box;
}
.wd-input::placeholder { color:rgba(141,145,160,.55); }
.wd-input:focus { border-color:#b4c5ff; box-shadow:0 0 0 2px rgba(180,197,255,.12); }
.wd-input-err { border-color:#ffb4ab !important; }

/* Host cards */
.hcard {
    border:1px solid #434655; border-radius:.75rem; padding:1.25rem;
    background:#131b2e; cursor:pointer; transition:all .2s;
    display:flex; flex-direction:column; height:100%; position:relative; overflow:hidden;
}
.hcard:hover { background:#171f33; border-color:rgba(180,197,255,.3); }
.hcard.sel { border-color:#b4c5ff !important; background:rgba(37,99,235,.08) !important; box-shadow:0 0 20px rgba(37,99,235,.15); }
.rdot {
    width:20px; height:20px; border-radius:50%; border:2px solid rgba(67,70,85,.8);
    flex-shrink:0; position:relative; transition:all .2s;
}
.rdot::after {
    content:''; display:block; width:8px; height:8px; border-radius:50%;
    background:#002a78; position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%) scale(0); transition:transform .15s;
}
.hcard.sel .rdot { border-color:#b4c5ff; background:#b4c5ff; }
.hcard.sel .rdot::after { transform:translate(-50%,-50%) scale(1); }

/* Region cards */
.rcard {
    border:1px solid rgba(67,70,85,.6); border-radius:.5rem; padding:.875rem 1rem;
    background:#171f33; cursor:pointer; transition:all .15s;
    display:flex; align-items:center; gap:.75rem; width:100%; text-align:left; position:relative;
}
.rcard:hover { border-color:#8d90a0; background:#222a3d; }
.rcard.sel { background:rgba(37,99,235,.1) !important; border-color:#2563eb !important; box-shadow:0 0 12px rgba(37,99,235,.2); }

/* Buttons */
.btn-p {
    display:inline-flex; align-items:center; gap:.5rem;
    padding:.65rem 1.75rem; border-radius:8px;
    background:#2563eb; color:#fff;
    font-family:'Hanken Grotesk',sans-serif; font-size:14px; font-weight:700;
    text-transform:uppercase; letter-spacing:.05em;
    cursor:pointer; border:none; box-shadow:0 4px 14px rgba(37,99,235,.28); transition:background .15s,transform .1s;
}
.btn-p:hover { background:#1d4ed8; }
.btn-p:active { transform:scale(.98); }
.btn-p:disabled { background:#1a2336; color:#434655; box-shadow:none; cursor:not-allowed; }
.btn-g {
    display:inline-flex; align-items:center; gap:.5rem;
    padding:.65rem 1.5rem; border-radius:.5rem;
    background:transparent; color:#c3c6d7;
    font-family:'Hanken Grotesk',sans-serif; font-size:16px;
    cursor:pointer; border:1px solid #434655; transition:all .2s;
}
.btn-g:hover { background:#2d3449; color:#dae2fd; }
.btn-cancel {
    display:inline-flex; align-items:center; gap:.5rem;
    padding:.65rem 1.25rem; background:transparent; color:#c3c6d7;
    font-family:'Hanken Grotesk',sans-serif; font-size:16px;
    cursor:pointer; border:none; transition:color .2s;
}
.btn-cancel:hover { color:#dae2fd; }
.mono { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.07em; font-weight:500; text-transform:uppercase; }

/* Close btn */
.close-btn {
    background:transparent; border:none; cursor:pointer; color:#c3c6d7;
    padding:4px; border-radius:4px; display:flex; align-items:center;
    justify-content:center; transition:color .2s; flex-shrink:0;
}
.close-btn:hover { color:#dae2fd; }
</style>

{{-- ────────────────────────────── STEP 1 ────────────────────────────── --}}
@if($step === 1)
<div style="background:#171f33; width:100%;">
    <div style="padding:1.75rem;">

        {{-- Header --}}
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem;">
            <div>
                <h1 style="font-family:'Playfair Display',serif; font-size:30px; font-weight:600; color:#dae2fd; margin:0; line-height:1.25;">Nouveau Projet</h1>
            </div>
            <button type="button" class="close-btn" @click="$dispatch('close-wizard')">
                <span class="ms-i" style="font-size:22px;">close</span>
            </button>
        </div>

        {{-- Stepper --}}
        @php $s1 = [1=>'PROJET',2=>'CONFIG.',3=>'RÉGION']; @endphp
        <div style="position:relative; margin-bottom:2.25rem;">
            <div style="position:absolute; top:15px; left:16px; right:16px; height:2px; background:#2d3449;"></div>
            <div style="position:absolute; top:15px; left:16px; height:2px; background:#b4c5ff; box-shadow:0 0 8px rgba(180,197,255,.45);
                width:calc({{ ($step-1)/2 }} * (100% - 32px)); transition:width .4s;"></div>
            <div style="position:relative; display:flex; justify-content:space-between; align-items:flex-start;">
                @foreach($s1 as $n => $lbl)
                @php
                    $cs1 = $step > $n
                        ? 'background:#b4c5ff; color:#002a78;'
                        : ($step === $n
                            ? 'background:#b4c5ff; color:#002a78; box-shadow:0 0 0 4px #171f33, 0 0 18px rgba(180,197,255,.35);'
                            : 'background:#2d3449; border:1px solid #434655; color:#c3c6d7;');
                @endphp
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; {{ $cs1 }}">
                        @if($step > $n)
                            <span class="ms-i fill" style="font-size:14px;">check</span>
                        @else
                            {{ $n }}
                        @endif
                    </div>
                    <span class="mono" style="color:{{ $step >= $n ? '#b4c5ff' : '#8d90a0' }}; font-size:10px;">{{ $lbl }}</span>
                </div>
                @endforeach
            </div>
        </div>

        {{-- Form --}}
        <form wire:submit.prevent="nextStep" style="display:flex; flex-direction:column; gap:1.25rem;">

            <div style="display:flex; flex-direction:column; gap:8px;">
                <label class="mono" style="color:{{ $errors->has('name') ? '#ffb4ab' : '#c3c6d7' }};">
                    NOM DU PROJET <span style="color:#ffb4ab;">*</span>
                </label>
                <div style="position:relative;">
                    <input wire:model="name" type="text" autofocus placeholder="Mon Super Projet"
                           class="wd-input {{ $errors->has('name') ? 'wd-input-err' : '' }}"
                           style="{{ $errors->has('name') ? 'padding-right:2.75rem; color:#ffb4ab;' : '' }}">
                    @error('name')
                        <span class="ms-i" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#ffb4ab; font-size:20px;">error</span>
                    @enderror
                </div>
                @error('name')
                    <p class="mono" style="color:#ffb4ab; font-size:11px; margin-top:2px;">{{ $message }}</p>
                @enderror
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
                <label class="mono" style="color:#c3c6d7;">
                    DESCRIPTION <span style="color:#8d90a0;">(OPTIONNEL)</span>
                </label>
                <textarea wire:model="description" rows="3"
                          placeholder="Décrivez brièvement les objectifs de ce projet..."
                          class="wd-input" style="resize:none;"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; align-items:center; gap:12px; padding-top:1.25rem; border-top:1px solid rgba(67,70,85,.3); margin-top:.25rem;">
                <button type="button" class="btn-cancel" @click="$dispatch('close-wizard')">Annuler</button>
                <button type="submit" class="btn-p">
                    Continuer
                    <span class="ms-i" style="font-size:18px;">arrow_forward</span>
                </button>
            </div>
        </form>
    </div>
</div>
@endif

{{-- ────────────────────────────── STEP 2 ────────────────────────────── --}}
@if($step === 2)
@php $pct2 = ($step - 1) / 2; @endphp
<div style="background:rgba(23,31,51,.82); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); width:100%;">

    {{-- Header: stepper + title --}}
    <div style="padding:1.25rem 1.5rem; border-bottom:1px solid rgba(67,70,85,.4); background:rgba(19,27,46,.35);">

        {{-- Stepper (40px circles) --}}
        <div style="margin:0 0 1.5rem; position:relative;">
            <div style="position:absolute; top:20px; left:20px; right:20px; height:1px; background:rgba(67,70,85,.35);"></div>
            <div style="position:absolute; top:20px; left:20px; height:1px; background:#b4c5ff; box-shadow:0 0 8px rgba(180,197,255,.5);
                width:calc({{ $pct2 }} * (100% - 40px)); transition:width .4s;"></div>

            <div style="position:relative; display:flex; justify-content:space-between; align-items:flex-start;">
                @foreach([1=>'Détails',2=>'Hébergement',3=>'Configuration'] as $n => $lbl)
                @php
                    $cs2 = $step > $n
                        ? 'background:#b4c5ff; color:#002a78; box-shadow:0 0 10px rgba(180,197,255,.4);'
                        : ($step === $n
                            ? 'background:#0b1326; border:2px solid #b4c5ff; color:#b4c5ff; box-shadow:0 0 15px rgba(37,99,235,.35);'
                            : 'background:#2d3449; border:1px solid #434655; color:#c3c6d7;');
                @endphp
                <div style="display:flex; flex-direction:column; align-items:center; gap:10px; position:relative;">
                    <div style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:600; flex-shrink:0; {{ $cs2 }}">
                        @if($step > $n)
                            <span class="ms-i fill" style="font-size:16px;">check</span>
                        @else
                            {{ $n }}
                        @endif
                    </div>
                    <span class="mono" style="color:{{ $step >= $n ? '#b4c5ff' : '#8d90a0' }}; font-size:10px;">{{ $lbl }}</span>
                </div>
                @endforeach
            </div>
        </div>

        <h2 style="font-family:'Playfair Display',serif; font-size:28px; font-weight:600; color:#dae2fd; text-align:center; margin:0 0 .5rem; line-height:1.3;">
            Type d'hébergement
        </h2>
        <p style="font-size:14px; color:#c3c6d7; text-align:center; line-height:1.6; margin:0 auto;">
            Choisissez où votre projet sera déployé et exécuté. Vous pourrez modifier certains paramètres plus tard.
        </p>
    </div>

    {{-- Cards --}}
    <div style="padding:1.25rem 1.5rem; background:rgba(11,19,38,.25);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">

            {{-- Idem SaaS --}}
            <div wire:click="$set('deployment_type','saas')"
                 class="hcard {{ $deployment_type === 'saas' ? 'sel' : '' }}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:48px; height:48px; border-radius:12px; background:#222a3d; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="ms-i" style="color:#b4c5ff; font-size:26px;">cloud</span>
                        </div>
                        <div>
                            <div style="font-size:16px; font-weight:600; color:#dae2fd; margin-bottom:5px;">Idem SaaS</div>
                            <span class="mono" style="background:#6001d1; color:#c9aeff; border:1px solid rgba(210,187,255,.2); padding:2px 8px; border-radius:4px; font-size:10px;">
                                Recommandé
                            </span>
                        </div>
                    </div>
                    <div class="rdot" style="margin-top:4px;"></div>
                </div>
                <p style="font-size:14px; color:#c3c6d7; line-height:1.6; flex:1; margin-bottom:1rem;">
                    L'expérience la plus simple et performante. Nous gérons l'infrastructure, la sécurité et la mise à l'échelle pour vous.
                </p>
                <div style="border-top:1px solid rgba(67,70,85,.4); padding-top:1rem; display:flex; flex-direction:column; gap:10px;">
                    @foreach([['auto_graph','Auto-scaling instantané'],['settings_backup_restore','Sauvegardes quotidiennes'],['support_agent','Support technique 24/7']] as [$ico,$feat])
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="ms-i" style="color:#b4c5ff; font-size:18px;">{{ $ico }}</span>
                        <span style="font-size:14px; color:#dae2fd;">{{ $feat }}</span>
                    </div>
                    @endforeach
                </div>
            </div>

            {{-- Mon propre serveur --}}
            <div wire:click="$set('deployment_type','own')"
                 class="hcard {{ $deployment_type === 'own' ? 'sel' : '' }}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:48px; height:48px; border-radius:12px; background:#222a3d; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <span class="ms-i" style="color:#c3c6d7; font-size:26px;">dns</span>
                        </div>
                        <div style="font-size:16px; font-weight:600; color:#dae2fd;">Mon propre serveur</div>
                    </div>
                    <div class="rdot" style="margin-top:4px;"></div>
                </div>
                <p style="font-size:14px; color:#c3c6d7; line-height:1.6; flex:1; margin-bottom:1rem;">
                    Connectez votre propre infrastructure AWS, GCP ou serveur dédié pour un contrôle total sur vos données et votre réseau.
                </p>
                <div style="border-top:1px solid rgba(67,70,85,.4); padding-top:1rem; display:flex; flex-direction:column; gap:10px;">
                    @foreach([['admin_panel_settings','Contrôle total (Root access)'],['tune','Configuration réseau sur mesure']] as [$ico,$feat])
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="ms-i" style="color:#8d90a0; font-size:18px;">{{ $ico }}</span>
                        <span style="font-size:14px; color:#c3c6d7;">{{ $feat }}</span>
                    </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    {{-- Footer --}}
    <div style="padding:1.25rem 1.75rem; border-top:1px solid rgba(67,70,85,.4); background:rgba(19,27,46,.35); display:flex; justify-content:space-between; align-items:center;">
        <button type="button" wire:click="prevStep" class="btn-g">
            <span class="ms-i" style="font-size:18px;">arrow_back</span>
            Retour
        </button>
        <button type="button" wire:click="selectType('{{ $deployment_type }}')" class="btn-p" style="padding:.75rem 2rem; font-size:17px;">
            Continuer
            <span class="ms-i" style="font-size:18px;">arrow_forward</span>
        </button>
    </div>
</div>
@endif

{{-- ────────────────────────────── STEP 3 ────────────────────────────── --}}
@if($step === 3)
@php $pct3 = ($step - 1) / 2; @endphp
<div style="background:rgba(23,31,51,.82); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); width:100%; display:flex; flex-direction:column; max-height:82vh; overflow:hidden;">

    {{-- Modal header --}}
    <div style="padding:1.5rem 1.75rem; border-bottom:1px solid rgba(67,70,85,.4); display:flex; justify-content:space-between; align-items:flex-start; flex-shrink:0;">
        <div>
            <h1 style="font-family:'Playfair Display',serif; font-size:26px; font-weight:600; color:#dae2fd; margin:0 0 4px; line-height:1.3;">Création de projet</h1>
            <p style="font-size:14px; color:#c3c6d7; margin:0;">Configurez votre nouvel environnement de travail.</p>
        </div>
        <button type="button" class="close-btn" @click="$dispatch('close-wizard')">
            <span class="ms-i" style="font-size:24px;">close</span>
        </button>
    </div>

    {{-- Scrollable content --}}
    <div style="padding:1.5rem 1.75rem; overflow-y:auto; flex:1;">

        {{-- Stepper --}}
        <div style="position:relative; margin-bottom:2rem;">
            <div style="position:absolute; top:15px; left:16px; right:16px; height:2px; background:#2d3449;"></div>
            <div style="position:absolute; top:15px; left:16px; height:2px; background:#b4c5ff; box-shadow:0 0 8px rgba(180,197,255,.4);
                width:calc({{ $pct3 }} * (100% - 32px));"></div>
            <div style="position:relative; display:flex; justify-content:space-between; align-items:flex-start;">
                @foreach([1=>'Détails',2=>'Hébergement',3=>'Région'] as $n => $lbl)
                @php
                    $cs3 = $step > $n
                        ? 'background:#b4c5ff; color:#002a78;'
                        : ($step === $n
                            ? 'background:#171f33; border:2px solid #b4c5ff; color:#b4c5ff; box-shadow:0 0 10px rgba(37,99,235,.3);'
                            : 'background:#2d3449; border:1px solid #434655; color:#c3c6d7;');
                @endphp
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                    <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; {{ $cs3 }}">
                        @if($step > $n)
                            <span class="ms-i fill" style="font-size:13px;">check</span>
                        @else
                            {{ $n }}
                        @endif
                    </div>
                    <span class="mono" style="color:{{ $step >= $n ? '#b4c5ff' : '#8d90a0' }}; font-size:10px;">{{ $lbl }}</span>
                </div>
                @endforeach
            </div>
        </div>

        {{-- Section title --}}
        <div style="margin-bottom:1.25rem;">
            <h2 style="font-size:16px; font-weight:600; color:#dae2fd; margin:0 0 4px;">Région d'hébergement</h2>
            <p style="font-size:14px; color:#c3c6d7; margin:0;">Choisissez l'emplacement physique de vos données pour optimiser la latence.</p>
        </div>

        {{-- Region groups --}}
        @foreach($countries as $group)
        <div style="margin-bottom:1.25rem;">
            <h3 class="mono" style="color:#8d90a0; font-size:10px; margin-bottom:10px; display:block;">{{ strtoupper($group['label']) }}</h3>
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
                @foreach($group['countries'] as $country)
                <button type="button" wire:click="selectRegion('{{ $country['code'] }}')"
                        class="rcard {{ $deployment_region === $country['code'] ? 'sel' : '' }}">
                    <span style="font-size:20px; line-height:1; flex-shrink:0;">{{ $country['flag'] }}</span>
                    <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                        <span style="font-size:13px; font-weight:600; color:#dae2fd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ $country['name'] }}</span>
                        <span class="mono" style="color:{{ $deployment_region === $country['code'] ? '#b4c5ff' : '#8d90a0' }}; font-size:10px;">{{ $country['city'] }}</span>
                    </div>
                    @if($deployment_region === $country['code'])
                        <span class="ms-i fill" style="color:#b4c5ff; font-size:16px; flex-shrink:0;">check_circle</span>
                    @endif
                </button>
                @endforeach
            </div>
        </div>
        @endforeach

        @error('deployment_region')
            <p class="mono" style="color:#ffb4ab; display:flex; align-items:center; gap:6px; font-size:11px; margin-top:.5rem;">
                <span class="ms-i" style="font-size:15px;">error</span>
                {{ $message }}
            </p>
        @enderror
    </div>

    {{-- Footer --}}
    <div style="padding:1.25rem 1.75rem; border-top:1px solid rgba(67,70,85,.4); background:rgba(19,27,46,.35); display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
        <button type="button" wire:click="prevStep" class="btn-g">
            <span class="ms-i" style="font-size:18px;">arrow_back</span>
            Retour
        </button>
        <button type="button" wire:click="submit" {{ !$deployment_region ? 'disabled' : '' }}
                class="btn-p" style="padding:.75rem 2rem; font-size:17px;">
            Créer le projet
            <span class="ms-i" style="font-size:18px;">rocket_launch</span>
        </button>
    </div>
</div>
@endif

</div>
