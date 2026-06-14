<div>
    <x-slot:title>
        {{ data_get_str($project, 'name')->limit(10) }} > Resources | Ideploy
    </x-slot>

    <style>
        /* ── Font helpers (fonts already in base.blade.php) ───────────── */
        .ic-font-display { font-family: 'Playfair Display', Georgia, serif; }
        .ic-font-mono    { font-family: 'JetBrains Mono', 'Courier New', monospace; }
        .ic-font-body    { font-family: 'Hanken Grotesk', 'Inter', sans-serif; }

        /* ── Resource card ────────────────────────────────────────────── */
        .ic-card {
            background: #1a2235;
            border: 1px solid #2a3550;
            border-radius: 0.75rem;
            transition: all 0.3s ease;
        }
        .ic-card:hover {
            border-color: rgba(180,197,255,.3);
            box-shadow: 0 8px 32px -4px rgba(37,99,235,.15);
            transform: translateY(-2px);
        }

        /* ── Status badges ────────────────────────────────────────────── */
        .ic-badge-exited  { background:#3d1515; color:#f87171; border:1px solid rgba(248,113,113,.3); }
        .ic-badge-running { background:#0d2a1f; color:#4ade80; border:1px solid rgba(74,222,128,.3);  }
        .ic-badge-starting{ background:#1a2a0d; color:#facc15; border:1px solid rgba(250,204,21,.3);  }
        .ic-badge-warn    { background:#2a1a0d; color:#fb923c; border:1px solid rgba(251,146,60,.3);  }
    </style>

    {{-- Header Époustouflant --}}
    <div class="mb-8">
        {{-- Breadcrumb Moderne --}}
        <nav class="flex pt-2 pb-6">
            <ol class="flex items-center gap-1">
                <li class="inline-flex items-center">
                    <a class="text-sm font-medium text-light/70 hover:text-accent transition-colors px-2 py-1 rounded hover:bg-white/5"
                        href="{{ route('project.show', ['project_uuid' => data_get($parameters, 'project_uuid')]) }}">
                        {{ $project->name }}
                    </a>
                    <svg class="w-4 h-4 mx-1 text-light/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </li>
                <li class="inline-flex items-center">
                    <livewire:project.resource.environment-select :environments="$project->environments" />
                </li>
            </ol>
        </nav>

        {{-- Header Principal avec Gradient --}}
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent border border-accent/20 p-8 mb-6">
            {{-- Background Pattern --}}
            <div class="absolute inset-0 opacity-5">
                <div class="absolute inset-0" style="background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 32px 32px;"></div>
            </div>

            <div class="relative flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="icon-container w-16 h-16">
                        <svg class="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-4xl font-bold text-light mb-2">
                            <span class="i-underline">Resources</span>
                        </h1>
                        <p class="text-light/70 text-lg">Manage your applications, databases and services</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    @if ($environment->isEmpty())
                        @can('createAnyResource')
                            <a class="outer-button px-6 py-3"
                                href="{{ route('project.clone-me', ['project_uuid' => data_get($project, 'uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}">
                                <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Clone
                            </a>
                        @endcan
                    @else
                        @can('createAnyResource')
                            <a href="{{ route('project.resource.create', ['project_uuid' => data_get($parameters, 'project_uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}"
                                class="inner-button px-6 py-3">
                                <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                New Resource
                            </a>
                            <a class="outer-button px-6 py-3"
                                href="{{ route('project.clone-me', ['project_uuid' => data_get($project, 'uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}">
                                <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Clone
                            </a>
                        @endcan
                    @endif
                    @can('delete', $environment)
                        <livewire:project.delete-environment :disabled="!$environment->isEmpty()" :environment_id="$environment->id" />
                    @endcan
                </div>
            </div>
        </div>
    </div>

    @if ($environment->isEmpty())
        @can('createAnyResource')
            <div class="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/15 flex items-center justify-center mb-6">
                    <svg class="w-10 h-10 text-violet-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-white mb-2">Aucune ressource pour le moment</h3>
                <p class="text-sm text-gray-400 mb-8 max-w-sm leading-relaxed">
                    Déployez votre première application, base de données ou service dans cet environnement.
                </p>
                <a href="{{ route('project.resource.create', ['project_uuid' => data_get($parameters, 'project_uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}"
                    class="inner-button">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                    </svg>
                    Ajouter une ressource
                </a>
                <a href="{{ route('project.clone-me', ['project_uuid' => data_get($parameters, 'project_uuid'), 'environment_uuid' => data_get($environment, 'uuid')]) }}"
                    class="mt-3 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"/>
                    </svg>
                    Ou cloner un projet existant
                </a>
            </div>
        @else
            <div class="flex flex-col items-center justify-center p-8 text-center border border-dashed border-neutral-300 dark:border-coolgray-300 rounded-lg">
                <h3 class="mb-2 text-lg font-semibold text-neutral-600 dark:text-neutral-400">No Resources Found</h3>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    This environment doesn't have any resources yet.<br>
                    Contact your team administrator to add resources.
                </p>
            </div>
        @endcan
    @else
        <div x-data="searchComponent()">

            {{-- Search Bar --}}
            <div class="relative mb-8">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style="font-size:20px;color:#64748b">search</span>
                <input
                    type="text"
                    x-model="search"
                    placeholder="Search for name, domain, or description..."
                    class="w-full pl-11 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                    style="background:#1e2533;border:1px solid #2a3550;color:#e2e8f0;font-family:'Hanken Grotesk','Inter',sans-serif"
                    onfocus="this.style.borderColor='rgba(37,99,235,.5)'"
                    onblur="this.style.borderColor='#2a3550'"
                />
                <button x-show="search.length > 0" @click="search = ''"
                        class="absolute inset-y-0 right-3 flex items-center">
                    <span class="material-symbols-outlined" style="font-size:18px;color:#64748b">close</span>
                </button>
            </div>

            {{-- No Results --}}
            <template x-if="filteredApplications.length === 0 && filteredDatabases.length === 0 && filteredServices.length === 0">
                <div class="flex flex-col items-center justify-center p-8 text-center">
                    <div x-show="search.length > 0">
                        <p style="color:#94a3b8">No resource found for "<span class="font-semibold" x-text="search"></span>".</p>
                    </div>
                    <div x-show="search.length === 0">
                        <p style="color:#94a3b8">No resources found in this environment.</p>
                    </div>
                </div>
            </template>

            {{-- ─── Applications ─────────────────────────────────────────── --}}
            <template x-if="filteredApplications.length > 0">
                <div class="flex items-center gap-3 mb-6">
                    <span class="material-symbols-outlined" style="font-size:24px;color:#60a5fa;font-variation-settings:'FILL' 0">apps</span>
                    <h2 class="ic-font-display m-0" style="font-size:28px;font-weight:600;color:#e2e8f0">Applications</h2>
                    <span class="ic-font-mono rounded-full px-2 py-0.5"
                          style="font-size:11px;background:#1e2533;color:#94a3b8;border:1px solid #2a3550"
                          x-text="filteredApplications.length"></span>
                </div>
            </template>

            <div x-show="filteredApplications.length > 0"
                 class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-12">
                <template x-for="item in filteredApplications" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="ic-card p-5 flex flex-col relative">

                            {{-- Header: icon + name + badge + 3-dots --}}
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                         style="background:rgba(29,58,110,.35);border:1px solid rgba(96,165,250,.25)">
                                        <span class="material-symbols-outlined" style="font-size:20px;color:#60a5fa;font-variation-settings:'FILL' 0">settings</span>
                                    </div>
                                    <h3 class="ic-font-body text-sm font-semibold truncate group-hover:text-[#93c5fd] transition-colors"
                                        style="color:#e2e8f0;max-width:180px"
                                        x-text="item.name" :title="item.name"></h3>
                                </div>
                                <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                                    {{-- Status badge inline --}}
                                    <template x-if="item.status && item.status.startsWith('running')">
                                        <span class="ic-badge-running ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>Running
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('exited')">
                                        <span class="ic-badge-exited ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full" style="background:#f87171"></span>Exited
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('starting')">
                                        <span class="ic-badge-starting ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse"></span>Starting
                                        </span>
                                    </template>
                                    <button class="p-1 rounded hover:bg-white/5 transition-colors" style="color:#64748b" @click.prevent>
                                        <span class="material-symbols-outlined" style="font-size:18px">more_vert</span>
                                    </button>
                                </div>
                            </div>

                            {{-- URL in blue --}}
                            <div class="mb-4">
                                <p class="ic-font-mono text-xs truncate" style="color:#60a5fa"
                                   x-text="item.fqdn || 'No domain configured'"></p>
                            </div>

                            {{-- Footer: git meta + date --}}
                            <div class="mt-auto flex flex-col gap-1.5 pt-3" style="border-top:1px solid #2a3550">
                                <div class="flex items-center gap-4 ic-font-mono" style="font-size:10px;color:#94a3b8">
                                    <span class="flex items-center gap-1 truncate" style="max-width:48%">
                                        <span class="material-symbols-outlined" style="font-size:14px;flex-shrink:0">code</span>
                                        <span class="truncate" x-text="item.git_repository || 'No repository'"></span>
                                    </span>
                                    <span class="flex items-center gap-1 truncate" style="max-width:48%">
                                        <span class="material-symbols-outlined" style="font-size:14px;flex-shrink:0">commit</span>
                                        <span x-text="item.last_commit || 'Initial commit'"></span>
                                    </span>
                                </div>
                                <div class="ic-font-mono" style="font-size:9px;color:#64748b">
                                    <span x-text="item.updated_at || 'Just now'"></span>
                                    <span> on ⑂ </span>
                                    <span x-text="item.git_branch || 'main'"></span>
                                </div>
                            </div>
                        </div>
                    </a>
                </template>
            </div>

            {{-- ─── Databases ─────────────────────────────────────────────── --}}
            <template x-if="filteredDatabases.length > 0">
                <div class="flex items-center gap-3 mb-6 pt-6" style="border-top:1px solid #2a3550">
                    <span class="material-symbols-outlined" style="font-size:24px;color:#a78bfa;font-variation-settings:'FILL' 0">storage</span>
                    <h2 class="ic-font-display m-0" style="font-size:28px;font-weight:600;color:#e2e8f0">Databases</h2>
                    <span class="ic-font-mono rounded-full px-2 py-0.5"
                          style="font-size:11px;background:#1e2533;color:#94a3b8;border:1px solid #2a3550"
                          x-text="filteredDatabases.length"></span>
                </div>
            </template>

            <div x-show="filteredDatabases.length > 0"
                 class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-12">
                <template x-for="item in filteredDatabases" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="ic-card p-5 flex flex-col relative" style="border-top:2px solid rgba(167,139,250,.3)">

                            {{-- Header: icon + name + subtitle + badge + 3-dots --}}
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                         style="background:rgba(88,28,135,.25);border:1px solid rgba(167,139,250,.25)">
                                        <span class="material-symbols-outlined" style="font-size:20px;color:#a78bfa;font-variation-settings:'FILL' 0">database</span>
                                    </div>
                                    <div class="min-w-0">
                                        <h3 class="ic-font-body text-sm font-semibold truncate group-hover:text-[#c4b5fd] transition-colors"
                                            style="color:#e2e8f0;max-width:180px"
                                            x-text="item.name" :title="item.name"></h3>
                                        <span class="ic-font-mono" style="font-size:10px;color:#64748b" x-text="item.type || 'Database'"></span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <template x-if="item.status && item.status.startsWith('running')">
                                        <span class="ic-badge-running ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>Running
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('exited')">
                                        <span class="ic-badge-exited ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full" style="background:#f87171"></span>Exited
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('starting')">
                                        <span class="ic-badge-starting ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse"></span>Starting
                                        </span>
                                    </template>
                                    <template x-if="item.server_status == false">
                                        <span class="ic-badge-warn ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="material-symbols-outlined" style="font-size:12px">warning</span>Server
                                        </span>
                                    </template>
                                    <button class="p-1 rounded hover:bg-white/5 transition-colors" style="color:#64748b" @click.prevent>
                                        <span class="material-symbols-outlined" style="font-size:18px">more_vert</span>
                                    </button>
                                </div>
                            </div>

                            {{-- Footer: date --}}
                            <div class="mt-auto pt-3" style="border-top:1px solid #2a3550">
                                <div class="ic-font-mono" style="font-size:9px;color:#64748b" x-text="item.updated_at || 'Just now'"></div>
                            </div>
                        </div>
                    </a>
                </template>
            </div>

            {{-- ─── Services ───────────────────────────────────────────────── --}}
            <template x-if="filteredServices.length > 0">
                <div class="flex items-center gap-3 mb-6 pt-6" style="border-top:1px solid #2a3550">
                    <span class="material-symbols-outlined" style="font-size:24px;color:#67e8f9;font-variation-settings:'FILL' 0">layers</span>
                    <h2 class="ic-font-display m-0" style="font-size:28px;font-weight:600;color:#e2e8f0">Services</h2>
                    <span class="ic-font-mono rounded-full px-2 py-0.5"
                          style="font-size:11px;background:#1e2533;color:#94a3b8;border:1px solid #2a3550"
                          x-text="filteredServices.length"></span>
                </div>
            </template>

            <div x-show="filteredServices.length > 0"
                 class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 pb-12">
                <template x-for="item in filteredServices" :key="item.uuid">
                    <a :href="item.hrefLink" class="group block">
                        <div class="ic-card p-5 flex flex-col relative" style="border-top:2px solid rgba(103,232,249,.3)">

                            {{-- Header: icon + name + subtitle + badge + 3-dots --}}
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                         style="background:rgba(21,94,117,.25);border:1px solid rgba(103,232,249,.25)">
                                        <span class="material-symbols-outlined" style="font-size:20px;color:#67e8f9;font-variation-settings:'FILL' 0">account_balance_wallet</span>
                                    </div>
                                    <div class="min-w-0">
                                        <h3 class="ic-font-body text-sm font-semibold truncate group-hover:text-[#a5f3fc] transition-colors"
                                            style="color:#e2e8f0;max-width:180px"
                                            x-text="item.name" :title="item.name"></h3>
                                        <span class="ic-font-mono" style="font-size:10px;color:#64748b" x-text="item.type || 'Service'"></span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <template x-if="item.status && item.status.startsWith('running')">
                                        <span class="ic-badge-running ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>Running
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('exited')">
                                        <span class="ic-badge-exited ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full" style="background:#f87171"></span>Exited
                                        </span>
                                    </template>
                                    <template x-if="item.status && item.status.startsWith('starting')">
                                        <span class="ic-badge-starting ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse"></span>Starting
                                        </span>
                                    </template>
                                    <template x-if="item.server_status == false">
                                        <span class="ic-badge-warn ic-font-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5" style="font-size:10px">
                                            <span class="material-symbols-outlined" style="font-size:12px">warning</span>Server
                                        </span>
                                    </template>
                                    <button class="p-1 rounded hover:bg-white/5 transition-colors" style="color:#64748b" @click.prevent>
                                        <span class="material-symbols-outlined" style="font-size:18px">more_vert</span>
                                    </button>
                                </div>
                            </div>

                            {{-- Footer: date --}}
                            <div class="mt-auto pt-3" style="border-top:1px solid #2a3550">
                                <div class="ic-font-mono" style="font-size:9px;color:#64748b" x-text="item.updated_at || 'Just now'"></div>
                            </div>
                        </div>
                    </a>
                </template>
            </div>

        </div>
    @endif

</div>

<script>
    function sortFn(a, b) {
        return a.name.localeCompare(b.name)
    }

    function searchComponent() {
        return {
            search: '',
            applications: @js($applications),
            postgresqls: @js($postgresqls),
            redis: @js($redis),
            mongodbs: @js($mongodbs),
            mysqls: @js($mysqls),
            mariadbs: @js($mariadbs),
            keydbs: @js($keydbs),
            dragonflies: @js($dragonflies),
            clickhouses: @js($clickhouses),
            services: @js($services),
            filterAndSort(items) {
                if (this.search === '') {
                    return Object.values(items).sort(sortFn);
                }
                const searchLower = this.search.toLowerCase();
                return Object.values(items).filter(item => {
                    return (item.name?.toLowerCase().includes(searchLower) ||
                        item.fqdn?.toLowerCase().includes(searchLower) ||
                        item.description?.toLowerCase().includes(searchLower) ||
                        item.tags?.some(tag => tag.name.toLowerCase().includes(searchLower)));
                }).sort(sortFn);
            },
            get filteredApplications() {
                return this.filterAndSort(this.applications)
            },
            get filteredDatabases() {
                return [
                    this.postgresqls,
                    this.redis,
                    this.mongodbs,
                    this.mysqls,
                    this.mariadbs,
                    this.keydbs,
                    this.dragonflies,
                    this.clickhouses,
                ].flatMap((items) => this.filterAndSort(items))
            },
            get filteredServices() {
                return this.filterAndSort(this.services)
            }
        };
    }
</script>
