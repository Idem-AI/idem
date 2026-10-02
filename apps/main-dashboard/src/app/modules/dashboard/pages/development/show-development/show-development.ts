import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../../../../environments/environment';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { ErrorStateComponent } from '../../../../../shared/components/error-state/error-state';
import { IncompleteProjectBannerComponent } from '../../../components/incomplete-project-banner/incomplete-project-banner';
import {
  AppPlatform,
  DevelopmentConfigsModel,
  GenerationType,
  LandingPageConfig,
  isFullApplication,
} from '../../../models/development.model';
import { BrandingValidationService } from '../../../services/branding-validation.service';
import { DevelopmentService } from '../../../services/ai-agents/development.service';
import {
  AppChatSummary,
  AppDeploymentModel,
  IcodeProduct,
  ProjectService,
} from '../../../services/project.service';
import { SiteAppIllustrationComponent } from '../site-app-illustration';

/**
 * « Site & App » — deux cartes, le site vitrine et l'application, et une
 * phrase avant elles : on peut faire les deux.
 *
 * La page ne change pas de forme une fois un produit commencé : chaque carte
 * dit seulement où elle en est (« En cours », « En ligne ») et son bouton
 * ouvre directement iCode sur le bon produit (`?product=site|app`), où chacun
 * garde sa conversation, son code et son adresse publiée.
 *
 * La mise en ligne de l'application passe par le guide « application 3 tiers »
 * d'iDeploy. Le plan (diagrammes) n'est pas proposé ici : iCode s'en sert
 * s'il existe, sans jamais le demander.
 */
@Component({
  selector: 'app-show-development',
  imports: [
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
  private readonly development = inject(DevelopmentService);
  private readonly brandingValidation = inject(BrandingValidationService);

  private readonly webgenUrl = environment.services.webgen.url;
  private readonly ideployUrl = environment.services.ideploy.url;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isBrandingComplete = signal(false);
  /** Le produit dont le bouton vient d'être cliqué : il montre le chargement. */
  /** Le bouton qui vient d'être cliqué (site, application web ou mobile) : il montre le chargement. */
  protected readonly opening = signal<'site' | AppPlatform | null>(null);
  protected readonly copied = signal<IcodeProduct | null>(null);

  /** Conversation iCode et dernière publication, pour chacun des deux produits. */
  protected readonly siteChat = signal<AppChatSummary | null>(null);
  protected readonly appChat = signal<AppChatSummary | null>(null);
  protected readonly siteLive = signal<AppDeploymentModel | null>(null);
  protected readonly appLive = signal<AppDeploymentModel | null>(null);

  private readonly configs = computed<DevelopmentConfigsModel | null>(
    () => this.project()?.analysisResultModel?.development?.configs ?? null,
  );
  protected readonly siteStarted = computed(() => this.siteChat() !== null);
  protected readonly appStarted = computed(() => this.appChat() !== null);

  /**
   * Ce que l'utilisateur a voulu créer : ce qui est commencé dans iCode, ou ce
   * que dit la configuration (« les deux » commence par le site, l'application
   * reste due).
   */
  private readonly wantsSite = computed(() => {
    const lp = this.configs()?.landingPageConfig;
    return this.siteStarted() || lp === LandingPageConfig.ONLY_LANDING || lp === LandingPageConfig.SEPARATE;
  });
  private readonly wantsApp = computed(() => this.appStarted() || isFullApplication(this.configs()));
  /** Les deux façons de faire l'application ; le web est conseillé. */
  protected readonly platforms: ReadonlyArray<{ id: AppPlatform; icon: string; recommended: boolean }> = [
    { id: 'web', icon: 'pi-desktop', recommended: true },
    { id: 'mobile', icon: 'pi-mobile', recommended: false },
  ];

  /** L'adresse sans `https://` ni barre finale : ce qu'on lit et ce qu'on dicte. */
  protected displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /** Web (par défaut) ou mobile : ce que l'application en cours a choisi. */
  protected readonly appPlatform = computed<AppPlatform>(() => this.configs()?.appPlatform ?? 'web');

  /** Où en est chaque produit, dit de la même façon pour les deux. */
  protected readonly siteStatus = computed(() =>
    this.siteLive()?.url ? 'live' : this.siteStarted() ? 'started' : 'notStarted',
  );
  protected readonly appStatus = computed(() =>
    this.appLive()?.url ? 'live' : this.appStarted() ? 'started' : 'notStarted',
  );

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
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });

    // Ces lectures répondent `null` en cas d'échec : la page reste juste, le
    // produit concerné apparaît seulement comme pas encore commencé.
    const products: Array<[IcodeProduct, typeof this.siteChat, typeof this.siteLive]> = [
      ['site', this.siteChat, this.siteLive],
      ['app', this.appChat, this.appLive],
    ];
    for (const [product, chat, live] of products) {
      this.projectService
        .getAppChatSummary(projectId, product)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((summary) => chat.set(summary));
      this.projectService
        .getAppDeployment(projectId, product)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((deployment) => live.set(deployment));
    }
  }

  /**
   * Ouvre iCode sur le site vitrine ou sur l'application, en un clic.
   *
   * La configuration du projet est mise à jour d'abord (site, application ou
   * les deux) : le parcours Assisté et les réglages d'iCode la lisent. Son
   * échec n'empêche pas d'ouvrir iCode, qui choisit son travail d'après
   * l'adresse.
   */
  protected async openICode(product: IcodeProduct, platform: AppPlatform = this.appPlatform()): Promise<void> {
    const projectId = this.projectId();
    if (!projectId || this.opening()) return;
    this.opening.set(product === 'site' ? 'site' : platform);

    const wanted = this.configFor(product, platform);
    if (wanted) {
      await firstValueFrom(
        this.development
          .saveDevelopmentConfigs(this.development.generateQuickConfig(wanted, platform), projectId, wanted)
          .pipe(catchError(() => of(null))),
      );
    }

    const target = product === 'app' ? `&product=app&platform=${platform}` : '&product=site';
    window.location.href = `${this.webgenUrl}?projectId=${encodeURIComponent(projectId)}${target}`;
  }

  /** La configuration à enregistrer pour ouvrir ce produit, ou `null` si elle le couvre déjà. */
  private configFor(product: IcodeProduct, platform: AppPlatform): GenerationType | null {
    const hasSite = this.wantsSite();
    const hasApp = this.wantsApp();
    if (product === 'site') {
      if (hasSite) return null;
      return hasApp ? 'both' : 'landing';
    }
    // Une plateforme différente de celle enregistrée se réenregistre.
    if (hasApp && this.configs()?.appPlatform === platform) return null;
    if (hasApp && !this.configs()?.appPlatform && platform === 'web') return null;
    return hasSite ? 'both' : 'app';
  }

  /**
   * Le guide « application 3 tiers » d'iDeploy : base de données, puis
   * serveur (son `DATABASE_URL` est rempli tout seul), puis interface (son
   * `VITE_API_URL` aussi).
   */
  protected openGoLiveGuide(): void {
    if (!this.appStarted()) return;
    // L'application mobile se publie comme un site (PWA installable depuis son
    // lien) ; l'application web passe par le guide 3 tiers.
    const path = this.appPlatform() === 'mobile' ? '/new-project' : '/new-project/guide/3-tier';
    window.open(`${this.ideployUrl}${path}`, '_blank', 'noopener');
  }

  protected async copy(product: IcodeProduct): Promise<void> {
    const url = (product === 'site' ? this.siteLive() : this.appLive())?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(product);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : le lien reste affiché.
    }
  }
}
