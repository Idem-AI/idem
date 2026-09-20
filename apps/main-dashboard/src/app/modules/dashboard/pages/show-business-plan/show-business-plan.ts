import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { BusinessPlanService } from '../../services/ai-agents/business-plan.service';
import { Loader } from '../../../../shared/components/loader/loader';
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
import { BusinessPlanModel } from '../../models/businessPlan.model';
import {
  findDeliverableDocument,
  StoredDeliverableDocument,
} from '../../models/deliverable-document.model';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import { businessPlanVariantLabel } from '../../utils/deliverable-labels';

type StoredBusinessPlan = BusinessPlanModel & StoredDeliverableDocument;

/**
 * Un business plan du projet (`/project/business-plan/:documentId`) : aperçu et
 * accès à la génération. La liste des plans est une page à part.
 */
@Component({
  selector: 'app-show-business-plan',
  imports: [
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
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  /** Plan affiché, désigné par l'URL. */
  protected readonly documentId = signal<string | null>(
    this.route.snapshot.paramMap.get('documentId'),
  );

  // Signals for state management
  protected readonly isLoading = signal<boolean>(true);
  /** true dès que le plan a des sections à afficher (l'aperçu les rend sans PDF). */
  protected readonly hasBusinessPlan = signal<boolean>(false);
  /** Le plan désigné n'existe pas (supprimé, lien d'un autre projet). */
  protected readonly notFound = signal<boolean>(false);
  protected readonly projectIdFromCookie = signal<string | null>(null);
  protected readonly hasError = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly underFilledSections = signal<string[]>([]);
  /** Catalogue des sections : traduit les clés de structure en noms canoniques. */
  private readonly catalogSections = signal<BusinessPlanCatalogSection[]>([]);

  /** Le plan affiché, parmi ceux du projet. */
  private readonly plan = computed(() =>
    findDeliverableDocument<StoredBusinessPlan>(
      this.project()?.analysisResultModel,
      'businessPlan',
      this.documentId(),
    ),
  );

  protected readonly variantLabel = computed(() =>
    businessPlanVariantLabel(this.translate, this.plan()?.structure?.templateId),
  );

  protected readonly heading = computed(() => this.plan()?.name || this.variantLabel());

  /**
   * Sections ATTENDUES pour ce plan.
   *
   * Elles viennent de sa structure (dossier bancaire, plan investisseur,
   * sommaire composé…), pas d'une liste figée : sinon un plan bancaire de neuf
   * sections serait affiché comme incomplet parce qu'il ne contient pas
   * « Opportunity ». La liste historique reste le repli tant que le catalogue
   * n'est pas chargé ou qu'aucune structure n'a été choisie.
   */
  protected readonly expectedSectionNames = computed<readonly string[]>(() => {
    const keys = this.plan()?.structure?.sectionKeys;
    const catalog = this.catalogSections();
    if (!keys?.length || catalog.length === 0) return BUSINESS_PLAN_SECTION_NAMES;

    const byKey = new Map(catalog.map((section) => [section.key, section.name]));
    const names = keys.map((key) => byKey.get(key)).filter((name): name is string => !!name);
    return names.length > 0 ? names : BUSINESS_PLAN_SECTION_NAMES;
  });

  protected readonly completeness = computed(() =>
    analyzeGenerationCompleteness(
      this.expectedSectionNames(),
      this.plan()?.sections,
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
    const keys = this.plan()?.structure?.sectionKeys;
    if (keys?.length && this.catalogSections().length === 0) return [];
    return this.completeness().items;
  });

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    this.projectIdFromCookie.set(projectId);

    if (!projectId) {
      this.isLoading.set(false);
      return;
    }

    // Le catalogue est mémorisé par le service : le charger ici ne coûte une
    // requête qu'à la première ouverture de la session.
    this.businessPlanService.getStructureCatalog().subscribe({
      next: (catalog) => this.catalogSections.set(catalog.sections),
      error: () => {
        // Sans catalogue, la complétude retombe sur la liste historique.
      },
    });

    this.checkBrandingCompletion(projectId);
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

        if (isComplete) {
          this.loadExistingBusinessPlan(projectId);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking branding completion:', error);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set(this.translate.instant('dashboard.showBusinessPlan.errors.load'));
      },
    });
  }

  /**
   * Le plan existe dès qu'il a des sections HTML : l'aperçu les rend
   * directement. Le PDF, lourd à produire comme à afficher, n'est demandé à
   * l'API qu'au clic sur « Télécharger ».
   */
  private loadExistingBusinessPlan(projectId: string): void {
    const plan = this.plan();
    if (!plan) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    this.businessPlanService.getBusinessPlanPdfQuality(projectId, plan.id).subscribe({
      next: (quality) => {
        const underfilled = (quality?.underFilledSections ?? []).map((s) => s.sectionName);
        this.underFilledSections.set(underfilled);
      },
      error: () => {
        // Quality info might not exist yet; ignore
      },
    });

    this.hasBusinessPlan.set(
      plan.sections.some((section) => typeof section.data === 'string' && section.data.trim() !== ''),
    );
    this.isLoading.set(false);
  }

  /**
   * Génération de CE plan : la page de génération reprend sa structure.
   */
  protected generateBusinessPlan(force = false): void {
    const documentId = this.documentId();
    this.router.navigate(['/project/business-plan/generate'], {
      queryParams: {
        ...(documentId ? { documentId } : {}),
        ...(force ? { force: 'true' } : {}),
      },
    });
  }

  /**
   * Regenerate a single business plan section (canonical backend step name)
   */
  protected regenerateSection(sectionName: string): void {
    const documentId = this.documentId();
    this.router.navigate(['/project/business-plan/generate'], {
      queryParams: { ...(documentId ? { documentId } : {}), sections: sectionName },
    });
  }

  /**
   * Retry loading the project and its business plan
   */
  protected retryLoadBusinessPlan(): void {
    const projectId = this.projectIdFromCookie();
    if (projectId) {
      this.hasError.set(false);
      this.isLoading.set(true);
      this.checkBrandingCompletion(projectId);
    }
  }

  protected goToList(): void {
    this.router.navigate(['/project/business-plan']);
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    this.router.navigate(['/projects']);
  }
}
