import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * Public iDeploy landing page — faithful Angular port of the Laravel
 * livewire/landing views (hero, marquee, showcase, pillars, features,
 * testimonial, roles, how-it-works, pricing, footer). Same markup, classes and
 * content; CSS utilities (glass-card, inner/outer-button, i-underline, marquee)
 * come from @idem/shared-styles + styles.css.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen text-white overflow-hidden" style="font-family: 'Jura', sans-serif;">
      <!-- Global glassmorphism accents -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div class="absolute w-[1000px] h-[800px] rounded-full blur-[120px] opacity-20"
             style="top:-30%;left:-10%;background: radial-gradient(circle, var(--color-primary-500) 0%, transparent 70%);"></div>
        <div class="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
             style="bottom:-20%;right:-10%;background: radial-gradient(circle, var(--color-accent-500) 0%, transparent 70%);"></div>
      </div>

      <div class="relative z-10 space-y-12">
        <!-- ===== NAVBAR ===== -->
        <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-5 border-b border-white/5"
             style="background: rgba(6,8,13,0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="/ideploy-logo.png" alt="EPLOY Logo" class="w-[150px] h-auto object-cover"
                   style="filter: drop-shadow(0 0 15px var(--color-primary-500));" />
            </div>
            <div class="hidden md:flex items-center gap-8">
              <a href="#showcase" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Showcase</a>
              <a href="#features" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Platform</a>
              <a href="#pricing" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">Pricing</a>
            </div>
            @if (user(); as u) {
              <div class="relative">
                <button (click)="menuOpen.set(!menuOpen())"
                        class="flex items-center gap-4 p-1 rounded-full hover:bg-white/5 transition-all border border-white/10 glass-card">
                  <img [src]="u.photoURL || avatarFor(u)" [alt]="u.displayName || u.email"
                       class="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm" />
                </button>
                @if (menuOpen()) {
                  <div class="absolute right-0 mt-2 w-56 rounded-xl glass-card overflow-hidden">
                    <div class="py-2">
                      <a routerLink="/dashboard" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">Dashboard</a>
                      <button (click)="logout()" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/5">Logout</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="flex items-center gap-4">
                <a [href]="loginUrl" class="hidden sm:block text-sm font-semibold text-white/70 hover:text-white">Log in</a>
                <a [href]="loginUrl" class="inner-button text-sm px-5 py-2.5">Get started</a>
              </div>
            }
          </div>
        </nav>

        <!-- ===== HERO ===== -->
        <section class="relative min-h-screen flex flex-col justify-center px-6 pt-32 pb-16 overflow-hidden">
          <div class="absolute inset-0 z-0">
            <div class="absolute inset-0 z-10" style="background: linear-gradient(to bottom, rgba(6,8,13,0.5), rgba(6,8,13,0.7), #06080d);"></div>
            <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2000&auto=format&fit=crop"
                 alt="Server Room" class="w-full h-full object-cover opacity-40 mix-blend-lighten" style="filter: grayscale(50%);" />
          </div>
          <div class="relative z-10 max-w-5xl mx-auto w-full flex flex-col items-center text-center px-4">
            <div class="max-w-4xl mx-auto">
              <h1 class="font-black mb-8 text-white break-words"
                  style="font-size: clamp(3.8rem, 8vw, 7.5rem); line-height:1.05; letter-spacing: -0.04em; text-shadow: 0 0 40px rgba(0,0,0,0.5);">
                Deploy apps,<br /><span class="i-underline text-secondary">Not servers</span>
              </h1>
              <p class="text-[20px] md:text-[24px] text-white/70 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
                The leading platform to deploy, scale, and secure your applications without leaving your workspace. Powered by Idem.
              </p>
              <div class="flex flex-col sm:flex-row gap-6 justify-center">
                <a [href]="loginUrl" class="inner-button px-12 py-5 text-xl">Get started for free</a>
                <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button px-12 py-5 text-xl">Talk to sales</a>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== MARQUEE ===== -->
        <section class="py-12 px-6 border-y border-white/5 bg-transparent overflow-hidden">
          <div class="max-w-7xl mx-auto flex items-center mb-8">
            <p class="text-white/40 text-sm font-bold uppercase tracking-widest px-4">Supported Stacks & Partners</p>
            <div class="flex-1 h-px bg-white/5 ml-4"></div>
          </div>
          <div class="marquee-wrapper mx-auto max-w-7xl">
            @for (n of [0, 1]; track n) {
              <div class="marquee-content" [attr.aria-hidden]="n === 1 ? true : null">
                @for (tech of stacks; track tech) {
                  <span class="text-3xl font-black text-white/40">{{ tech }}</span>
                }
              </div>
            }
          </div>
        </section>

        <!-- ===== SHOWCASE ===== -->
        <section id="showcase" class="py-32 px-6 relative z-10 border-t border-white/5 mt-16 bg-transparent">
          <div class="max-w-7xl mx-auto">
            <div class="mb-16">
              <h1 class="text-4xl md:text-5xl font-black text-white mb-6" style="letter-spacing:-0.04em;">
                Explore what <span class="i-underline">people are building</span>
              </h1>
              <p class="text-xl text-white/60 max-w-2xl font-medium">From complex microservices architectures to simple static portfolios, see how Eploy powers the independent web.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              @for (p of showcase; track p.title) {
                <div class="group cursor-pointer">
                  <div class="glass-card aspect-[4/3] rounded-2xl overflow-hidden mb-4 border border-white/10 transition-all duration-300 relative shadow-lg">
                    <img [src]="p.img" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" [alt]="p.title" />
                  </div>
                  <h3 class="text-lg font-bold text-white mb-1 transition-colors">{{ p.title }}</h3>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-white/50 border-b border-white/10">{{ p.author }}</span>
                  </div>
                </div>
              }
            </div>
            <div class="mt-12 text-center">
              <a [href]="loginUrl" class="outer-button px-8 py-3 text-sm inline-flex">Join the community</a>
            </div>
          </div>
        </section>

        <!-- ===== PILLARS ===== -->
        <section class="py-32 px-6 relative z-10">
          <div class="max-w-7xl mx-auto flex flex-col gap-32">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div class="max-w-xl">
                <div class="w-16 h-16 rounded-[1rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10 backdrop-blur-md">
                  <span class="text-2xl" style="color: var(--color-primary-500)">1</span>
                </div>
                <h1 class="text-5xl font-black text-white mb-6 leading-tight" style="letter-spacing:-0.04em;">Push to <span class="i-underline">deploy</span>.<br />It's that simple.</h1>
                <p class="text-xl text-white/60 mb-8 font-medium leading-relaxed">Connect your GitHub repo, select your branch, and hit deploy. EPLOY automatically builds your Docker image, provisions an SSL cert, and launches your app securely.</p>
                <div class="flex flex-col gap-5 font-bold text-white/80">
                  <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 group">
                    <div class="w-3 h-3 rounded-full group-hover:scale-150 transition-transform" style="background: var(--color-primary-500)"></div>
                    <span>Automatic builds based on Nixpacks</span>
                  </div>
                  <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 group">
                    <div class="w-3 h-3 rounded-full group-hover:scale-150 transition-transform" style="background: var(--color-primary-500)"></div>
                    <span>Pre-configured Let's Encrypt SSL</span>
                  </div>
                </div>
              </div>
              <div class="relative w-full aspect-square rounded-[2rem] p-4 md:p-8 flex items-center justify-center">
                <div class="absolute w-[80%] h-[80%] rounded-full blur-[100px]" style="background: linear-gradient(to top right, rgba(37,99,235,0.3), transparent);"></div>
                <div class="glass-card relative w-full h-full rounded-[1.5rem] border py-2 border-white/10 overflow-hidden group">
                  <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop" class="w-full h-full object-cover" alt="Code deployment log" />
                  <div class="absolute bottom-8 left-8 right-8 z-20 glass-card border border-white/10 rounded-2xl p-6 flex items-center gap-6" style="background: rgba(0,0,0,0.6);">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background: rgba(34,197,94,0.2);">
                      <i class="fa-solid fa-check text-2xl text-green-400"></i>
                    </div>
                    <div>
                      <div class="text-xl font-bold text-white mb-1">Production Ready</div>
                      <div class="text-sm text-green-400 font-mono">deployment-39ffa2z completed in 12.4s</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div class="order-2 lg:order-1 relative w-full aspect-[4/3] md:aspect-square rounded-[2rem] p-4 md:p-8 flex items-center justify-center">
                <div class="absolute w-[80%] h-[80%] rounded-full blur-[100px]" style="background: linear-gradient(to top right, rgba(34,211,238,0.3), transparent);"></div>
                <div class="glass-card relative w-full h-full rounded-[1.5rem] border border-white/10 overflow-hidden group">
                  <img src="https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=1200&auto=format&fit=crop" class="w-full h-full object-cover" alt="Server clusters data" />
                </div>
              </div>
              <div class="order-1 lg:order-2 max-w-xl lg:pl-10">
                <div class="w-16 h-16 rounded-[1rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10 backdrop-blur-md">
                  <span class="text-2xl" style="color: var(--color-accent-500)">2</span>
                </div>
                <h1 class="text-5xl font-black text-white mb-6 leading-tight" style="letter-spacing:-0.04em;">Instantiate DBs<br />in <span class="i-underline">1-Click</span>.</h1>
                <p class="text-xl text-white/60 mb-8 font-medium leading-relaxed">Stop manually configuring databases. Provision Postgres, Redis, MongoDB, or MySQL instances in one click. Completely managed, inherently secure, with native scheduled backups.</p>
                <div class="flex flex-col gap-5 font-bold text-white/80">
                  <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 group">
                    <div class="w-3 h-3 rounded-full" style="background: var(--color-accent-500)"></div>
                    <span>Scheduled S3 backups natively supported</span>
                  </div>
                  <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5 group">
                    <div class="w-3 h-3 rounded-full" style="background: var(--color-accent-500)"></div>
                    <span>Automatic environment variable tunneling</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== FEATURES ===== -->
        <section id="features" class="py-32 px-6 relative z-10">
          <div class="max-w-7xl mx-auto">
            <h1 class="text-4xl md:text-5xl font-black text-white text-center mb-16" style="letter-spacing:-0.04em;">Everything you <span class="i-underline">need</span>. <span class="text-white/40">Nothing you don't.</span></h1>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="glass-card hover:-translate-y-2 transition-all p-8 rounded-[2rem] border border-white/10 group">
                <div class="w-12 h-12 rounded-[1rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6"><i class="fa-solid fa-cube text-xl text-primary-400"></i></div>
                <h3 class="text-xl font-bold text-white mb-3">Any Language</h3>
                <p class="text-white/60 text-sm font-medium leading-relaxed">Nixpacks integration means if it builds on your machine, it builds on Eploy. No Dockerfile required.</p>
              </div>
              <div class="glass-card hover:-translate-y-2 transition-all p-8 rounded-[2rem] border border-white/10 group">
                <div class="w-12 h-12 rounded-[1rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6"><i class="fa-solid fa-lock text-xl text-accent-400"></i></div>
                <h3 class="text-xl font-bold text-white mb-3">Auto SSL</h3>
                <p class="text-white/60 text-sm font-medium leading-relaxed">We automatically generate and renew Let's Encrypt certificates for all your connected custom domains.</p>
              </div>
              <div class="glass-card hover:-translate-y-2 transition-all p-8 rounded-[2rem] border border-white/10 group lg:col-span-2 relative overflow-hidden">
                <div class="absolute right-0 bottom-0 w-64 h-64 rounded-tl-full blur-3xl pointer-events-none" style="background: rgba(37,99,235,0.1);"></div>
                <div class="w-12 h-12 rounded-[1rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6"><i class="fa-solid fa-code-branch text-xl text-white"></i></div>
                <h3 class="text-xl font-bold text-white mb-3">PR Previews</h3>
                <p class="text-white/60 text-sm font-medium leading-relaxed max-w-sm">Every pull request gets its own isolated deployment environment. Review changes live before merging to production. Automatically destroyed when merged, keeping costs at zero.</p>
                <div class="mt-6 flex items-center gap-4">
                  <div class="h-2 w-32 bg-white/10 rounded-full overflow-hidden"><div class="h-full w-1/2" style="background: var(--color-primary-500);"></div></div>
                  <span class="text-xs font-mono text-white/40">Building...</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== TESTIMONIAL ===== -->
        <section class="py-24 px-6 border-y border-white/5 bg-transparent">
          <div class="max-w-4xl mx-auto text-center">
            <div class="text-[8rem] font-serif leading-none mt-4" style="color:#222;">"</div>
            <h2 class="text-3xl md:text-5xl font-black text-white -mt-16 mb-12 leading-tight" style="letter-spacing:-0.03em;">
              Since migrating our entire agency server fleet to Eploy, our deployment velocity increased by 400% while server overhead dropped to zero. It's the Heroku alternative we actually own.
            </h2>
            <div class="flex items-center justify-center gap-4">
              <div class="w-12 h-12 rounded-full glass-card border border-white/10"></div>
              <div class="text-left">
                <p class="font-bold text-lg text-white">David J.</p>
                <p class="text-sm text-white/50 font-medium">Lead DevOps, Systema</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== ROLES ===== -->
        <section class="py-32 px-6 relative z-10">
          <div class="max-w-7xl mx-auto">
            <h1 class="text-4xl md:text-5xl font-black text-white mb-16 text-center" style="letter-spacing:-0.04em;">Built for how you <span class="i-underline">work</span></h1>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              @for (role of roles; track role.title) {
                <div class="glass-card hover:-translate-y-2 transition-transform p-10 rounded-[2rem] border border-white/10 text-center group relative overflow-hidden">
                  <div class="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 transition-colors">
                    <i [class]="role.icon" class="text-2xl" [style.color]="role.color"></i>
                  </div>
                  <div class="text-white/40 font-bold uppercase tracking-widest text-xs mb-4">{{ role.tag }}</div>
                  <h3 class="text-2xl font-black text-white mb-4" [innerHTML]="role.title"></h3>
                  <p class="text-sm text-white/60 font-medium mb-8">{{ role.body }}</p>
                  <div class="h-1 w-12 mx-auto rounded-full bg-white/20 group-hover:w-24 transition-all"></div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ===== HOW IT WORKS ===== -->
        <section class="py-32 px-6 relative z-10 border-t border-white/5">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-4xl md:text-5xl font-black text-white text-center mb-16" style="letter-spacing:-0.04em;"><span class="i-underline">How</span> it works</h1>
            <div class="glass-card relative p-8 md:p-16 rounded-[3rem] border border-white/10">
              <div class="space-y-16">
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                  <div class="md:w-5/12 text-center md:text-right">
                    <h3 class="text-2xl font-bold text-white mb-2">1. Connect Provider</h3>
                    <p class="text-white/60 font-medium">Link your GitHub, GitLab, or Bitbucket account. We only ask for the permissions we absolutely need.</p>
                  </div>
                  <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 relative z-10" style="border-color: var(--color-primary-500);"><span class="text-xl font-bold text-white">1</span></div>
                  <div class="md:w-5/12"></div>
                </div>
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                  <div class="md:w-5/12 hidden md:block"></div>
                  <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 border-white/20 relative z-10"><span class="text-xl font-bold text-white">2</span></div>
                  <div class="md:w-5/12 text-center md:text-left">
                    <h3 class="text-2xl font-bold text-white mb-2">2. Define Destination</h3>
                    <p class="text-white/60 font-medium">Add any Linux server using an SSH key. A $4/mo Hetzner VPS works just fine.</p>
                  </div>
                </div>
                <div class="flex flex-col md:flex-row items-center justify-between gap-8 group">
                  <div class="md:w-5/12 text-center md:text-right">
                    <h3 class="text-2xl font-bold text-white mb-2">3. Deploy</h3>
                    <p class="text-white/60 font-medium">Hit deploy. We automatically build the container and route the traffic. It just works.</p>
                  </div>
                  <div class="w-16 h-16 rounded-full glass-card flex items-center justify-center border-2 relative z-10" style="border-color: var(--color-accent-500);"><span class="text-xl font-bold text-white">3</span></div>
                  <div class="md:w-5/12"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== PRICING / CTA ===== -->
        <section id="pricing" class="py-32 px-6 relative z-10 border-t border-white/5">
          <div class="max-w-4xl mx-auto rounded-[3rem] overflow-hidden relative">
            <div class="absolute inset-0 z-0" style="background: linear-gradient(to bottom right, rgba(37,99,235,0.2), black, rgba(34,211,238,0.2));"></div>
            <div class="glass-card relative z-10 p-16 md:p-24 border border-white/10 text-center" style="backdrop-filter: blur(48px);">
              <h1 class="text-5xl md:text-6xl font-black text-white mb-6" style="letter-spacing:-0.04em;">Ready to <span class="i-underline">host?</span></h1>
              <p class="text-xl text-white/70 mb-12 max-w-xl mx-auto font-medium">Join thousands of developers escaping the PaaS tax. Stop paying for traffic. Start paying for hardware.</p>
              <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a [href]="loginUrl" class="inner-button px-8 py-4 text-lg w-full sm:w-auto">Get started for free</a>
                <a href="https://github.com/coollabsio/coolify" target="_blank" class="outer-button px-8 py-4 text-lg w-full sm:w-auto">View on GitHub</a>
              </div>
              <p class="mt-8 text-sm text-white/40 font-mono">MIT Licensed. Open Source forever.</p>
            </div>
          </div>
        </section>

        <!-- ===== FOOTER ===== -->
        <footer class="py-12 px-6 border-t border-white/10 bg-transparent">
          <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--color-primary-500)">
                <i class="fa-solid fa-rocket text-xs text-white"></i>
              </div>
              <span class="text-base font-black text-white tracking-tight">EPLOY</span>
            </div>
            <p class="text-sm text-white/50 font-medium">© {{ year }} EPLOY · Powered seamlessly by Idem Frameworks</p>
            <div class="flex items-center gap-8">
              <a [href]="loginUrl" class="text-sm font-bold text-white/50 hover:text-white transition-colors">Sign In</a>
              <a href="https://github.com/coollabsio/coolify" target="_blank" class="text-sm font-bold text-white/50 hover:text-white transition-colors">GitHub Repository</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly user = toSignal(this.auth.user$, { initialValue: null });
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();
  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  protected readonly stacks = ['Node.js', 'Python', 'Laravel', 'PostgreSQL', 'GitHub', 'Docker', 'Redis', 'Next.js'];

  protected readonly showcase = [
    { title: 'Global API Mesh Network', author: 'Masaya Takizawa', img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop' },
    { title: 'Robotics CI Pipeline', author: 'Raul Marin Calleja', img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop' },
    { title: 'Cybersecurity Log System', author: 'Seungmee Lee', img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=800&auto=format&fit=crop' },
    { title: 'Crypto Trading Engine', author: 'Ayaneshu Bhardwaj', img: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=800&auto=format&fit=crop' },
  ];

  protected readonly roles = [
    { tag: 'For Indie Hackers', title: 'Ship fast.<br>Scale cheaply.', body: 'Maintain total sovereignty over your side-projects without being milked by PaaS pricing. Pay only for your Hetzner VPS.', icon: 'fa-solid fa-bolt', color: 'rgba(255,255,255,0.8)' },
    { tag: 'For Agencies', title: 'Manage fleets<br>effortlessly.', body: 'Deploy customer projects on completely isolated servers using a single pane of glass. Handle team access centrally.', icon: 'fa-solid fa-building', color: 'var(--color-primary-500)' },
    { tag: 'For Startups', title: 'Grow without<br>lock-in.', body: 'Move your infrastructure away from proprietary clouds. Control your own data and optimize your burn rate dramatically.', icon: 'fa-solid fa-bolt-lightning', color: 'var(--color-accent-500)' },
  ];

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }

  protected avatarFor(u: { displayName?: string | null; email: string }): string {
    const name = encodeURIComponent(u.displayName || u.email);
    return `https://ui-avatars.com/api/?name=${name}&color=7F9CF5&background=EBF4FF`;
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
