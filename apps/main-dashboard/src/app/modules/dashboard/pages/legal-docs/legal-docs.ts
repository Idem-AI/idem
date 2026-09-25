import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CookieService } from '../../../../shared/services/cookie.service';
import { LegalDocsService } from '../../services/ai-agents/legal-docs.service';
import {
  LegalDocPriority,
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentCatalogEntry,
  LegalDocumentModel,
  LegalDocumentType,
  LegalFormCode,
  LegalFormEntry,
  LegalReason,
  LegalRecommendations,
} from '../../models/legalDocs.model';
import { SSEStepEvent } from '../../../../shared/models/sse-step.model';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { ProjectService } from '../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { LegalIllustrationComponent } from './components/legal-illustration/legal-illustration';
import { LegalFormSectionComponent } from './components/legal-form-section/legal-form-section';

type RequiredFieldKey =
  | 'country'
  | 'legalForm'
  | 'capital'
  | 'currency'
  | 'headOffice'
  | 'founders'
  | 'companyEmail'
  | 'companyPhone'
  | 'website'
  | 'activityDescription';

type View = 'overview' | 'details' | 'generating';
type StepStatus = 'pending' | 'in-progress' | 'completed';

/** Une ligne de la liste des documents : recommandation + état réel. */
interface DocRow {
  type: LegalDocumentType;
  priority: LegalDocPriority;
  reason: LegalReason;
  entry?: LegalDocumentCatalogEntry;
  /** Document déjà rédigé pour ce type */
  doc?: LegalDocumentModel;
  /** Statuts rédigés pour une autre forme que celle retenue */
  outdated: boolean;
  /** Statuts demandés alors qu'aucune forme n'est retenue */
  needsForm: boolean;
}

const ICONS: Record<string, string> = {
  statuts: 'pi pi-building',
  pacte_associes: 'pi pi-users',
  cgu: 'pi pi-file',
  cgv: 'pi pi-shopping-cart',
  privacy_policy: 'pi pi-shield',
  legal_mentions: 'pi pi-info-circle',
  nda: 'pi pi-lock',
  employment_contract: 'pi pi-id-card',
  service_contract: 'pi pi-briefcase',
  internal_regulations: 'pi pi-book',
};

/** Devises proposées ; celle du projet s'y ajoute si elle manque. */
const CURRENCIES = ['XAF', 'XOF', 'CDF', 'GNF', 'KMF', 'NGN', 'GHS', 'KES', 'RWF', 'UGX', 'TZS', 'ZAR', 'MAD', 'USD', 'EUR'];

const LEGACY_STATUTES: Record<string, LegalFormCode> = { statuts_sarl: 'sarl', statuts_sas: 'sas' };
const isStatutes = (type: string): boolean => type === 'statuts' || type in LEGACY_STATUTES;

/**
 * Espace juridique d'un projet.
 *
 * Le parcours tient en trois temps : choisir UNE forme d'entreprise (avec une
 * recommandation expliquée), cocher les documents (pré-cochés selon le
 * projet), vérifier les informations pré-remplies, puis générer.
 */
@Component({
  selector: 'app-legal-docs',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslateModule,
    IncompleteProjectBannerComponent,
    IdemLoaderComponent,
    LegalIllustrationComponent,
    LegalFormSectionComponent,
  ],
  templateUrl: './legal-docs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocsPage implements OnInit {
  private readonly legalDocsService = inject(LegalDocsService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly projectService = inject(ProjectService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isBrandingComplete = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly catalog = signal<LegalDocumentCatalogEntry[]>([]);
  protected readonly forms = signal<LegalFormEntry[]>([]);
  protected readonly recommendations = signal<LegalRecommendations | null>(null);
  protected readonly legalDocs = signal<LegalDocsModel | null>(null);
  protected readonly context = signal<LegalDocsContext>({ founders: [] });

  protected readonly view = signal<View>('overview');
  protected readonly selected = signal<ReadonlySet<LegalDocumentType>>(new Set());
  protected readonly savingForm = signal(false);
  protected readonly downloading = signal<string | null>(null);
  protected readonly stepStatuses = signal<Record<string, StepStatus>>({});
  protected readonly lastGenerated = signal(0);

  protected readonly lang = signal<'fr' | 'en'>(this.currentLang());

  // ─────────────────────────────────────────────── État dérivé

  protected readonly jurisdictionForms = computed(() => {
    const jurisdiction = this.recommendations()?.jurisdiction ?? 'ohada';
    return this.forms().filter((f) => f.jurisdictions.includes(jurisdiction));
  });

  protected readonly chosenForm = computed<LegalFormEntry | null>(() => {
    const code = this.context().legalForm;
    return this.forms().find((f) => f.code === code) ?? null;
  });

  protected readonly statutesForm = computed<LegalFormCode | null>(() => {
    const doc = this.legalDocs()?.documents.find((d) => isStatutes(d.type));
    if (!doc) return null;
    return doc.legalForm ?? LEGACY_STATUTES[doc.type] ?? null;
  });

  protected readonly rows = computed<DocRow[]>(() => {
    const reco = this.recommendations();
    if (!reco) return [];
    const docs = this.legalDocs()?.documents ?? [];
    const chosen = this.chosenForm()?.code ?? null;
    const statutesForm = this.statutesForm();
    return reco.documents.map((r) => {
      const statutes = r.type === 'statuts';
      const doc = docs.find((d) => (statutes ? isStatutes(d.type) : d.type === r.type));
      return {
        ...r,
        entry: this.catalog().find((e) => e.type === r.type),
        doc,
        outdated: statutes && !!doc && !!chosen && statutesForm !== chosen,
        needsForm: statutes && !chosen,
      };
    });
  });

  protected readonly groups = computed(() => {
    const rows = this.rows();
    return [
      { key: 'essential', rows: rows.filter((r) => r.priority === 'essential') },
      { key: 'recommended', rows: rows.filter((r) => r.priority === 'recommended') },
      {
        key: 'later',
        rows: rows.filter((r) => r.priority === 'optional' || r.priority === 'not_applicable'),
      },
    ].filter((g) => g.rows.length > 0);
  });

  protected readonly essentialProgress = computed(() => {
    const essentials = this.rows().filter((r) => r.priority === 'essential');
    return {
      done: essentials.filter((r) => r.doc && !r.outdated).length,
      total: essentials.length,
    };
  });

  protected readonly requiredFields = computed<RequiredFieldKey[]>(() => {
    const req = new Set<RequiredFieldKey>();
    const selected = this.selected();
    this.catalog()
      .filter((e) => selected.has(e.type))
      .forEach((e) => e.requiredFields.forEach((f) => req.add(f as RequiredFieldKey)));
    // La forme se choisit plus haut, pas dans le formulaire.
    req.delete('legalForm');
    return Array.from(req);
  });

  protected readonly missingFields = computed<RequiredFieldKey[]>(() => {
    const ctx = this.context();
    return this.requiredFields().filter((key) => {
      if (key === 'founders') return !(ctx.founders ?? []).some((f) => f.name?.trim());
      const v = (ctx as Record<string, unknown>)[key];
      return !v || (typeof v === 'string' && !v.trim());
    });
  });

  protected readonly singlePartner = computed(() => this.chosenForm()?.partners === 'single');

  protected readonly canGenerate = computed(
    () => this.selected().size > 0 && this.missingFields().length === 0,
  );

  protected readonly selectedNames = computed(() =>
    this.rows()
      .filter((r) => this.selected().has(r.type))
      .map((r) => this.docName(r)),
  );

  protected readonly currencyOptions = computed(() => {
    const current = this.context().currency;
    return current && !CURRENCIES.includes(current) ? [current, ...CURRENCIES] : CURRENCIES;
  });

  protected readonly generationList = computed(() =>
    Object.entries(this.stepStatuses()).map(([type, status]) => {
      const row = this.rows().find((r) => r.type === type);
      return { type, status, name: row ? this.docName(row) : type };
    }),
  );

  // ─────────────────────────────────────────────── Chargement

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.lang.set(this.currentLang()));

    const pid = this.cookieService.get('projectId');
    this.projectId.set(pid);
    if (!pid) {
      this.isLoading.set(false);
      return;
    }
    this.projectService
      .getProjectById(pid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.project.set(project);
          const { isComplete } = this.brandingValidation.checkBrandingCompletion(project);
          this.isBrandingComplete.set(isComplete);
          if (isComplete) this.loadAll(pid, true);
          else this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error checking branding completion:', error);
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.load'));
          this.isLoading.set(false);
        },
      });
  }

  private loadAll(projectId: string, preselect: boolean): void {
    forkJoin({
      catalog: this.legalDocsService.getCatalog(),
      docs: this.legalDocsService.getLegalDocs(projectId),
      reco: this.legalDocsService.getRecommendations(projectId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalog, docs, reco }) => {
          this.catalog.set(catalog.catalog);
          this.forms.set(catalog.forms ?? []);
          this.legalDocs.set(docs);
          this.recommendations.set(reco);
          this.context.set({ ...reco.prefill, founders: reco.prefill.founders ?? [] });
          if (preselect) this.selectRecommended();
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading legal space:', err);
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.load'));
          this.isLoading.set(false);
        },
      });
  }

  // ─────────────────────────────────────────────── Forme juridique

  protected chooseForm(code: LegalFormCode): void {
    const pid = this.projectId();
    if (!pid) return;
    this.savingForm.set(true);
    this.errorMessage.set(null);
    this.notice.set(null);
    const context = { ...this.context(), legalForm: code };
    this.legalDocsService
      .saveContext(pid, context)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reco) => {
          this.recommendations.set(reco);
          this.context.set(context);
          this.savingForm.set(false);
          // Les documents devenus sans objet sortent de la sélection ; les statuts
          // y entrent s'ils manquent ou ne correspondent plus à la forme.
          const inapplicable = new Set(
            reco.documents.filter((d) => d.priority === 'not_applicable').map((d) => d.type),
          );
          const statutes = this.rows().find((r) => r.type === 'statuts');
          this.selected.update((set) => {
            const next = new Set([...set].filter((t) => !inapplicable.has(t)));
            if (statutes && !inapplicable.has('statuts') && (!statutes.doc || statutes.outdated)) {
              next.add('statuts');
            }
            return next;
          });
        },
        error: (err) => {
          console.error('Error saving legal form:', err);
          this.savingForm.set(false);
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.saveForm'));
        },
      });
  }

  // ─────────────────────────────────────────────── Sélection

  /** Coche l'essentiel et le recommandé qui ne sont pas encore rédigés. */
  protected selectRecommended(): void {
    const next = new Set<LegalDocumentType>();
    for (const row of this.rows()) {
      const wanted = row.priority === 'essential' || row.priority === 'recommended';
      if (wanted && !row.needsForm && (!row.doc || row.outdated)) next.add(row.type);
    }
    this.selected.set(next);
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected toggle(row: DocRow): void {
    if (row.priority === 'not_applicable') return;
    if (row.needsForm) {
      this.notice.set(this.translate.instant('dashboard.legalDocs.docs.chooseFormFirst'));
      document
        .getElementById('legal-form-anchor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    this.notice.set(null);
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(row.type)) next.delete(row.type);
      else next.add(row.type);
      return next;
    });
  }

  protected isSelected(type: LegalDocumentType): boolean {
    return this.selected().has(type);
  }

  // ─────────────────────────────────────────────── Étape « informations »

  protected goToDetails(): void {
    if (this.selected().size === 0) return;
    this.lastGenerated.set(0);
    this.view.set('details');
    this.scrollTop();
  }

  protected backToOverview(): void {
    this.view.set('overview');
    this.scrollTop();
  }

  protected updateContext<K extends keyof LegalDocsContext>(
    key: K,
    value: LegalDocsContext[K],
  ): void {
    this.context.update((ctx) => ({ ...ctx, [key]: value }));
  }

  protected addFounder(): void {
    this.context.update((ctx) => ({
      ...ctx,
      founders: [...(ctx.founders ?? []), { name: '', role: '', shares: '' }],
    }));
  }

  protected updateFounder(index: number, field: 'name' | 'role' | 'shares', value: string): void {
    this.context.update((ctx) => {
      const founders = [...(ctx.founders ?? [])];
      founders[index] = { ...founders[index], [field]: value };
      return { ...ctx, founders };
    });
  }

  protected removeFounder(index: number): void {
    this.context.update((ctx) => ({
      ...ctx,
      founders: (ctx.founders ?? []).filter((_, i) => i !== index),
    }));
  }

  protected needs(key: RequiredFieldKey): boolean {
    return this.requiredFields().includes(key);
  }

  protected isMissing(key: RequiredFieldKey): boolean {
    return this.missingFields().includes(key);
  }

  // ─────────────────────────────────────────────── Génération

  protected generate(): void {
    const pid = this.projectId();
    if (!pid || !this.canGenerate()) return;
    this.errorMessage.set(null);
    this.notice.set(null);
    const types = this.rows()
      .map((r) => r.type)
      .filter((t) => this.selected().has(t));
    this.stepStatuses.set(Object.fromEntries(types.map((t) => [t, 'pending' as StepStatus])));
    this.view.set('generating');
    this.scrollTop();

    this.legalDocsService
      .generate(pid, types, this.context())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: SSEStepEvent) => this.handleSseEvent(event),
        error: (err) => {
          console.error('Legal docs generation error:', err);
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.generation'));
          this.view.set('details');
        },
        complete: () => {
          const done = Object.values(this.stepStatuses()).filter((s) => s === 'completed').length;
          this.lastGenerated.set(done || types.length);
          this.selected.set(new Set());
          this.view.set('overview');
          this.loadAll(pid, false);
          this.scrollTop();
        },
      });
  }

  private handleSseEvent(event: SSEStepEvent): void {
    const data = event?.parsedData;
    if (!data) return;
    if (data.status === 'progress') {
      const inProgress = data.stepsInProgress ?? [];
      const completed = data.completedSteps ?? [];
      this.stepStatuses.update((s) => {
        const next = { ...s };
        Object.keys(next).forEach((k) => {
          if (completed.includes(k)) next[k] = 'completed';
          else if (inProgress.includes(k)) next[k] = 'in-progress';
        });
        return next;
      });
    } else if (data.status === 'completed' && data.stepName) {
      const name = data.stepName;
      this.stepStatuses.update((s) => ({ ...s, [name]: 'completed' }));
    }
  }

  protected cancel(): void {
    this.legalDocsService.cancelGeneration();
    this.view.set('details');
  }

  // ─────────────────────────────────────────────── Documents rédigés

  protected download(doc: LegalDocumentModel): void {
    const pid = this.projectId();
    if (!pid || !doc.id) return;
    this.downloading.set(doc.id);
    this.legalDocsService
      .downloadDocumentPdf(pid, doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${doc.name}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.downloading.set(null);
        },
        error: (err) => {
          console.error('Error downloading legal doc PDF:', err);
          this.downloading.set(null);
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.download'));
        },
      });
  }

  protected remove(doc: LegalDocumentModel): void {
    const pid = this.projectId();
    if (!pid || !doc.id) return;
    const ok = window.confirm(
      this.translate.instant('dashboard.legalDocs.docs.confirmDelete', { name: doc.name }),
    );
    if (!ok) return;
    this.legalDocsService
      .deleteDocument(pid, doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.legalDocs.set(updated),
        error: () =>
          this.errorMessage.set(this.translate.instant('dashboard.legalDocs.errors.delete')),
      });
  }

  // ─────────────────────────────────────────────── Libellés

  protected docName(row: DocRow): string {
    if (row.type === 'statuts') {
      const form = this.chosenForm();
      const base = this.translate.instant('dashboard.legalDocs.docs.statutes');
      return form?.hasStatutes ? `${base} ${form.acronym}` : base;
    }
    if (!row.entry) return row.type;
    return this.lang() === 'en' ? row.entry.nameEn : row.entry.nameFr;
  }

  protected docDescription(row: DocRow): string {
    if (!row.entry) return '';
    return this.lang() === 'en' ? row.entry.descriptionEn : row.entry.descriptionFr;
  }

  protected reasonText(reason: LegalReason): string {
    return this.lang() === 'en' ? reason.en : reason.fr;
  }

  protected rowClass(row: DocRow): string {
    if (row.priority === 'not_applicable') return 'opacity-60';
    return this.isSelected(row.type) ? 'bg-[var(--glass-bg-light)]' : 'hover:bg-[var(--glass-bg-subtle)]';
  }

  protected icon(type: string): string {
    return ICONS[type] ?? 'pi pi-file';
  }

  private currentLang(): 'fr' | 'en' {
    const lang = this.translate.currentLang || this.translate.getDefaultLang() || 'fr';
    return lang.startsWith('en') ? 'en' : 'fr';
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
