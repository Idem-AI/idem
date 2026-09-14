import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { BusinessPlanService } from '../../services/ai-agents/business-plan.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { GenerationStatusPanelComponent } from '../../components/generation-status-panel/generation-status-panel';
import { DocumentPreviewComponent } from '../../components/document-preview/document-preview';
import {
  analyzeGenerationCompleteness,
  BUSINESS_PLAN_SECTION_NAMES,
} from '../../models/generation-completeness';
import { BusinessPlanCatalogSection } from '../../models/business-plan-structure.model';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';

@Component({
  selector: 'app-show-business-plan',
  standalone: true,
  imports: [
    CommonModule,
    DocumentPreviewComponent,
    Loader,
    TranslateModule,
    IncompleteProjectBannerComponent,
    GenerationStatusPanelComponent,
  ],
  templateUrl: './show-business-plan.html',
  styleUrls: ['./show-business-plan.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowBusinessPlan implements OnInit {
  // Injected services
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  // Signals for state management
  protected readonly isLoading = signal<boolean>(true);
  /** true dès que le plan a des sections à afficher (l'aperçu les rend sans PDF). */
  protected readonly hasBusinessPlan = signal<boolean>(false);
  protected readonly projectIdFromCookie = signal<string | null>(null);
  protected readonly hasError = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly isRetryable = signal<boolean>(false);

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly underFilledSections = signal<string[]>([]);
  /** Catalogue des sections : traduit les clés de structure en noms canoniques. */
  private readonly catalogSections = signal<BusinessPlanCatalogSection[]>([]);

  /**
   * Sections ATTENDUES pour ce projet.
   *
   * Elles viennent de la structure choisie (dossier bancaire, plan
   * investisseur, sommaire composé…), pas d'une liste figée : sinon un plan
   * bancaire de neuf sections serait affiché comme incomplet parce qu'il ne
   * contient pas « Opportunity ». La liste historique reste le repli tant que
   * le catalogue n'est pas chargé ou qu'aucune structure n'a été choisie.
   */
  protected readonly expectedSectionNames = computed<readonly string[]>(() => {
    const keys: string[] | undefined =
      this.project()?.analysisResultModel?.businessPlan?.structure?.sectionKeys;
    const catalog = this.catalogSections();
    if (!keys?.length || catalog.length === 0) return BUSINESS_PLAN_SECTION_NAMES;

    const byKey = new Map(catalog.map((section) => [section.key, section.name]));
    const names = keys.map((key) => byKey.get(key)).filter((name): name is string => !!name);
    return names.length > 0 ? names : BUSINESS_PLAN_SECTION_NAMES;
  });

  protected readonly completeness = computed(() =>
    analyzeGenerationCompleteness(
      this.expectedSectionNames(),
      this.project()?.analysisResultModel?.businessPlan?.sections,
      this.underFilledSections(),
    ),
  );

  protected readonly isBusinessPlanIncomplete = computed(() => {
    const completeness = this.completeness();
    return completeness.hasStarted && (!completeness.isComplete || this.underFilledSections().length > 0);
  });

  /**
   * Sections attendues transmises à l'aperçu. Tant que le catalogue n'a pas
   * répondu, les noms d'un plan structuré sont inconnus : on ne transmet rien,
   * plutôt que d'afficher comme manquantes des sections que ce plan ne
   * contient pas (la liste historique n'est pas la sienne).
   */
  protected readonly previewOutline = computed(() => {
    const keys: string[] | undefined =
      this.project()?.analysisResultModel?.businessPlan?.structure?.sectionKeys;
    if (keys?.length && this.catalogSections().length === 0) return [];
    return this.completeness().items;
  });

  ngOnInit(): void {
    // Get project ID from cookies
    const projectId = this.cookieService.get('projectId');
    this.projectIdFromCookie.set(projectId);

    if (projectId) {
      // Le catalogue est mémorisé par le service : le charger ici ne coûte une
      // requête qu'à la première ouverture de la session.
      this.businessPlanService.getStructureCatalog().subscribe({
        next: (catalog) => this.catalogSections.set(catalog.sections),
        error: () => {
          // Sans catalogue, la complétude retombe sur la liste historique.
        },
      });

      // First check branding completion
      this.checkBrandingCompletion(projectId);
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if project branding is complete before loading content
   */
  private checkBrandingCompletion(projectId: string): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);

        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Only load business plan if branding is complete
        if (isComplete) {
          this.loadExistingBusinessPlan(projectId, project);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.isRetryable.set(true);
        this.errorMessage.set('Erreur lors de la vérification du projet');
      },
    });
  }

  /**
   * Le plan existe dès qu'il a des sections HTML : l'aperçu les rend
   * directement. Le PDF, lourd à produire comme à afficher, n'est demandé à
   * l'API qu'au clic sur « Télécharger ».
   */
  private loadExistingBusinessPlan(projectId: string, project: ProjectModel | null): void {
    this.businessPlanService.getBusinessPlanPdfQuality(projectId).subscribe({
      next: (quality) => {
        const underfilled = (quality?.underFilledSections ?? []).map((s) => s.sectionName);
        this.underFilledSections.set(underfilled);
      },
      error: () => {
        // Quality info might not exist yet; ignore
      },
    });

    const sections: { data?: unknown }[] =
      project?.analysisResultModel?.businessPlan?.sections ?? [];
    this.hasBusinessPlan.set(
      sections.some((section) => typeof section.data === 'string' && section.data.trim() !== ''),
    );
    this.isLoading.set(false);
  }

  /**
   * Navigate to business plan generation page
   */
  protected generateBusinessPlan(force = false): void {
    console.log('Navigating to business plan generation page, force:', force);
    this.router.navigate(['/project/business-plan/generate'], {
      queryParams: force ? { force: 'true' } : {}
    });
  }

  /**
   * Regenerate a single business plan section (canonical backend step name)
   */
  protected regenerateSection(sectionName: string): void {
    this.router.navigate(['/project/business-plan/generate'], {
      queryParams: { sections: sectionName },
    });
  }

  /**
   * Retry loading the project and its business plan
   */
  protected retryLoadBusinessPlan(): void {
    const projectId = this.projectIdFromCookie();
    if (projectId) {
      this.hasError.set(false);
      this.isRetryable.set(false);
      this.isLoading.set(true);
      this.checkBrandingCompletion(projectId);
    }
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    console.log('Navigating to projects page');
    this.router.navigate(['/projects']);
  }
}
