import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { UiModeService } from '../../../../../shared/services/ui-mode.service';
import { DiagramGeneration } from './diagram-generation/diagram-generation';

/**
 * Dessin du plan de l'application. Une fois fini, on revient au plan — ou au
 * parcours en mode Assisté, où l'étape se coche et la suivante s'ouvre.
 */
@Component({
  selector: 'app-diagram-generation-page',
  imports: [DiagramGeneration, RouterLink, TranslateModule],
  template: `
    <div class="space-y-6 p-4 md:p-2">
      <header>
        <a routerLink="/project/development" class="dg-back">
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
          {{ 'dashboard.siteApp.title' | translate }}
        </a>
        <h1 class="text-2xl md:text-3xl font-bold text-text-primary">{{ 'dashboard.siteApp.plan.title' | translate }}</h1>
        <p class="text-text-secondary mt-1 text-sm max-w-2xl">{{ 'dashboard.siteApp.plan.generatingLead' | translate }}</p>
      </header>
      @if (projectId(); as id) {
        <app-diagram-generation [projectId]="id" (diagramGenerated)="onDiagramGenerated()" />
      }
    </div>
  `,
  styles: `
    .dg-back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
    .dg-back:hover,
    .dg-back:focus-visible {
      color: var(--color-primary-500);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramGenerationPage implements OnInit {
  private readonly router = inject(Router);
  private readonly uiMode = inject(UiModeService);
  private readonly cookies = inject(CookieService);

  protected readonly projectId = signal<string | null>(null);

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) void this.router.navigate(['/projects']);
  }

  protected onDiagramGenerated(): void {
    this.uiMode.completeStep('/project/development/diagrams');
  }
}
