<section class="py-12 px-6 border-y border-white/5 bg-transparent overflow-hidden">
    <div class="max-w-7xl mx-auto flex items-center mb-8">
        <p class="text-white/40 text-sm font-bold uppercase tracking-widest px-4">Supported Stacks & Partners</p>
        <div class="flex-1 h-[1px] bg-white/5 ml-4"></div>
    </div>
    
    <!-- Infinite Scrolling Marquee using Tailwind classes or custom injected CSS -->
    <style>
        .marquee-wrapper {
            display: flex;
            overflow: hidden;
            user-select: none;
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .marquee-content {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-around;
            min-width: 100%;
            gap: 4rem;
            animation: scroll 30s linear infinite;
            padding-right: 4rem;
        }
        @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
        }
    </style>

    <div class="marquee-wrapper mx-auto max-w-7xl">
        <div class="marquee-content">
            <!-- Figma-like flat bold text logos for technologies -->
            <span class="text-3xl font-black text-white/40">Node.js</span>
            <span class="text-3xl font-black text-white/40">Python</span>
            <span class="text-3xl font-black text-white/40">Laravel</span>
            <span class="text-3xl font-black text-white/40">PostgreSQL</span>
            <span class="text-3xl font-black text-white/40">GitHub</span>
            <span class="text-3xl font-black text-white/40">Docker</span>
            <span class="text-3xl font-black text-white/40">Redis</span>
            <span class="text-3xl font-black text-white/40">Next.js</span>
        </div>
        <!-- Duplicated for infinite effect -->
        <div class="marquee-content" aria-hidden="true">
            <span class="text-3xl font-black text-white/40">Node.js</span>
            <span class="text-3xl font-black text-white/40">Python</span>
            <span class="text-3xl font-black text-white/40">Laravel</span>
            <span class="text-3xl font-black text-white/40">PostgreSQL</span>
            <span class="text-3xl font-black text-white/40">GitHub</span>
            <span class="text-3xl font-black text-white/40">Docker</span>
            <span class="text-3xl font-black text-white/40">Redis</span>
            <span class="text-3xl font-black text-white/40">Next.js</span>
        </div>
    </div>
</section>
