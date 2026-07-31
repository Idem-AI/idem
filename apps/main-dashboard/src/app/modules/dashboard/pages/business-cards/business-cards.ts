import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { ProjectService } from '../../services/project.service';
import { BusinessCardService } from '../../services/ai-agents/business-card.service';
import {
  BusinessCardExport,
  BusinessCardField,
  BusinessCardHolder,
  BusinessCardModel,
  BusinessCardOrientation,
  BusinessCardSide,
  BUSINESS_CARD_BACK_ID,
  BUSINESS_CARD_FIELDS,
  BUSINESS_CARD_FRONT_ID,
} from '../../models/business-card.model';
import { ProjectModel } from '@idem/shared-models';
import { CardPreviewComponent } from './components/card-preview/card-preview';
import { GenerationPreviewComponent } from './components/generation-preview/generation-preview';
import { HolderFormComponent } from './components/holder-form/holder-form';
import { CardPreviewFonts } from './utils/business-card-preview';

/** Panneau de droite : consultation d'une carte ou saisie d'une personne. */
type WorkspaceMode = 'view' | 'form';

/**
 * Page « Cartes de visite ».
 *
 * Un template IA (recto/verso) dérivé de la charte graphique, puis autant de
 * cartes que de personnes : chaque carte est le template interpolé avec les
 * informations saisies. L'aperçu est recalculé à la frappe côté client ;
 * seul le téléchargement passe par le rendu serveur (300 dpi / PDF).
 */
@Component({
  selector: 'app-business-cards',
  imports: [
    FormsModule,
    TranslateModule,
    Loader,
    CardPreviewComponent,
    GenerationPreviewComponent,
    HolderFormComponent,
  ],
  templateUrl: './business-cards.html',
  styleUrl: './business-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessCardsPage implements OnInit {
  private readonly cardService = inject(BusinessCardService);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  constructor() {
    // Quitter la page pendant une génération ne doit pas laisser des timers
    // orphelins réveiller un composant détruit.
    inject(DestroyRef).onDestroy(() => this.stopStepTimeline());
  }

  // --- État de chargement ----------------------------------------------------
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  // --- Données ---------------------------------------------------------------
  private readonly projectId = signal<string | null>(null);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly card = signal<BusinessCardModel | null>(null);

  // --- Génération du template ------------------------------------------------
  protected readonly isGenerating = signal(false);
  protected readonly orientation = signal<BusinessCardOrientation>('landscape');
  protected readonly orientations: BusinessCardOrientation[] = ['landscape', 'portrait'];
  protected styleBrief = '';

  /**
   * Étape affichée pendant la génération. Le serveur ne renvoie qu'une seule
   * réponse (pas de flux) : cette progression est INDICATIVE et calée sur les
   * durées observées (~50 s). Elle s'arrête à la dernière étape et n'annonce
   * jamais de pourcentage, qui laisserait croire à une mesure réelle.
   */
  protected readonly generationStep = signal(0);
  private readonly stepDelaysMs = [9000, 22000, 38000];
  private stepTimers: ReturnType<typeof setTimeout>[] = [];

  // --- Espace de travail -----------------------------------------------------
  protected readonly mode = signal<WorkspaceMode>('view');
  protected readonly selectedHolderId = signal<string | null>(null);
  protected readonly editingHolderId = signal<string | null>(null);
  protected readonly draftValues = signal<Record<string, string>>({});
  protected readonly isSavingHolder = signal(false);
  protected readonly downloadingKey = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly searchTerm = signal('');

  // --- Dérivés ---------------------------------------------------------------
  protected readonly hasTemplate = computed(() => {
    const sections = this.card()?.sections ?? [];
    return sections.some((s) => typeof s.data === 'string' && s.data.trim().length > 0);
  });

  /** La charte graphique est le prérequis : sans logo ni couleurs, pas de carte. */
  protected readonly hasBranding = computed(() => {
    const branding = (this.project()?.analysisResultModel as any)?.branding;
    return Boolean(branding?.colors?.colors?.primary || branding?.logo?.assetUrls?.primary || branding?.logo?.svg);
  });

  protected readonly templateMeta = computed(() => this.card()?.template ?? null);

  protected readonly cardOrientation = computed<BusinessCardOrientation>(
    () => this.templateMeta()?.orientation ?? 'landscape',
  );

  protected readonly frontHtml = computed(() => this.faceHtml(BUSINESS_CARD_FRONT_ID));
  protected readonly backHtml = computed(() => this.faceHtml(BUSINESS_CARD_BACK_ID));

  protected readonly templateFields = computed<BusinessCardField[]>(() => {
    const fields = this.templateMeta()?.fields;
    return fields && fields.length > 0 ? fields : [...BUSINESS_CARD_FIELDS];
  });

  protected readonly fonts = computed<CardPreviewFonts>(() => {
    const typography = (this.project()?.analysisResultModel as any)?.branding?.typography;
    return {
      primaryFont: typography?.primaryFont,
      secondaryFont: typography?.secondaryFont,
      fontUrl: typography?.url,
    };
  });

  protected readonly holders = computed(() => this.card()?.holders ?? []);

  protected readonly filteredHolders = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.holders();
    return this.holders().filter((holder) =>
      `${holder.fullName} ${holder.jobTitle ?? ''} ${holder.email ?? ''}`.toLowerCase().includes(term),
    );
  });

  protected readonly selectedHolder = computed(
    () => this.holders().find((holder) => holder.id === this.selectedHolderId()) ?? null,
  );

  protected readonly editingHolder = computed(
    () => this.holders().find((holder) => holder.id === this.editingHolderId()) ?? null,
  );

  /** Valeurs injectées dans l'aperçu : brouillon en saisie, personne sinon. */
  protected readonly previewValues = computed<Record<string, string | undefined>>(() => {
    const base: Record<string, string | undefined> = {
      companyName: this.project()?.name,
      tagline: (this.project()?.description ?? '').split('.')[0],
    };
    if (this.mode() === 'form') return { ...base, ...this.draftValues() };
    const holder = this.selectedHolder();
    if (!holder) return base;
    for (const field of BUSINESS_CARD_FIELDS) {
      const value = (holder as unknown as Record<string, unknown>)[field];
      if (typeof value === 'string') base[field] = value;
    }
    return base;
  });

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }
    this.load(projectId);
  }

  private faceHtml(sectionId: string): string {
    const section = this.card()?.sections?.find((s) => s.id === sectionId);
    return typeof section?.data === 'string' ? section.data : '';
  }

  private load(projectId: string): void {
    this.isLoading.set(true);
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.cardService.getBusinessCard(projectId).subscribe({
          next: (card) => {
            this.card.set(card);
            this.orientation.set(card.template?.orientation ?? 'landscape');
            const first = card.holders?.[0];
            if (first) this.selectedHolderId.set(first.id);
            this.isLoading.set(false);
          },
          error: () => {
            this.errorMessage.set(this.translate.instant('dashboard.businessCards.errors.load'));
            this.isLoading.set(false);
          },
        });
      },
      error: () => {
        this.errorMessage.set(this.translate.instant('dashboard.businessCards.errors.load'));
        this.isLoading.set(false);
      },
    });
  }

  protected retry(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    this.errorMessage.set('');
    this.load(projectId);
  }

  // --- Template --------------------------------------------------------------

  protected selectOrientation(orientation: BusinessCardOrientation): void {
    this.orientation.set(orientation);
  }

  protected generateTemplate(): void {
    const projectId = this.projectId();
    if (!projectId || this.isGenerating()) return;

    this.isGenerating.set(true);
    this.errorMessage.set('');
    this.startStepTimeline();
    this.cardService
      .generateTemplate(projectId, {
        orientation: this.orientation(),
        styleBrief: this.styleBrief.trim() || undefined,
      })
      .subscribe({
        next: (card) => {
          this.card.set(card);
          this.stopStepTimeline();
          this.isGenerating.set(false);
        },
        error: (err) => {
          this.errorMessage.set(
            this.translate.instant(
              err?.status === 409
                ? 'dashboard.businessCards.errors.brandingRequired'
                : 'dashboard.businessCards.errors.generate',
            ),
          );
          this.stopStepTimeline();
          this.isGenerating.set(false);
        },
      });
  }

  private startStepTimeline(): void {
    this.stopStepTimeline();
    this.generationStep.set(0);
    this.stepTimers = this.stepDelaysMs.map((delay, index) =>
      setTimeout(() => this.generationStep.set(index + 1), delay),
    );
  }

  private stopStepTimeline(): void {
    this.stepTimers.forEach((timer) => clearTimeout(timer));
    this.stepTimers = [];
  }

  protected editTemplate(): void {
    this.router.navigate(['/project/business-cards/edit']);
  }

  protected goToBranding(): void {
    this.router.navigate(['/project/branding']);
  }

  // --- Personnes -------------------------------------------------------------

  protected onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  protected selectHolder(holder: BusinessCardHolder): void {
    this.selectedHolderId.set(holder.id);
    this.mode.set('view');
  }

  protected startCreate(): void {
    this.editingHolderId.set(null);
    this.draftValues.set({});
    this.mode.set('form');
  }

  protected startEdit(holder: BusinessCardHolder): void {
    this.selectedHolderId.set(holder.id);
    this.editingHolderId.set(holder.id);
    this.mode.set('form');
  }

  protected cancelForm(): void {
    this.editingHolderId.set(null);
    this.mode.set('view');
  }

  protected onDraftChange(values: Record<string, string>): void {
    this.draftValues.set(values);
  }

  protected saveHolder(values: Record<string, string>): void {
    const projectId = this.projectId();
    if (!projectId || this.isSavingHolder()) return;

    this.isSavingHolder.set(true);
    const editingId = this.editingHolderId();
    const request = editingId
      ? this.cardService.updateHolder(projectId, editingId, values)
      : this.cardService.addHolder(projectId, values as unknown as Omit<BusinessCardHolder, 'id'>);

    request.subscribe({
      next: (holder) => {
        const current = this.card();
        if (current) {
          const holders = editingId
            ? current.holders.map((h) => (h.id === holder.id ? holder : h))
            : [...current.holders, holder];
          this.card.set({ ...current, holders });
        }
        this.selectedHolderId.set(holder.id);
        this.editingHolderId.set(null);
        this.isSavingHolder.set(false);
        this.mode.set('view');
      },
      error: () => {
        this.errorMessage.set(this.translate.instant('dashboard.businessCards.errors.saveHolder'));
        this.isSavingHolder.set(false);
      },
    });
  }

  protected deleteHolder(holder: BusinessCardHolder, event: Event): void {
    event.stopPropagation();
    const projectId = this.projectId();
    if (!projectId || this.deletingId()) return;
    const confirmed = window.confirm(
      this.translate.instant('dashboard.businessCards.confirmDelete', { name: holder.fullName }),
    );
    if (!confirmed) return;

    this.deletingId.set(holder.id);
    this.cardService.deleteHolder(projectId, holder.id).subscribe({
      next: () => {
        const current = this.card();
        if (current) {
          const holders = current.holders.filter((h) => h.id !== holder.id);
          this.card.set({ ...current, holders });
          if (this.selectedHolderId() === holder.id) {
            this.selectedHolderId.set(holders[0]?.id ?? null);
          }
        }
        this.deletingId.set(null);
      },
      error: () => {
        this.errorMessage.set(this.translate.instant('dashboard.businessCards.errors.deleteHolder'));
        this.deletingId.set(null);
      },
    });
  }

  // --- Téléchargement --------------------------------------------------------

  protected downloadKey(side: BusinessCardSide, format: BusinessCardExport): string {
    return `${side}-${format}`;
  }

  protected download(side: BusinessCardSide, format: BusinessCardExport): void {
    const projectId = this.projectId();
    const holder = this.selectedHolder();
    if (!projectId || !holder || this.downloadingKey()) return;

    const key = this.downloadKey(side, format);
    this.downloadingKey.set(key);
    this.cardService.downloadCard(projectId, holder.id, side, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const slug = holder.fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        link.href = url;
        link.download = `${slug}-${side}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.downloadingKey.set(null);
      },
      error: () => {
        this.errorMessage.set(this.translate.instant('dashboard.businessCards.errors.download'));
        this.downloadingKey.set(null);
      },
    });
  }

  /** Initiales affichées dans la liste des personnes. */
  protected initials(holder: BusinessCardHolder): string {
    return holder.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
