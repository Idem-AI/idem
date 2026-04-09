<section class="py-32 px-6 relative z-10 border-t border-white/5">
    <div class="max-w-4xl mx-auto">
        <h2 class="text-4xl md:text-5xl font-black text-white text-center mb-16 drop-shadow-md" style="letter-spacing: -0.04em;">How it works</h2>

        <div class="glass-card relative p-8 md:p-16 rounded-[3rem] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
            <!-- Central connecting line -->
            <div class="absolute left-1/2 top-16 bottom-16 w-px bg-gradient-to-b from-primary-500/50 via-white/10 to-accent-500/50 transform -translate-x-1/2 hidden md:block"></div>

            <div class="space-y-16">
                <!-- Step 1 -->
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                    <div class="md:w-5/12 text-center md:text-right">
                        <h3 class="text-2xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">1. Connect Provider</h3>
                        <p class="text-white/60 font-medium">Link your GitHub, GitLab, or Bitbucket account. We only ask for the permissions we absolutely need.</p>
                    </div>
                    <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 border-primary-500 shadow-[0_0_20px_rgba(var(--color-primary-500-rgb),0.4)] relative z-10">
                        <span class="text-xl font-bold text-white">1</span>
                    </div>
                    <div class="md:w-5/12"></div>
                </div>

                <!-- Step 2 -->
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                    <div class="md:w-5/12 hidden md:block"></div>
                    <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 border-white/20 hover:border-white/50 transition-colors relative z-10">
                        <span class="text-xl font-bold text-white">2</span>
                    </div>
                    <div class="md:w-5/12 text-center md:text-left">
                        <h3 class="text-2xl font-bold text-white mb-2">2. Define Destination</h3>
                        <p class="text-white/60 font-medium">Add any Linux server using an SSH key. A $4/mo Hetzner VPS works just fine.</p>
                    </div>
                </div>

                <!-- Step 3 -->
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                    <div class="md:w-5/12 text-center md:text-right">
                        <h3 class="text-2xl font-bold text-white mb-2 group-hover:text-accent-400 transition-colors">3. Deploy</h3>
                        <p class="text-white/60 font-medium">Hit deploy. We automatically build the container and route the traffic. It just works.</p>
                    </div>
                    <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 border-accent-500 shadow-[0_0_20px_rgba(var(--color-accent-500-rgb),0.4)] relative z-10">
                        <span class="text-xl font-bold text-white">3</span>
                    </div>
                    <div class="md:w-5/12"></div>
                </div>
            </div>
        </div>
    </div>
</section>
