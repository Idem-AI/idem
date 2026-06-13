{{-- Sidebar Navigation --}}
<style>
    .sbi {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 12px;
        font-size: 14px; font-weight: 500; text-decoration: none;
        font-family: 'Jura', sans-serif;
        transition: all 0.18s ease; color: #9ba3c0; width: 100%;
        position: relative; overflow: hidden;
    }
    .sbi:hover {
        background: #2563eb;
        color: #fff;
        box-shadow: 0 4px 16px rgba(37,99,235,0.28);
    }
    .sbi.active {
        background: #2563eb;
        color: #fff;
        box-shadow: 0 4px 16px rgba(37,99,235,0.32);
    }
    .sbi.active::before {
        content: '';
        position: absolute; left: 0; top: 0; bottom: 0;
        width: 3px; border-radius: 0 3px 3px 0;
        background: #fff;
    }
    .sbi .sbi-icon { width: 18px; text-align: center; flex-shrink: 0; font-size: 14px; }
    .sbi-section {
        font-size: 9px; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: rgba(155,163,192,.38); padding: 0 12px;
        display: block; margin-bottom: 2px; font-family: 'Jura', sans-serif;
    }
    .sbi-disabled {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 12px;
        font-size: 14px; font-weight: 500;
        font-family: 'Jura', sans-serif;
        color: rgba(155,163,192,.35); width: 100%;
        opacity: 1; cursor: not-allowed;
    }
    .sbi-badge-soon {
        font-size: 9px; font-weight: 700; padding: 2px 7px;
        border-radius: 5px; letter-spacing: .06em; text-transform: uppercase;
        background: rgba(251,191,36,.12); color: #fbbf24;
        border: 1px solid rgba(251,191,36,.28);
    }
    /* Hide scrollbar */
    .sidebar-scroll { scrollbar-width: none; -ms-overflow-style: none; }
    .sidebar-scroll::-webkit-scrollbar { display: none; }
</style>

<nav class="flex flex-col flex-1 sidebar-scroll"
     style="background:rgba(2,6,23,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
            border-right:1px solid rgba(255,255,255,0.06); overflow-y:auto;"
     x-data="{
        switchWidth() {
            if (this.full === 'full') { localStorage.setItem('pageWidth', 'center'); }
            else { localStorage.setItem('pageWidth', 'full'); }
            window.location.reload();
        },
        setZoom(zoom) { localStorage.setItem('zoom', zoom); window.location.reload(); },
        init() {
            this.full = localStorage.getItem('pageWidth');
            this.zoom = localStorage.getItem('zoom');
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                const userSettings = localStorage.getItem('theme');
                if (userSettings !== 'system') { return; }
                if (e.matches) { document.documentElement.classList.add('dark'); }
                else { document.documentElement.classList.remove('dark'); }
            });
            this.queryTheme();
            this.checkZoom();
        },
        setTheme(type) { this.theme = type; localStorage.setItem('theme', type); this.queryTheme(); },
        queryTheme() {
            const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const userSettings = localStorage.getItem('theme') || 'dark';
            localStorage.setItem('theme', userSettings);
            if (userSettings === 'dark') { document.documentElement.classList.add('dark'); this.theme = 'dark'; }
            else if (userSettings === 'light') { document.documentElement.classList.remove('dark'); this.theme = 'light'; }
            else if (darkModePreference) { this.theme = 'system'; document.documentElement.classList.add('dark'); }
            else { this.theme = 'system'; document.documentElement.classList.remove('dark'); }
        },
        checkZoom() {
            if (this.zoom === null) { this.setZoom(100); }
            if (this.zoom === '90') {
                const style = document.createElement('style');
                style.textContent = `html { font-size: 93.75%; } :root { --vh: 1vh; } @media (min-width: 1024px) { html { font-size: 87.5%; } }`;
                document.head.appendChild(style);
            }
        }
     }">

    {{-- Team Selector --}}
    <div style="padding:16px 12px; border-bottom:1px solid rgba(255,255,255,0.06);">
        <livewire:switch-team />
    </div>

    {{-- Admin Panel --}}
    @auth
        @if(auth()->user()->idem_role === 'admin')
        <div style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06);">
            <a href="{{ route('idem.admin.dashboard') }}"
               class="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200"
               style="color:#ffb4ab;"
               onmouseover="this.style.background='rgba(255,100,80,0.1)';"
               onmouseout="this.style.background='';">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-shield-halved" style="width:18px;text-align:center;font-size:13px;"></i>
                    <span style="font-size:14px;font-weight:500;">Admin Panel</span>
                </div>
                <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(255,180,171,0.12);color:#ffb4ab;border:1px solid rgba(255,180,171,0.28);letter-spacing:.06em;text-transform:uppercase;">ADMIN</span>
            </a>
        </div>
        @endif
    @endauth

    {{-- Navigation --}}
    @if (isSubscribed() || !isCloud())
    <ul role="list" class="flex flex-col flex-1 px-3 py-5 gap-y-0.5">

        {{-- Dashboard --}}
        <li>
            <a href="{{ route('dashboard') }}"
               class="sbi {{ request()->routeIs('dashboard') ? 'active' : '' }}">
                <i class="fa-solid fa-house sbi-icon"></i>
                <span>Dashboard</span>
            </a>
        </li>

        {{-- DEPLOY --}}
        <li style="padding-top:20px; padding-bottom:5px;">
            <span class="sbi-section">Deploy</span>
        </li>

        <li>
            <div class="sbi-disabled" style="justify-content:space-between;">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-wand-magic-sparkles" style="width:18px;text-align:center;font-size:14px;"></i>
                    <span>AI Smart Deploy</span>
                </div>
                <span class="sbi-badge-soon">SOON</span>
            </div>
        </li>

        <li>
            <a href="/projects"
               class="sbi {{ request()->is('project/*') || request()->is('projects') ? 'active' : '' }}">
                <i class="fa-solid fa-layer-group sbi-icon"></i>
                <span>Projects</span>
            </a>
        </li>

        {{-- RESOURCES --}}
        <li style="padding-top:20px; padding-bottom:5px;">
            <span class="sbi-section">Resources</span>
        </li>

        <li>
            <a href="/servers"
               class="sbi {{ request()->is('server/*') || request()->is('servers') ? 'active' : '' }}">
                <i class="fa-solid fa-server sbi-icon"></i>
                <span>Servers</span>
            </a>
        </li>

        <li>
            <a href="{{ route('source.all') }}"
               class="sbi {{ request()->is('source*') ? 'active' : '' }}">
                <i class="fa-brands fa-git-alt sbi-icon"></i>
                <span>Sources</span>
            </a>
        </li>

        <li>
            <a href="{{ route('destination.index') }}"
               class="sbi {{ request()->is('destination*') ? 'active' : '' }}">
                <i class="fa-solid fa-network-wired sbi-icon"></i>
                <span>Destinations</span>
            </a>
        </li>

        <li>
            <a href="{{ route('storage.index') }}"
               class="sbi {{ request()->is('storages*') ? 'active' : '' }}">
                <i class="fa-solid fa-database sbi-icon"></i>
                <span>S3 Storages</span>
            </a>
        </li>

        {{-- CONFIGURATION --}}
        <li style="padding-top:20px; padding-bottom:5px;">
            <span class="sbi-section">Configuration</span>
        </li>

        @auth
            @if(auth()->user()->idem_role === 'admin')
            <li>
                <a href="{{ route('settings.index') }}"
                   class="sbi {{ request()->is('settings*') ? 'active' : '' }}">
                    <i class="fa-solid fa-gear sbi-icon"></i>
                    <span>Settings</span>
                </a>
            </li>
            @endif
        @endauth

        <li>
            <a href="{{ route('shared-variables.index') }}"
               class="sbi {{ request()->is('shared-variables*') ? 'active' : '' }}">
                <i class="fa-solid fa-code sbi-icon"></i>
                <span>Shared Variables</span>
            </a>
        </li>

        <li>
            <a href="{{ route('notifications.email') }}"
               class="sbi {{ request()->is('notifications*') ? 'active' : '' }}">
                <i class="fa-regular fa-bell sbi-icon"></i>
                <span>Notifications</span>
            </a>
        </li>

        <li>
            <a href="{{ route('security.private-key.index') }}"
               class="sbi {{ request()->is('security*') ? 'active' : '' }}">
                <i class="fa-solid fa-key sbi-icon"></i>
                <span>Keys &amp; Tokens</span>
            </a>
        </li>

    </ul>
    @endif

    {{-- Footer --}}
    <div class="flex items-center justify-between px-3 py-3"
         style="border-top:1px solid rgba(255,255,255,0.06);">
        <livewire:settings-dropdown />
        <button @click="$dispatch('open-global-search')" type="button"
                title="Search (Press / or ⌘K)"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#6b7280;font-size:13px;"
                onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#e3e1e6';"
                onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.color='#6b7280';">
            <i class="fa-solid fa-magnifying-glass" style="font-size:12px;"></i>
            <kbd class="px-1.5 py-0.5 text-xs rounded"
                 style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);">/</kbd>
        </button>
    </div>
</nav>
