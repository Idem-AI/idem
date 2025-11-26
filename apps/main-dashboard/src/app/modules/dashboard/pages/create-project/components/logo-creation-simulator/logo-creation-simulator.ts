import { Component, computed, input, output, signal, OnInit, OnDestroy, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface CreationStep {
  id: string;
  title: string;
  description: string;
  duration: number; // en millisecondes
  icon: string;
  progress: number;
  status: 'pending' | 'active' | 'completed';
}

import { Loader } from '../../../../../../shared/components/loader/loader';

@Component({
  selector: 'app-logo-creation-simulator',
  standalone: true,
  imports: [CommonModule, TranslateModule, Loader],
  template: `
    <!-- Main Container avec design responsive original -->
    <div class="w-full min-h-screen bg-linear-to-br from-bg-dark via-bg-light to-bg-dark font-jura relative overflow-hidden">

      <!-- Background Elements -->
      <div class="absolute inset-0 opacity-30">
        <div class="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute bottom-40 right-20 w-48 h-48 bg-accent/15 rounded-full blur-2xl animate-pulse" style="animation-delay: 2s"></div>
        <div class="absolute top-1/2 left-1/3 w-24 h-24 bg-secondary/25 rounded-full blur-xl animate-pulse" style="animation-delay: 4s"></div>
      </div>

      <!-- Mobile-First Layout -->
      <div class="relative z-10 px-4 py-8 sm:px-6 lg:px-8">

        <!-- Header Section -->
        <header class="text-center mb-6 lg:mb-8 xl:mb-12">
          <div class="space-y-3 lg:space-y-4 xl:space-y-6">
            <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white text-glow-primary tracking-wider leading-tight">
              {{ 'logoCreation.title' | translate }}
            </h1>
            <p class="text-accent text-sm sm:text-base md:text-lg lg:text-xl font-light tracking-wide max-w-2xl mx-auto">
              {{ 'logoCreation.subtitle' | translate }}
            </p>
          </div>
        </header>

        <!-- Main Content - Desktop Optimisé -->
        <div class="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto space-y-8 lg:space-y-10 xl:space-y-12">

          <!-- Progress Ring Central -->
          <div class="flex justify-center">
            <div class="relative">
              <!-- Glow Effect -->
              <div class="absolute inset-0 bg-primary/10 blur-2xl rounded-full transform scale-125 animate-pulse"></div>

              <!-- Main Ring -->
              <div class="relative w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 lg:w-52 lg:h-52 xl:w-56 xl:h-56 glass rounded-full flex items-center justify-center shadow-glass glow-primary">
                <svg class="absolute inset-0 w-full h-full transform -rotate-90 p-3" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"></circle>
                  <circle
                    cx="60" cy="60" r="54"
                    fill="none"
                    stroke="var(--color-primary)"
                    stroke-width="3"
                    stroke-linecap="round"
                    [style.stroke-dasharray]="339.292"
                    [style.stroke-dashoffset]="339.292 - (339.292 * overallProgress() / 100)"
                    class="transition-all duration-700 ease-out drop-shadow-[0_0_15px_var(--color-primary)]"
                  ></circle>
                </svg>

                <!-- Center Content -->
                <div class="flex flex-col items-center justify-center space-y-1 z-10">
                  <span class="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white text-glow-primary">{{ overallProgress().toFixed(0) }}%</span>
                  <div class="flex flex-col items-center">
                    <span class="text-xs text-gray-400 uppercase tracking-widest text-center font-medium">{{ 'logoCreation.estimatedTime' | translate }}</span>
                    <span class="text-accent font-mono text-xs sm:text-sm md:text-base lg:text-lg font-semibold">{{ remainingTime() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile/Tablet Timeline Compact -->
          <div class="block lg:hidden">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              @for (step of steps(); track step.id; let i = $index) {
                <div class="glass-card p-3 transition-all duration-500 text-center"
                     [class.border-primary]="step.status === 'active'"
                     [class.glow-primary]="step.status === 'active'"
                     [class.border-accent]="step.status === 'completed'">

                  <!-- Step Icon -->
                  <div class="w-8 h-8 mx-auto mb-2 rounded-full glass border-glass flex items-center justify-center"
                       [class.glow-primary]="step.status === 'active'"
                       [class.border-primary]="step.status === 'active'"
                       [class.glow-secondary]="step.status === 'completed'"
                       [class.border-accent]="step.status === 'completed'">
                    @if (step.status === 'completed') {
                      <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    } @else if (step.status === 'active') {
                      <app-loader class="transform scale-50"></app-loader>
                    } @else {
                      <span class="text-xs font-bold text-gray-600">{{ i + 1 }}</span>
                    }
                  </div>

                  <!-- Step Content -->
                  <div>
                    <h3 class="font-bold text-xs uppercase tracking-wider"
                        [class.text-gray-500]="step.status === 'pending'"
                        [class.text-primary]="step.status === 'active'"
                        [class.text-accent]="step.status === 'completed'">
                      {{ step.title }}
                    </h3>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Desktop Timeline Adaptative -->
          <div class="hidden lg:block relative">
            <!-- Timeline Line -->
            <div class="absolute top-1/2 left-0 w-full h-1 bg-white/10 rounded-full transform -translate-y-1/2"></div>
            <div
              class="absolute top-1/2 left-0 h-1 bg-linear-to-r from-primary via-accent to-primary transition-all duration-1000 ease-out shadow-[0_0_10px_var(--color-primary)] rounded-full transform -translate-y-1/2"
              [style.width.%]="overallProgress()"
            ></div>

            <!-- Steps en ligne adaptés -->
            <div class="flex justify-between items-center relative z-10">
              @for (step of steps(); track step.id; let i = $index) {
                <div class="flex flex-col items-center space-y-2 lg:space-y-3 group">
                  <!-- Step Circle -->
                  <div
                    class="w-12 h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-full glass border-glass flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                    [class.glow-primary]="step.status === 'active'"
                    [class.border-primary]="step.status === 'active'"
                    [class.glow-secondary]="step.status === 'completed'"
                    [class.border-accent]="step.status === 'completed'"
                  >
                    @if (step.status === 'completed') {
                      <svg class="w-5 h-5 lg:w-6 lg:h-6 text-accent drop-shadow-[0_0_5px_var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    } @else if (step.status === 'active') {
                      <div class="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30"></div>
                      <app-loader class="transform scale-50 lg:scale-75"></app-loader>
                    } @else {
                      <span class="text-sm lg:text-lg font-bold text-gray-600">{{ i + 1 }}</span>
                    }
                  </div>

                  <!-- Step Content -->
                  <div class="text-center max-w-20 lg:max-w-24">
                    <h3
                      class="font-bold text-xs lg:text-xs xl:text-sm uppercase tracking-wider transition-colors duration-300"
                      [class.text-gray-500]="step.status === 'pending'"
                      [class.text-primary]="step.status === 'active'"
                      [class.text-accent]="step.status === 'completed'"
                      [class.text-glow-primary]="step.status === 'active'"
                    >
                      {{ step.title }}
                    </h3>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Design Concepts Compacts -->
          <div class="space-y-3">
            <!-- Concepts minimalistes -->
            <div class="grid grid-cols-3 sm:flex sm:justify-center gap-2 sm:gap-3 lg:gap-4 sm:space-x-0">
              @for (concept of designConcepts(); track concept.id) {
                <div
                  class="glass-card p-2 sm:p-3 sm:w-28 lg:w-32 xl:w-36 relative overflow-hidden group transition-all duration-300"
                  [class.border-primary]="concept.isActive"
                  [class.glow-primary]="concept.isActive"
                >
                  <!-- Concept Visualization Compact -->
                  <div class="relative w-full h-10 sm:h-12 lg:h-14 xl:h-16 glass-dark rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                    @if (concept.isActive) {
                      <div class="absolute inset-0 bg-primary/10 animate-pulse"></div>
                    }

                    <!-- Abstract Shape Simple -->
                    <div class="relative w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8 transition-all duration-500">
                      <div
                        class="absolute inset-0 border border-glass rounded transform rotate-45 transition-all duration-500"
                        [class.border-primary]="concept.isActive"
                        [class.rotate-180]="concept.isActive"
                      ></div>
                    </div>
                  </div>

                  <!-- Concept Info Minimal -->
                  <div class="text-center">
                    <h4
                      class="font-medium text-xs lg:text-xs uppercase tracking-wide transition-colors duration-300"
                      [class.text-gray-400]="!concept.isActive"
                      [class.text-white]="concept.isActive"
                    >
                      {{ concept.name }}
                    </h4>
                  </div>

                  <!-- Active Indicator -->
                  @if (concept.isActive) {
                    <div class="absolute top-1 right-1 sm:top-2 sm:right-2">
                      <div class="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ... */
  `]
})
export class LogoCreationSimulatorComponent implements OnInit, OnDestroy, OnChanges {
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly isActive = input<boolean>(false);
  readonly totalDuration = input<number>(60000); // 1 minute par défaut

  // Outputs
  readonly completed = output<void>();

  // Internal state
  protected readonly steps = signal<CreationStep[]>([]);
  protected readonly currentStepIndex = signal(0);
  protected readonly overallProgress = signal(0);
  protected readonly startTime = signal<number | null>(null);
  protected readonly remainingTime = signal('1 min');

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private stepTimeouts: ReturnType<typeof setTimeout>[] = [];

  protected readonly designConcepts = signal([
    {
      id: 'concept1',
      name: this.translate.instant('logoCreation.concepts.concept1.name'),
      description: this.translate.instant('logoCreation.concepts.concept1.description'),
      isActive: false
    },
    {
      id: 'concept2',
      name: this.translate.instant('logoCreation.concepts.concept2.name'),
      description: this.translate.instant('logoCreation.concepts.concept2.description'),
      isActive: false
    },
    {
      id: 'concept3',
      name: this.translate.instant('logoCreation.concepts.concept3.name'),
      description: this.translate.instant('logoCreation.concepts.concept3.description'),
      isActive: false
    }
  ]);

  ngOnInit(): void {
    if (this.isActive()) {
      this.initializeSteps();
      this.startSimulation();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isActive'] && changes['isActive'].currentValue) {
      this.startSimulation();
    }
  }

  completeImmediately(): void {
    this.cleanup();
    this.overallProgress.set(100);
    this.remainingTime.set('0s');

    // Mark all steps as completed
    const updatedSteps = this.steps().map(step => ({
      ...step,
      status: 'completed' as const,
      progress: 100
    }));
    this.steps.set(updatedSteps);

    // Emit completion after a short delay to show the 100% state
    setTimeout(() => {
      this.completed.emit();
    }, 500);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initializeSteps(): void {
    const totalDuration = this.totalDuration();
    const steps: CreationStep[] = [
      {
        id: 'analyze',
        title: this.translate.instant('logoCreation.steps.analyze.title'),
        description: this.translate.instant('logoCreation.steps.analyze.description'),
        duration: totalDuration * 0.15, // 15%
        icon: 'analyze',
        progress: 0,
        status: 'pending'
      },
      {
        id: 'research',
        title: this.translate.instant('logoCreation.steps.research.title'),
        description: this.translate.instant('logoCreation.steps.research.description'),
        duration: totalDuration * 0.20, // 20%
        icon: 'research',
        progress: 0,
        status: 'pending'
      },
      {
        id: 'sketch',
        title: this.translate.instant('logoCreation.steps.sketch.title'),
        description: this.translate.instant('logoCreation.steps.sketch.description'),
        duration: totalDuration * 0.25, // 25%
        icon: 'sketch',
        progress: 0,
        status: 'pending'
      },
      {
        id: 'design',
        title: this.translate.instant('logoCreation.steps.design.title'),
        description: this.translate.instant('logoCreation.steps.design.description'),
        duration: totalDuration * 0.25, // 25%
        icon: 'design',
        progress: 0,
        status: 'pending'
      },
      {
        id: 'refine',
        title: this.translate.instant('logoCreation.steps.refine.title'),
        description: this.translate.instant('logoCreation.steps.refine.description'),
        duration: totalDuration * 0.10, // 10%
        icon: 'refine',
        progress: 0,
        status: 'pending'
      },
      {
        id: 'finalize',
        title: this.translate.instant('logoCreation.steps.finalize.title'),
        description: this.translate.instant('logoCreation.steps.finalize.description'),
        duration: totalDuration * 0.05, // 5%
        icon: 'finalize',
        progress: 0,
        status: 'pending'
      }
    ];

    this.steps.set(steps);
  }

  private startSimulation(): void {
    this.startTime.set(Date.now());
    this.currentStepIndex.set(0);
    this.processStep(0);
    this.startOverallProgressTracking();
    this.startConceptAnimation();
  }

  private processStep(stepIndex: number): void {
    if (stepIndex >= this.steps().length) {
      // Ne pas compléter automatiquement ici si on est à la fin
      // On attend l'appel explicite à completeImmediately()
      return;
    }

    const steps = this.steps();
    const currentStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;

    // Marquer l'étape comme active
    steps[stepIndex] = { ...currentStep, status: 'active', progress: 0 };
    this.steps.set([...steps]);

    // Animer le progrès de l'étape
    this.animateStepProgress(stepIndex, currentStep.duration);

    // Programmer la prochaine étape seulement si ce n'est pas la dernière
    if (!isLastStep) {
      const timeout = setTimeout(() => {
        const updatedSteps = this.steps();
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], status: 'completed', progress: 100 };
        this.steps.set([...updatedSteps]);

        this.currentStepIndex.set(stepIndex + 1);
        this.processStep(stepIndex + 1);
      }, currentStep.duration);

      this.stepTimeouts.push(timeout);
    }
  }

  private animateStepProgress(stepIndex: number, duration: number): void {
    const startTime = Date.now();
    const isLastStep = stepIndex === this.steps().length - 1;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let progress = Math.min((elapsed / duration) * 100, 100);

      // Si c'est la dernière étape, on la fait osciller près de la fin
      if (isLastStep && progress >= 90) {
        // Oscillation lente entre 90 et 98%
        const oscillation = Math.sin(Date.now() / 1000) * 4 + 94;
        progress = oscillation;
      }

      const steps = this.steps();
      if (steps[stepIndex] && steps[stepIndex].status === 'active') {
        steps[stepIndex] = { ...steps[stepIndex], progress };
        this.steps.set([...steps]);
      }

      if (progress >= 100 && !isLastStep) {
        clearInterval(interval);
      }
    }, 100);

    this.stepTimeouts.push(interval);
  }

  private startOverallProgressTracking(): void {
    const startTime = this.startTime()!;
    const totalDuration = this.totalDuration();

    this.intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Plafonner la progression globale à 95% tant que ce n'est pas fini manuellement
      const maxProgress = 95;
      const progress = Math.min((elapsed / totalDuration) * 100, maxProgress);

      this.overallProgress.set(progress);

      // Mettre à jour le temps restant
      const remaining = Math.max(totalDuration - elapsed, 0);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      if (minutes > 0) {
        this.remainingTime.set(`${minutes} min ${seconds}s`);
      } else {
        this.remainingTime.set(`${seconds}s`);
      }

      // Ne jamais arrêter l'intervalle automatiquement ici, c'est completeImmediately qui le fera
    }, 1000);
  }

  private startConceptAnimation(): void {
    const concepts = this.designConcepts();
    let currentConceptIndex = 0;

    const animateConcepts = () => {
      // Désactiver tous les concepts
      const updatedConcepts = concepts.map(c => ({ ...c, isActive: false }));

      // Activer le concept actuel
      updatedConcepts[currentConceptIndex] = {
        ...updatedConcepts[currentConceptIndex],
        isActive: true
      };

      this.designConcepts.set(updatedConcepts);

      currentConceptIndex = (currentConceptIndex + 1) % concepts.length;
    };

    // Animer les concepts toutes les 8 secondes
    const conceptInterval = setInterval(animateConcepts, 8000);
    this.stepTimeouts.push(conceptInterval);

    // Commencer immédiatement
    animateConcepts();
  }

  private completeSimulation(): void {
    this.overallProgress.set(100);
    this.remainingTime.set('0s');
    this.cleanup();
    this.completed.emit();
  }

  private cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.stepTimeouts.forEach(timeout => {
      if (typeof timeout === 'number') {
        clearTimeout(timeout);
        clearInterval(timeout);
      } else {
        clearTimeout(timeout);
        clearInterval(timeout);
      }
    });
    this.stepTimeouts = [];
  }
}
