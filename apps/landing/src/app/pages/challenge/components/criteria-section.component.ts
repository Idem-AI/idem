import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-criteria-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="py-32 px-6 bg-black border-t border-white/10">
      <div class="container mx-auto max-w-7xl">
        <div class="grid lg:grid-cols-2 gap-20 items-start">
          <!-- Checklist -->
          <div>
            <h2 class="text-4xl md:text-6xl font-bold mb-16 text-white">CHECKLIST</h2>

            <div class="space-y-6">
              <div class="flex items-start gap-4 p-6 glass-panel rounded-lg border-l-4 border-primary hover:border-primary/80 transition-colors group">
                <div class="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center mt-1 group-hover:bg-primary transition-colors">
                  <div class="w-2 h-2 bg-primary rounded-full group-hover:bg-white"></div>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Compte Idem créé</h3>
                  <p class="text-gray-400">Inscrivez-vous sur idem.africa et explorez la plateforme</p>
                </div>
              </div>

              <div class="flex items-start gap-4 p-6 glass-panel rounded-lg border-l-4 border-primary hover:border-primary/80 transition-colors group">
                <div class="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center mt-1 group-hover:bg-primary transition-colors">
                  <div class="w-2 h-2 bg-primary rounded-full group-hover:bg-white"></div>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Projet généré</h3>
                  <p class="text-gray-400">Utilisez l'IA pour créer un business plan + site web complet</p>
                </div>
              </div>

              <div class="flex items-start gap-4 p-6 glass-panel rounded-lg border-l-4 border-primary hover:border-primary/80 transition-colors group">
                <div class="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center mt-1 group-hover:bg-primary transition-colors">
                  <div class="w-2 h-2 bg-primary rounded-full group-hover:bg-white"></div>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Vidéo enregistrée</h3>
                  <p class="text-gray-400">Maximum 2 minutes. Montrez le site, expliquez la vision</p>
                </div>
              </div>

              <div class="flex items-start gap-4 p-6 glass-panel rounded-lg border-l-4 border-primary hover:border-primary/80 transition-colors group">
                <div class="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center mt-1 group-hover:bg-primary transition-colors">
                  <div class="w-2 h-2 bg-primary rounded-full group-hover:bg-white"></div>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white mb-2">Post publié</h3>
                  <p class="text-gray-400">LinkedIn/Twitter avec #IdemChallenge + lien du site</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Criteria -->
          <div>
            <h2 class="text-4xl md:text-6xl font-bold mb-16 text-white">CRITÈRES</h2>

            <div class="space-y-8">
              <div class="border-l-2 border-primary pl-8 relative">
                <div class="absolute -left-[9px] top-0 w-4 h-4 bg-primary rounded-full"></div>
                <h3 class="text-2xl font-bold text-white mb-4">Originalité</h3>
                <p class="text-gray-400 text-lg leading-relaxed">
                  L'idée doit être unique, innovante et montrer une vraie compréhension du marché cible.
                </p>
              </div>

              <div class="border-l-2 border-primary pl-8 relative">
                <div class="absolute -left-[9px] top-0 w-4 h-4 bg-primary rounded-full"></div>
                <h3 class="text-2xl font-bold text-white mb-4">Exécution</h3>
                <p class="text-gray-400 text-lg leading-relaxed">
                  Qualité du site généré, cohérence du business plan, présentation professionnelle.
                </p>
              </div>

              <div class="border-l-2 border-primary pl-8 relative">
                <div class="absolute -left-[9px] top-0 w-4 h-4 bg-primary rounded-full"></div>
                <h3 class="text-2xl font-bold text-white mb-4">Impact</h3>
                <p class="text-gray-400 text-lg leading-relaxed">
                  Potentiel de disruption, engagement de la communauté, viralité du post.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .glass-panel {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(10px);
    }
  `]
})
export class CriteriaSectionComponent {}
