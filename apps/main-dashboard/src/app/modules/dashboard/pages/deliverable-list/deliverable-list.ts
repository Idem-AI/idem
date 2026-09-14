import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { ProjectService } from '../../services/project.service';
import { BusinessPlanService } from '../../services/ai-agents/business-plan.service';
import { PitchDeckService } from '../../services/ai-agents/pitch-deck.service';
import {
  DeliverableDocumentSummary,
  DeliverableKind,
  documentActivityTime,
} from '../../models/deliverable-document.model';
import { businessPlanVariantLabel, pitchDeckTypeLabel } from '../../utils/deliverable-labels';

type DocumentStatus = 'draft' | 'partial' | 'complete';

/** Une carte de la liste. */
interface DocumentCard {
  id: string;
  name: string;
  variantLabel: string;
  status: DocumentStatus;
  completed: number;
  expected: number;
  progress: number;
  updatedLabel: string | null;
}

interface DeliverableListConfig {
  /** Préfixe i18n propre au livrable. */
  i18n: string;
  icon: string;
  /** Liste ; un document s'ouvre sous `route/<id>`. */
  route: string;
  /** Création : choix de la structure (plan) ou du type (deck). */
  createRoute: string;
}

const CONFIG: Record<DeliverableKind, DeliverableListConfig> = {
  businessPlan: {
    i18n: 'dashboard.deliverableList.businessPlan',
    icon: 'pi pi-calendar',
    route: '/project/business-plan',
    createRoute: '/project/business-plan/generate',
  },
  pitchDeck: {
    i18n: 'dashboard.deliverableList.pitchDeck',
    icon: 'pi pi-desktop',
    route: '/project/pitch-deck',
    createRoute: '/project/pitch-deck/new',
  },
};

/**
 * Liste des documents d'un livrable — les business plans ou les pitch decks du
 * projet. C'est l'entrée du menu : un projet en garde plusieurs (dossier
 * bancaire et plan investisseur, deck de levée et présentation commerciale),
 * et l'utilisateur choisit celui qu'il ouvre.
 *
 * Le livrable vient de la route (`data.deliverable`) : les deux listes ne
 * diffèrent que par leurs libellés et leur parcours de création.
 */
@Component({
  selector: 'app-deliverable-list',
  imports: [TranslateModule, ReactiveFormsModule, RouterLink, Loader, IncompleteProjectBannerComponent],
  templateUrl: './deliverable-list.html',
  styleUrl: './deliverable-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliverableListPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly cookieService = inject(CookieService);
  private readonly projectService = inject(ProjectService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly kind: DeliverableKind =
    this.route.snapshot.data['deliverable'] === 'pitchDeck' ? 'pitchDeck' : 'businessPlan';
  protected readonly config = CONFIG[this.kind];

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isBrandingComplete = signal(false);
  private readonly documents = signal<DeliverableDocumentSummary[]>([]);

  /** Carte en cours de renommage. */
  protected readonly editingId = signal<string | null>(null);
  /** Carte dont la suppression attend confirmation. */
  protected readonly confirmDeleteId = signal<string | null>(null);
  /** Carte dont une requête est en cours. */
  protected readonly busyId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(120)],
  });

  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly confirmDeleteButton = viewChild<ElementRef<HTMLButtonElement>>('confirmDeleteButton');

  private readonly dateFormat = new Intl.DateTimeFormat(this.translate.currentLang || 'fr', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  /** Documents, du plus récemment modifié au plus ancien. */
  protected readonly cards = computed<DocumentCard[]>(() =>
    [...this.documents()]
      .sort((a, b) => documentActivityTime(b) - documentActivityTime(a))
      .map((document) => this.toCard(document)),
  );

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) {
      this.isLoading.set(false);
      return;
    }
    this.load(projectId);
  }

  protected retry(): void {
    const projectId = this.projectId();
    if (projectId) this.load(projectId);
  }

  private load(projectId: string): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    this.projectService
      .getProjectById(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.project.set(project);
          const { isComplete } = this.brandingValidation.checkBrandingCompletion(project);
          this.isBrandingComplete.set(isComplete);
          if (!isComplete) {
            this.isLoading.set(false);
            return;
          }
          this.listRequest(projectId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (documents) => {
                this.documents.set(documents);
                this.isLoading.set(false);
              },
              error: () => this.failLoading(),
            });
        },
        error: () => this.failLoading(),
      });
  }

  private failLoading(): void {
    this.loadError.set(true);
    this.isLoading.set(false);
  }

  protected create(): void {
    this.router.navigate([this.config.createRoute]);
  }

  /* ------------------------------------------------------------------ */
  /* Renommer                                                            */
  /* ------------------------------------------------------------------ */

  protected startRename(card: DocumentCard): void {
    this.actionError.set(null);
    this.confirmDeleteId.set(null);
    this.nameControl.setValue(card.name);
    this.editingId.set(card.id);
    afterNextRender(
      () => {
        const input = this.renameInput()?.nativeElement;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  protected submitRename(event: Event, card: DocumentCard): void {
    event.preventDefault();
    const projectId = this.projectId();
    const name = this.nameControl.value.trim();
    if (!projectId || !name || this.nameControl.invalid || this.busyId()) return;
    if (name === card.name) {
      this.cancelRename();
      return;
    }

    this.busyId.set(card.id);
    this.renameRequest(projectId, card.id, name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.documents.update((list) => list.map((d) => (d.id === summary.id ? summary : d)));
          this.busyId.set(null);
          this.editingId.set(null);
        },
        error: () => {
          this.busyId.set(null);
          this.actionError.set(this.translate.instant('dashboard.deliverableList.errors.rename'));
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /* Supprimer                                                           */
  /* ------------------------------------------------------------------ */

  protected requestDelete(card: DocumentCard): void {
    this.actionError.set(null);
    this.editingId.set(null);
    this.confirmDeleteId.set(card.id);
    // Le focus passe au bouton de confirmation : Entrée confirme, Échap annule.
    afterNextRender(() => this.confirmDeleteButton()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected confirmDelete(card: DocumentCard): void {
    const projectId = this.projectId();
    if (!projectId || this.busyId()) return;

    this.busyId.set(card.id);
    this.deleteRequest(projectId, card.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.documents.update((list) => list.filter((d) => d.id !== card.id));
          this.busyId.set(null);
          this.confirmDeleteId.set(null);
        },
        error: () => {
          this.busyId.set(null);
          this.actionError.set(this.translate.instant('dashboard.deliverableList.errors.delete'));
        },
      });
  }

  /* ------------------------------------------------------------------ */
  /* Livrable                                                            */
  /* ------------------------------------------------------------------ */

  private listRequest(projectId: string): Observable<DeliverableDocumentSummary[]> {
    return this.kind === 'pitchDeck'
      ? this.pitchDeckService.listPitchDecks(projectId)
      : this.businessPlanService.listBusinessPlans(projectId);
  }

  private renameRequest(
    projectId: string,
    documentId: string,
    name: string,
  ): Observable<DeliverableDocumentSummary> {
    return this.kind === 'pitchDeck'
      ? this.pitchDeckService.renamePitchDeck(projectId, documentId, name)
      : this.businessPlanService.renameBusinessPlan(projectId, documentId, name);
  }

  private deleteRequest(projectId: string, documentId: string): Observable<void> {
    return this.kind === 'pitchDeck'
      ? this.pitchDeckService.deletePitchDeck(projectId, documentId)
      : this.businessPlanService.deleteBusinessPlan(projectId, documentId);
  }

  private toCard(document: DeliverableDocumentSummary): DocumentCard {
    const expected = document.expectedSectionNames.length;
    const completed = Math.min(document.completedSectionCount, expected);
    const variantLabel =
      this.kind === 'pitchDeck'
        ? pitchDeckTypeLabel(this.translate, document.variant)
        : businessPlanVariantLabel(this.translate, document.variant);
    return {
      id: document.id,
      name: document.name || variantLabel,
      variantLabel,
      status: completed === 0 ? 'draft' : completed < expected ? 'partial' : 'complete',
      completed,
      expected,
      progress: expected > 0 ? Math.round((completed / expected) * 100) : 0,
      updatedLabel: this.formatDate(document.updatedAt ?? document.createdAt),
    };
  }

  private formatDate(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : this.dateFormat.format(date);
  }
}
