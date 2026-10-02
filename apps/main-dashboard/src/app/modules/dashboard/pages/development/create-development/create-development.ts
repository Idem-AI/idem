import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { GenerationType, isFullApplication } from '../../../models/development.model';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { DevelopmentService } from '../../../services/ai-agents/development.service';
import { ProjectService } from '../../../services/project.service';
import { SiteAppIllustrationComponent } from '../site-app-illustration';

type Choice = Extract<GenerationType, 'landing' | 'app'>;

/**
 * « Que voulez-vous construire ? » — deux réponses, rien d'autre.
 *
 * Un site vitrine part directement dans iCode. Une application complète
 * (interface + serveur + base de données) suit un parcours en trois étapes sur
 * la page « Site et app » : plan, construction, mise en ligne. Les
 * technologies sont choisies par IDEM (voir `DevelopmentService`) : demander
 * React ou Angular à un entrepreneur ne l'aide pas à avancer.
 */
@Component({
  selector: 'app-create-development',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, SiteAppIllustrationComponent],
  templateUrl: './create-development.html',
  styleUrl: './create-development.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateDevelopmentComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cookies = inject(CookieService);
  private readonly projects = inject(ProjectService);
  private readonly development = inject(DevelopmentService);

  protected readonly projectId = signal<string | null>(null);
  /** Le choix déjà enregistré, pour le signaler et permettre de revenir. */
  protected readonly current = signal<Choice | null>(null);
  /** Le choix en cours d'enregistrement : son bouton montre le chargement. */
  protected readonly saving = signal<Choice | null>(null);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) return;

    this.projects
      .getProjectById(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          const configs = project?.analysisResultModel?.development?.configs;
          if (configs) this.current.set(isFullApplication(configs) ? 'app' : 'landing');
        },
        // Sans le choix actuel, la page reste utilisable : on choisit à nouveau.
        error: () => undefined,
      });
  }

  protected choose(choice: Choice): void {
    const projectId = this.projectId();
    if (!projectId || this.saving()) return;

    this.saving.set(choice);
    this.failed.set(false);

    this.development
      .saveDevelopmentConfigs(this.development.generateQuickConfig(choice), projectId, choice)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/project/development']),
        error: () => {
          this.saving.set(null);
          this.failed.set(true);
        },
      });
  }
}
