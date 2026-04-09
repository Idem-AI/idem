<section class="py-32 px-6 relative z-10">
    <div class="max-w-7xl mx-auto flex flex-col gap-32">
        
        <!-- Pillar 1: Text Left, Graphic Right -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div class="max-w-xl">
                <div class="w-16 h-16 rounded-[1rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_20px_rgba(var(--color-primary-500-rgb),0.3)] backdrop-blur-md">
                    <span class="text-2xl drop-shadow-[0_0_10px_var(--color-primary-500)]" style="color: var(--color-primary-500)">1</span>
                </div>
                <h2 class="text-5xl font-black text-white mb-6 leading-tight drop-shadow-md" style="letter-spacing: -0.04em;">Push to deploy.<br>It's that simple.</h2>
                <p class="text-xl text-white/60 mb-8 font-medium leading-relaxed">
                    Connect your GitHub repo, select your branch, and hit deploy. EPLOY automatically builds your Docker image, provisions an SSL cert, and launches your app securely.
                </p>
                <div class="flex flex-col gap-5 font-bold text-white/80">
                    <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 highlight-glow group">
                        <div class="w-3 h-3 rounded-full shadow-[0_0_10px_var(--color-primary-500)] group-hover:scale-150 transition-transform" style="background: var(--color-primary-500)"></div>
                        <span>Automatic builds based on Nixpacks</span>
                    </div>
                    <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 highlight-glow group">
                        <div class="w-3 h-3 rounded-full shadow-[0_0_10px_var(--color-primary-500)] group-hover:scale-150 transition-transform" style="background: var(--color-primary-500)"></div>
                        <span>Pre-configured Let's Encrypt SSL</span>
                    </div>
                </div>
            </div>
            
            <!-- Large High-Fidelity Screenshot Mock Right -->
            <div class="relative w-full aspect-square rounded-[2rem] p-4 md:p-8 flex items-center justify-center">
                <!-- Huge abstract glow behind -->
                <div class="absolute w-[80%] h-[80%] rounded-full blur-[100px] bg-gradient-to-tr from-primary-500/30 to-transparent"></div>
                
                <div class="glass-card relative w-full h-full rounded-[1.5rem] border py-2 border-white/10 shadow-[0_20px_50px_-20px_rgba(var(--color-primary-500-rgb),0.5)] overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none"></div>
                    <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="Code deployment log">
                    
                    <!-- Overlay floating glass element -->
                    <div class="absolute bottom-8 left-8 right-8 z-20 glass-card bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex items-center gap-6">
                        <div class="w-16 h-16 rounded-full flex items-center justify-center bg-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <div class="text-xl font-bold text-white mb-1 shadow-black drop-shadow-md">Production Ready</div>
                            <div class="text-sm text-green-400 font-mono">deployment-39ffa2z completed in 12.4s</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pillar 2: Graphic Left, Text Right -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <!-- Large High-Fidelity Screenshot Mock Left -->
            <div class="order-2 lg:order-1 relative w-full aspect-[4/3] md:aspect-square rounded-[2rem] p-4 md:p-8 flex items-center justify-center">
                <!-- Huge abstract glow behind -->
                <div class="absolute w-[80%] h-[80%] rounded-full blur-[100px] bg-gradient-to-tr from-accent-500/30 to-transparent"></div>
                
                <div class="glass-card relative w-full h-full rounded-[1.5rem] border border-white/10 shadow-[0_20px_50px_-20px_rgba(var(--color-accent-500-rgb),0.5)] overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none"></div>
                    <!-- Abstract server data visual -->
                    <img src="https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=1200&auto=format&fit=crop" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="Server clusters data">
                    
                    <!-- Overlay floating data nodes -->
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 grid grid-cols-2 gap-4 w-[80%]">
                        <div class="glass-card bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:-translate-y-2 transition-transform cursor-pointer">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold bg-[#336791]/80 text-white shadow-[0_0_15px_rgba(51,103,145,0.6)] mb-3">Pg</div>
                            <div class="font-bold text-white text-md">PostgreSQL 14</div>
                            <div class="text-xs text-green-400 mt-1">Healthy • 20ms</div>
                        </div>
                        <div class="glass-card bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl p-5 hover:-translate-y-2 transition-transform cursor-pointer">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold bg-[#D82C20]/80 text-white shadow-[0_0_15px_rgba(216,44,32,0.6)] mb-3">Re</div>
                            <div class="font-bold text-white text-md">Redis Cached</div>
                            <div class="text-xs text-green-400 mt-1">Healthy • 3ms</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="order-1 lg:order-2 max-w-xl lg:pl-10">
                <div class="w-16 h-16 rounded-[1rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_20px_rgba(var(--color-accent-500-rgb),0.3)] backdrop-blur-md">
                    <span class="text-2xl drop-shadow-[0_0_10px_var(--color-accent-500)]" style="color: var(--color-accent-500)">2</span>
                </div>
                <h2 class="text-5xl font-black text-white mb-6 leading-tight drop-shadow-md" style="letter-spacing: -0.04em;">Instantiate DBs<br>in 1-Click.</h2>
                <p class="text-xl text-white/60 mb-8 font-medium leading-relaxed">
                    Stop manually configuring databases. Provision Postgres, Redis, MongoDB, or MySQL instances in one click. Completely managed, inherently secure, with native scheduled backups.
                </p>
                <div class="flex flex-col gap-5 font-bold text-white/80">
                    <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 highlight-glow group">
                        <div class="w-3 h-3 rounded-full shadow-[0_0_10px_var(--color-accent-500)] group-hover:scale-150 transition-transform" style="background: var(--color-accent-500)"></div>
                        <span>Scheduled S3 backups natively supported</span>
                    </div>
                    <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 highlight-glow group">
                        <div class="w-3 h-3 rounded-full shadow-[0_0_10px_var(--color-accent-500)] group-hover:scale-150 transition-transform" style="background: var(--color-accent-500)"></div>
                        <span>Automatic environment variable tunneling</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
