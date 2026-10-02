import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../../../../environments/environment';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { ErrorStateComponent } from '../../../../../shared/components/error-state/error-state';
import { IncompleteProjectBannerComponent } from '../../../components/incomplete-project-banner/incomplete-project-banner';
import { DevelopmentConfigsModel, isFullApplication } from '../../../models/development.model';
import { BrandingValidationService } from '../../../services/branding-validation.service';
import { AppChatSummary, AppDeploymentModel, ProjectService } from '../../../services/project.service';
import { SiteAppIllustrationComponent } from '../site-app-illustration';

type StepId = 'plan' | 'build' | 'golive';
type StepState = 'done' | 'next' | 'locked' | 'todo';

interface AppStep {
  id: StepId;
  number: number;
  state: StepState;
}

/**
 * « Site et app » — une seule page, qui dit où l'on en est et quoi faire ensuite.
 *
 * Site vitrine : un bouton, vers iCode.
 * Application complète : trois étapes dans l'ordre, chacune ouverte par la
 * précédente —
 *   1. le plan (diagrammes), lu par iCode pour bâtir les bonnes données ;
 *   2. la construction dans iCode : interface, serveur et base de données ;
 *   3. la mise en ligne par le guide « application 3 tiers » d'iDeploy, qui
 *      crée la base, puis le serveur, puis l'interface, et les relie.
 *
 * Tout l'état se lit sur le projet (configuration, plan), la conversation
 * iCode et la dernière publication : trois requêtes, aucune saisie.
 */
@Component({
  selector: 'app-show-development',
  imports: [
    DatePipe,
    RouterLink,
    TranslateModule,
    IdemLoaderComponent,
    ErrorStateComponent,
    IncompleteProjectBannerComponent,
    SiteAppIllustrationComponent,
  ],
  templateUrl: './show-development.html',
  styleUrls: ['./show-development.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowDevelopment implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cookies = inject(CookieService);
  private readonly projectService = inject(ProjectService);
  private readonly brandingValidation = inject(BrandingValidationService);

  private readonly webgenUrl = environment.services.webgen.url;
  private readonly ideployUrl = environment.services.ideploy.url;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isBrandingComplete = signal(false);

  /** Dernière publication rapide faite depuis iCode, s'il y en a une. */
  protected readonly deployment = signal<AppDeploymentModel | null>(null);
  /** Conversation iCode existante : on la reprend plutôt que d'en ouvrir une autre. */
  protected readonly appChat = signal<AppChatSummary | null>(null);
  protected readonly copied = signal(false);

  protected readonly configs = computed<DevelopmentConfigsModel | null>(
    () => this.project()?.analysisResultModel?.development?.configs ?? null,
  );
  protected readonly isApp = computed(() => isFullApplication(this.configs()));
  protected readonly hasPlan = computed(
    () => (this.project()?.analysisResultModel?.design?.sections?.length ?? 0) > 0,
  );
  protected readonly hasCode = computed(() => this.appChat() !== null);
  protected readonly isLive = computed(() => !!this.deployment()?.url);

  /** Ce qu'IDEM construit, lu sur la configuration plutôt que supposé. */
  protected readonly stack = computed(() => {
    const c = this.configs();
    return {
      frontend: c?.frontend?.framework || 'React',
      backend: [c?.backend?.language, c?.backend?.framework].filter(Boolean).join(' · ') || 'Node.js · Express',
      database: c?.database?.provider || c?.database?.type || 'PostgreSQL',
    };
  });

  /**
   * Les trois étapes et leur état. Une étape s'ouvre quand la précédente est
   * faite ; la première ouverte et pas encore faite est « la prochaine », et
   * c'est la seule dont le bouton est mis en avant.
   */
  protected readonly steps = computed<AppStep[]>(() => {
    // Une conversation iCode ouverte avant le plan (un ancien site vitrine,
    // par exemple) ne compte pas : l'application n'a pas été bâtie dessus.
    const done: Record<StepId, boolean> = {
      plan: this.hasPlan(),
      build: this.hasPlan() && this.hasCode(),
      golive: this.hasPlan() && this.hasCode() && this.isLive(),
    };
    const open: Record<StepId, boolean> = {
      plan: true,
      build: done.plan,
      golive: done.plan && done.build,
    };
    const ids: StepId[] = ['plan', 'build', 'golive'];
    const next = ids.find((id) => open[id] && !done[id]) ?? null;

    return ids.map((id, index) => ({
      id,
      number: index + 1,
      state: done[id] ? 'done' : id === next ? 'next' : open[id] ? 'todo' : 'locked',
    }));
  });

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) {
      void this.router.navigate(['/projects']);
      return;
    }
    this.load(projectId);
  }

  protected retry(): void {
    const projectId = this.projectId();
    if (projectId) this.load(projectId);
  }

  private load(projectId: string): void {
    this.loading.set(true);
    this.failed.set(false);

    this.projectService
      .getProjectById(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.project.set(project);
          this.isBrandingComplete.set(this.brandingValidation.checkBrandingCompletion(project).isComplete);

          // Rien n'a encore été choisi : on commence par là.
          if (this.isBrandingComplete() && !this.configs()) {
            void this.router.navigate(['/project/development/create']);
            return;
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });

    // Ces deux lectures répondent `null` en cas d'échec : la page reste juste,
    // seule l'étape concernée apparaît comme pas encore faite.
    this.projectService
      .getAppChatSummary(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((chat) => this.appChat.set(chat));
    this.projectService
      .getAppDeployment(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deployment) => this.deployment.set(deployment));
  }

  /** Ouvre iCode sur ce projet ; il lit lui-même la configuration et le plan. */
  protected openICode(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    // L'application complète se construit sur le plan : sans lui, iCode
    // n'aurait que la description du projet pour deviner les données.
    if (this.isApp() && !this.hasPlan()) return;
    window.location.href = `${this.webgenUrl}?projectId=${encodeURIComponent(projectId)}`;
  }

  /**
   * Le guide « application 3 tiers » d'iDeploy : base de données, puis
   * serveur (son `DATABASE_URL` est rempli tout seul), puis interface (son
   * `VITE_API_URL` aussi).
   */
  protected openGoLiveGuide(): void {
    if (!this.hasCode()) return;
    window.open(`${this.ideployUrl}/new-project/guide/3-tier`, '_blank', 'noopener');
  }

  protected openLiveApp(): void {
    const url = this.deployment()?.url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  protected async copyLiveUrl(): Promise<void> {
    const url = this.deployment()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : le lien reste affiché.
    }
  }
}
