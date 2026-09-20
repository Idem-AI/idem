import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BusinessPlanService } from '../../../../services/ai-agents/business-plan.service';
import {
  BusinessPlanAudience,
  BusinessPlanCatalogSection,
  BusinessPlanSectionCategory,
  BusinessPlanStructure,
  BusinessPlanStructureCatalog,
  BusinessPlanStructureSelection,
  BusinessPlanTemplate,
  SECTION_CATEGORY_ORDER,
} from '../../../../models/business-plan-structure.model';
import { StructureIllustrationComponent } from './structure-illustration/structure-illustration';
import { businessPlanVariantLabel } from '../../../../utils/deliverable-labels';

/** Une ligne du sommaire affiché à droite. */
interface OutlineRow {
  key: string;
  /** Nom canonique backend — pilote la console de génération. */
  name: string;
  label: string;
  category: BusinessPlanSectionCategory;
  needsResearch: boolean;
  /** La couverture ne se retire pas : un plan sans page de garde ne se dépose pas. */
  locked: boolean;
  position: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Une entrée de la liste des modèles. */
interface TemplateRow {
  id: string;
  audience: BusinessPlanAudience | 'custom';
  source?: string;
  estimatedPages: string;
  sectionCount: number;
  isCustom: boolean;
  isDefault: boolean;
}

/** Une tuile « à qui allez-vous le remettre ? ». */
interface AudienceCard {
  audience: BusinessPlanAudience;
  templateCount: number;
}

/** Un groupe du tiroir « ajouter une section ». */
interface CatalogGroup {
  category: BusinessPlanSectionCategory;
  items: { key: string; label: string; needsResearch: boolean }[];
}

/**
 * Tuiles de destinataire, dans l'ordre d'affichage. « Polyvalent » ferme la
 * marche : c'est la réponse de celui qui ne sait pas encore à qui il remettra
 * son dossier.
 */
const AUDIENCES: BusinessPlanAudience[] = ['bank', 'investor', 'grant', 'internal', 'general'];

/**
 * Choix de la structure du business plan, avant sa génération.
 *
 * Le problème que cet écran règle : une banque, un fonds d'amorçage et un
 * bailleur de subvention n'attendent pas le même sommaire, et plusieurs
 * institutions imposent littéralement le leur. Un plan qui ne le suit pas est
 * renvoyé avant d'être lu.
 *
 * L'arbitrage tenu ici est celui de la qualité : on ne laisse PAS composer un
 * sommaire libre. L'utilisateur choisit un modèle réel, ou réordonne un
 * sommaire à partir d'un catalogue fermé — chaque section y arrive avec son
 * brief de contenu, son volume et ses recherches déjà écrits. Une section
 * inventée à la volée n'aurait rien de tout cela.
 *
 * L'écran pose les questions dans l'ordre où on se les pose : à qui remet-on
 * le dossier, quel modèle ce lecteur attend, quel sommaire en sort. Le
 * sommaire garde la place principale — c'est lui qui décide —, mais on n'y
 * arrive plus en comparant dix modèles à froid : le destinataire filtre la
 * liste et sélectionne aussitôt un modèle pertinent.
 */
@Component({
  selector: 'app-business-plan-structure',
  imports: [TranslateModule, StructureIllustrationComponent],
  templateUrl: './business-plan-structure.html',
  styleUrl: './business-plan-structure.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPlanStructureComponent implements OnInit {
  private readonly businessPlanService = inject(BusinessPlanService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  /**
   * Plan dont on choisit la structure. Absent : un nouveau plan, créé à la
   * confirmation sur la structure choisie — ceux déjà rédigés restent intacts.
   */
  readonly documentId = input<string | null>(null);

  /** Structure enregistrée et confirmée : la génération peut démarrer. */
  readonly structureConfirmed = output<BusinessPlanStructureSelection>();

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  private readonly catalog = signal<BusinessPlanStructureCatalog | null>(null);
  protected readonly selectedTemplateId = signal<string>('');
  protected readonly audienceFilter = signal<BusinessPlanAudience | 'all'>('all');

  /**
   * Sommaire de travail. `null` tant que l'utilisateur n'a rien réordonné :
   * on envoie alors le seul `templateId`, et le serveur reste la source du
   * sommaire du modèle. Dès qu'il touche à l'ordre, la liste devient explicite.
   */
  protected readonly customKeys = signal<string[] | null>(null);
  protected readonly isComposing = signal(false);
  protected readonly isAddOpen = signal(false);

  /** Annonce des déplacements pour les lecteurs d'écran. */
  protected readonly liveMessage = signal('');

  /**
   * Hauteur qui fait tenir l'écran entier dans la fenêtre, sous la barre du
   * dashboard, sans défilement de page (`null` tant qu'elle n'est pas mesurée).
   * Sur grand écran, les colonnes prennent le reste et défilent chacune de leur
   * côté : le bouton de validation reste visible.
   */
  protected readonly fitHeight = signal<string | null>(null);
  private readonly shell = viewChild.required<ElementRef<HTMLElement>>('shell');
  private readonly templateScroll = viewChild<ElementRef<HTMLElement>>('templateScroll');

  /** Répétitions du squelette de chargement, figées hors du template. */
  protected readonly skeletonAudiences = [1, 2, 3, 4, 5];
  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly skeletonLines = [1, 2, 3, 4, 5, 6, 7];

  private readonly sectionsByKey = computed(() => {
    const map = new Map<string, BusinessPlanCatalogSection>();
    for (const section of this.catalog()?.sections ?? []) map.set(section.key, section);
    return map;
  });

  /** Tuiles de destinataire. Un public sans modèle au catalogue n'en a pas. */
  protected readonly audienceCards = computed<AudienceCard[]>(() => {
    const templates = this.catalog()?.templates ?? [];
    return AUDIENCES.map((audience) => ({
      audience,
      templateCount: templates.filter((t) => t.audience === audience).length,
    })).filter((card) => card.templateCount > 0);
  });

  protected readonly templateTotal = computed(() => this.catalog()?.templates.length ?? 0);

  /** Destinataire qui filtre la liste des modèles, `null` sans filtre. */
  protected readonly activeAudience = computed<BusinessPlanAudience | null>(() => {
    const filter = this.audienceFilter();
    return filter === 'all' ? null : filter;
  });

  protected readonly templates = computed<TemplateRow[]>(() => {
    const catalog = this.catalog();
    if (!catalog) return [];
    const filter = this.audienceFilter();
    const selected = this.selectedTemplateId();
    const rows: TemplateRow[] = catalog.templates
      // Le modèle SÉLECTIONNÉ reste listé quel que soit le filtre : sinon le
      // panneau de droite décrirait un sommaire dont plus aucune ligne n'est
      // cochée à gauche.
      .filter((t) => filter === 'all' || t.audience === filter || t.id === selected)
      .map((t) => ({
        id: t.id,
        audience: t.audience,
        source: t.source,
        estimatedPages: t.estimatedPages,
        sectionCount: t.sectionKeys.length,
        isCustom: false,
        isDefault: t.isDefault,
      }));

    // La composition libre ferme toujours la liste : c'est la sortie de
    // secours, pas la première proposition.
    rows.push({
      id: catalog.customTemplateId,
      audience: 'custom',
      estimatedPages: '',
      // Compté nulle part : la ligne « sur mesure » n'affiche pas de décompte,
      // et le lire ici rattacherait la liste des modèles à chaque
      // réordonnancement du sommaire.
      sectionCount: 0,
      isCustom: true,
      isDefault: false,
    });
    return rows;
  });

  /** Clés effectivement retenues : celles réordonnées, sinon celles du modèle. */
  private readonly workingKeys = computed<string[]>(() => {
    const custom = this.customKeys();
    if (custom) return custom;
    return this.templateById(this.selectedTemplateId())?.sectionKeys ?? [];
  });

  protected readonly outline = computed<OutlineRow[]>(() => {
    const keys = this.workingKeys();
    const byKey = this.sectionsByKey();
    return keys.reduce<OutlineRow[]>((rows, key, index) => {
      const section = byKey.get(key);
      if (!section) return rows;
      rows.push({
        key,
        name: section.name,
        label: this.sectionLabel(section.name),
        category: section.category,
        needsResearch: section.needsResearch,
        locked: section.required,
        position: index + 1,
        isFirst: index === 0,
        isLast: index === keys.length - 1,
      });
      return rows;
    }, []);
  });

  /** Sections encore disponibles, groupées par famille. */
  protected readonly availableGroups = computed<CatalogGroup[]>(() => {
    const used = new Set(this.workingKeys());
    const groups = new Map<BusinessPlanSectionCategory, CatalogGroup['items']>();
    for (const section of this.catalog()?.sections ?? []) {
      if (used.has(section.key)) continue;
      const items = groups.get(section.category) ?? [];
      items.push({
        key: section.key,
        label: this.sectionLabel(section.name),
        needsResearch: section.needsResearch,
      });
      groups.set(section.category, items);
    }
    return SECTION_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
      category,
      items: groups.get(category)!,
    }));
  });

  protected readonly selectedTemplate = computed(() =>
    this.templateById(this.selectedTemplateId()),
  );

  /** Le sommaire s'écarte-t-il de celui du modèle choisi ? */
  protected readonly isEdited = computed(() => {
    const template = this.selectedTemplate();
    const custom = this.customKeys();
    if (!template || !custom) return false;
    return (
      custom.length !== template.sectionKeys.length ||
      custom.some((key, i) => key !== template.sectionKeys[i])
    );
  });

  protected readonly researchCount = computed(
    () => this.outline().filter((row) => row.needsResearch).length,
  );

  protected readonly limits = computed(() => this.catalog()?.limits ?? { min: 3, max: 20 });

  protected readonly canConfirm = computed(() => {
    const count = this.outline().length;
    return (
      !this.isSaving() && count >= this.limits().min && count <= this.limits().max
    );
  });

  protected readonly isAtMax = computed(() => this.outline().length >= this.limits().max);

  constructor() {
    afterNextRender(() => {
      // Mesure groupée par image : la hauteur posée redimensionne la page, qui
      // relance l'observateur ; la valeur est alors identique et rien ne boucle.
      let frame = 0;
      const refit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => this.fitHeight.set(`${this.measureFitHeight()}px`));
      };
      refit();

      // La fenêtre, mais aussi ce qui s'insère au-dessus (barre du parcours
      // assisté) : les deux déplacent la place disponible.
      const observer = new ResizeObserver(refit);
      observer.observe(document.body);
      window.addEventListener('resize', refit);

      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener('resize', refit);
      });
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);

    forkJoin({
      catalog: this.businessPlanService.getStructureCatalog(),
      // Un projet qui n'a jamais choisi reçoit quand même une structure : on ne
      // traite donc pas le cas « aucune structure », seulement l'échec réseau.
      // Un plan existant reprend sa structure ; un nouveau plan part du modèle par défaut.
      current: this.documentId()
        ? this.businessPlanService
            .getStructure(this.projectId(), this.documentId())
            .pipe(catchError(() => of(null as BusinessPlanStructure | null)))
        : of(null as BusinessPlanStructure | null),
    }).subscribe({
      next: ({ catalog, current }) => {
        this.catalog.set(catalog);
        this.applyCurrent(catalog, current);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Reprend le choix déjà enregistré sur le projet. Un sommaire qui s'écarte de
   * son modèle ouvre directement le composeur : sinon l'utilisateur verrait le
   * sommaire du modèle et croirait avoir perdu ses modifications.
   */
  private applyCurrent(
    catalog: BusinessPlanStructureCatalog,
    current: BusinessPlanStructure | null,
  ): void {
    const template = current ? catalog.templates.find((t) => t.id === current.templateId) : undefined;
    const templateId = current?.templateId ?? catalog.defaultTemplateId;
    this.selectedTemplateId.set(templateId);

    if (!current) return;

    const diverges =
      !template ||
      current.sectionKeys.length !== template.sectionKeys.length ||
      current.sectionKeys.some((key, i) => key !== template.sectionKeys[i]);

    if (diverges && current.sectionKeys.length > 0) {
      this.customKeys.set([...current.sectionKeys]);
      this.isComposing.set(true);
    }
  }

  protected selectTemplate(id: string): void {
    if (id === this.selectedTemplateId()) return;
    this.saveError.set(null);
    this.isAddOpen.set(false);

    if (id === this.catalog()?.customTemplateId) {
      // Composer à partir de rien serait une page blanche. Le sommaire de
      // départ est celui qu'il regardait — capturé AVANT la bascule, car
      // « custom » n'a pas de sommaire propre à résoudre.
      const snapshot = [...this.workingKeys()];
      this.selectedTemplateId.set(id);
      this.customKeys.set(
        snapshot.length > 0 ? snapshot : [...(this.defaultTemplate()?.sectionKeys ?? [])],
      );
      this.isComposing.set(true);
      return;
    }

    // Changer de modèle abandonne le sommaire personnalisé : c'est ce que le
    // clic veut dire, et le bandeau « personnalisé » disparaît en même temps.
    this.selectedTemplateId.set(id);
    this.customKeys.set(null);
    this.isComposing.set(false);
  }

  /**
   * Répondre « à qui » filtre les modèles et sélectionne aussitôt le premier de
   * ce public : le sommaire de droite illustre la réponse sans second clic. Un
   * sommaire déjà retouché n'est jamais remplacé en silence — seul le clic sur
   * un modèle le fait. `all` retire le filtre sans toucher à la sélection.
   */
  protected setAudience(audience: BusinessPlanAudience | 'all'): void {
    const catalog = this.catalog();
    if (!catalog) return;

    this.audienceFilter.set(audience);
    // La liste vient de changer : on la reprend du haut plutôt qu'au milieu
    // d'une liste qui n'est plus la même.
    this.templateScroll()?.nativeElement.scrollTo({ top: 0 });
    if (audience === 'all') return;

    const keepsWork = this.isEdited() || this.selectedTemplateId() === catalog.customTemplateId;
    if (keepsWork || this.selectedTemplate()?.audience === audience) return;

    const first = catalog.templates.find((t) => t.audience === audience);
    if (!first) return;
    this.selectTemplate(first.id);
    this.announce('dashboard.businessPlanStructure.live.selected', {
      template: this.translate.instant(`dashboard.businessPlanStructure.templates.${first.id}.name`),
      count: first.sectionKeys.length,
    });
  }

  protected startComposing(): void {
    this.customKeys.set([...this.workingKeys()]);
    this.isComposing.set(true);
  }

  protected stopComposing(): void {
    this.isComposing.set(false);
    this.isAddOpen.set(false);
  }

  /** Revient au sommaire d'origine du modèle sélectionné. */
  protected resetOutline(): void {
    const template = this.selectedTemplate();
    if (!template) return;
    this.customKeys.set([...template.sectionKeys]);
    this.announce('dashboard.businessPlanStructure.live.reset', {});
  }

  protected moveSection(key: string, direction: -1 | 1): void {
    const keys = [...this.workingKeys()];
    const index = keys.indexOf(key);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= keys.length) return;

    [keys[index], keys[target]] = [keys[target], keys[index]];
    this.customKeys.set(keys);
    this.announce('dashboard.businessPlanStructure.live.moved', {
      section: this.labelOfKey(key),
      position: target + 1,
      total: keys.length,
    });
  }

  protected removeSection(key: string): void {
    const section = this.sectionsByKey().get(key);
    if (section?.required) return;

    const keys = this.workingKeys().filter((k) => k !== key);
    if (keys.length < this.limits().min) return;
    this.customKeys.set(keys);
    this.announce('dashboard.businessPlanStructure.live.removed', {
      section: this.labelOfKey(key),
    });
  }

  protected addSection(key: string): void {
    if (this.isAtMax()) return;
    const keys = this.workingKeys();
    if (keys.includes(key)) return;

    // Ajoutée avant les annexes quand elles existent : une section glissée
    // APRÈS l'annexe est la seule position qu'un lecteur trouve fautive.
    const appendixIndex = keys.indexOf('appendix');
    const next = [...keys];
    next.splice(appendixIndex === -1 ? next.length : appendixIndex, 0, key);

    this.customKeys.set(next);
    this.announce('dashboard.businessPlanStructure.live.added', {
      section: this.labelOfKey(key),
      position: (appendixIndex === -1 ? next.length : appendixIndex + 1),
      total: next.length,
    });
  }

  protected toggleAdd(): void {
    this.isAddOpen.update((open) => !open);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    const catalog = this.catalog();
    if (!catalog) return;

    this.isSaving.set(true);
    this.saveError.set(null);

    const templateId = this.selectedTemplateId() || catalog.defaultTemplateId;
    // Sommaire intact = on n'envoie que le modèle : le serveur reste alors la
    // référence de ce sommaire, y compris si le modèle évolue.
    const keys = this.customKeys() ?? undefined;

    const sectionNames = this.outline().map((row) => row.name);
    const documentId = this.documentId();

    // Un plan existant reçoit la structure. Sinon le plan naît ici, sur la
    // structure choisie, nommé d'après son modèle : on le renomme depuis la liste.
    const saved$ = documentId
      ? this.businessPlanService
          .saveStructure(this.projectId(), templateId, keys, documentId)
          .pipe(map((structure) => ({ structure, documentId })))
      : this.businessPlanService
          .createBusinessPlan(this.projectId(), {
            templateId,
            ...(keys ? { sectionKeys: keys } : {}),
            name: businessPlanVariantLabel(this.translate, templateId),
          })
          .pipe(
            map((plan) => ({
              structure: { templateId: plan.variant, sectionKeys: [...this.workingKeys()] },
              documentId: plan.id,
            })),
          );

    saved$.subscribe({
      next: ({ structure, documentId: savedId }) => {
        this.isSaving.set(false);
        this.structureConfirmed.emit({ structure, sectionNames, documentId: savedId });
      },
      error: () => {
        this.isSaving.set(false);
        this.saveError.set(
          this.translate.instant('dashboard.businessPlanStructure.errors.save'),
        );
      },
    });
  }

  /** Libellé traduit d'une section, à partir de son nom canonique backend. */
  private sectionLabel(name: string): string {
    const key = `dashboard.generationPanel.sections.businessPlan.${name}`;
    const label = this.translate.instant(key);
    // `instant` rend la clé quand la traduction manque : afficher le nom
    // canonique est plus lisible qu'un chemin de clé.
    return label === key ? name : label;
  }

  private labelOfKey(key: string): string {
    const section = this.sectionsByKey().get(key);
    return section ? this.sectionLabel(section.name) : key;
  }

  private templateById(id: string): BusinessPlanTemplate | undefined {
    return this.catalog()?.templates.find((t) => t.id === id);
  }

  private defaultTemplate(): BusinessPlanTemplate | undefined {
    const catalog = this.catalog();
    return catalog ? this.templateById(catalog.defaultTemplateId) : undefined;
  }

  /**
   * Place disponible pour l'écran : du bord haut du composant jusqu'au bas de
   * la fenêtre, moins les marges que les conteneurs du layout gardent SOUS lui.
   * Mesurée plutôt que codée en dur : la barre du parcours assisté n'existe que
   * dans ce mode, et les marges du layout changent avec la largeur.
   */
  private measureFitHeight(): number {
    const shell = this.shell().nativeElement;
    const top = shell.getBoundingClientRect().top + window.scrollY;
    let below = 0;
    for (let el = shell.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      below += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
    }
    return Math.floor(window.innerHeight - top - below);
  }

  private announce(key: string, params: Record<string, unknown>): void {
    this.liveMessage.set(this.translate.instant(key, params));
  }
}
