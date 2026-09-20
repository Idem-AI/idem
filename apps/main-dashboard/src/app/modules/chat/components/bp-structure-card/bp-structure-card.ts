import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BusinessPlanService } from '../../../dashboard/services/ai-agents/business-plan.service';
import {
  BusinessPlanAudience,
  BusinessPlanStructureCatalog,
} from '../../../dashboard/models/business-plan-structure.model';

/** Une structure proposée dans le fil, avec son sommaire déplié à la demande. */
interface StructureOption {
  id: string;
  audience: BusinessPlanAudience;
  sectionCount: number;
  estimatedPages: string;
  source?: string;
  /** Libellés des sections, dans l'ordre du document. */
  outline: string[];
}

/**
 * Choix de la structure du business plan, dans le fil de conversation.
 *
 * Le sélecteur complet de l'atelier montre les dix modèles côte à côte avec
 * leur sommaire : c'est la bonne présentation sur une page dédiée, et la
 * mauvaise dans un fil de discussion où la carte doit rester lisible entre deux
 * messages. Ici les modèles sont des tuiles, et le sommaire ne se déplie que
 * pour celui qu'on regarde.
 *
 * Le réordonnancement n'est PAS proposé : réorganiser dix-sept sections dans
 * une bulle de conversation serait pénible et ne servirait personne. La tuile
 * « personnaliser » renvoie à l'atelier, qui est fait pour ça.
 */
@Component({
  selector: 'app-bp-structure-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './bp-structure-card.html',
  styleUrl: './bp-structure-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BpStructureCardComponent implements OnInit {
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly translate = inject(TranslateService);

  /** Modèle retenu ('cancelled' si abandonné) — fige la carte. */
  readonly selected = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly picked = output<string>();
  /** L'utilisateur veut composer son sommaire : direction l'atelier. */
  readonly customiseRequested = output<void>();
  readonly cancelled = output<void>();

  protected readonly isLoading = signal(true);
  protected readonly loadFailed = signal(false);
  private readonly catalog = signal<BusinessPlanStructureCatalog | null>(null);
  /** Modèle dont le sommaire est déplié (un seul à la fois). */
  protected readonly expandedId = signal<string | null>(null);

  protected readonly options = computed<StructureOption[]>(() => {
    const catalog = this.catalog();
    if (!catalog) return [];
    const byKey = new Map(catalog.sections.map((section) => [section.key, section.name]));

    return catalog.templates.map((template) => ({
      id: template.id,
      audience: template.audience,
      sectionCount: template.sectionKeys.length,
      estimatedPages: template.estimatedPages,
      source: template.source,
      outline: template.sectionKeys.reduce<string[]>((names, key) => {
        const name = byKey.get(key);
        if (name) names.push(this.sectionLabel(name));
        return names;
      }, []),
    }));
  });

  /** Sommaire du modèle déplié, vide quand aucun ne l'est. */
  protected readonly expandedOutline = computed<string[]>(
    () => this.options().find((option) => option.id === this.expandedId())?.outline ?? [],
  );

  protected readonly isLocked = computed(() => this.disabled() || !!this.selected());

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.businessPlanService.getStructureCatalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected pick(templateId: string): void {
    if (this.isLocked()) return;
    this.picked.emit(templateId);
  }

  /**
   * Déplie le sommaire sans choisir le modèle.
   *
   * Séparé du clic de sélection à dessein : lire ce que contient un dossier
   * bancaire avant de s'engager dessus est exactement ce que cette carte doit
   * permettre, et un déplacement qui vaudrait validation l'interdirait.
   */
  protected toggleOutline(templateId: string, event: Event): void {
    event.stopPropagation();
    this.expandedId.update((current) => (current === templateId ? null : templateId));
  }

  protected customise(): void {
    if (this.isLocked()) return;
    this.customiseRequested.emit();
  }

  protected cancel(): void {
    if (this.isLocked()) return;
    this.cancelled.emit();
  }

  /** Libellé traduit d'une section, à partir de son nom canonique backend. */
  private sectionLabel(name: string): string {
    const key = `dashboard.generationPanel.sections.businessPlan.${name}`;
    const label = this.translate.instant(key);
    return label === key ? name : label;
  }
}
