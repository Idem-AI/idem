import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { LegalDocsService } from '../../services/ai-agents/legal-docs.service';
import {
  LegalDocsContext,
  LegalDocsModel,
  LegalDocumentCatalogEntry,
  LegalDocumentModel,
  LegalDocumentType,
} from '../../models/legalDocs.model';
import { SSEStepEvent } from '../../../../shared/models/sse-step.model';

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

@Component({
  selector: 'app-legal-docs',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, Loader],
  templateUrl: './legal-docs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocsPage implements OnInit {
  private readonly legalDocsService = inject(LegalDocsService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly catalog = signal<LegalDocumentCatalogEntry[]>([]);
  protected readonly selected = signal<Set<LegalDocumentType>>(new Set());
  protected readonly legalDocs = signal<LegalDocsModel | null>(null);
  protected readonly isGenerating = signal(false);
  protected readonly stepStatuses = signal<Record<string, 'pending' | 'in-progress' | 'completed'>>({});
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly context = signal<LegalDocsContext>({
    country: '',
    legalForm: '',
    capital: '',
    currency: 'XAF',
    headOffice: '',
    companyEmail: '',
    companyPhone: '',
    website: '',
    activityDescription: '',
    founders: [],
  });

  protected readonly requiredFields = computed<RequiredFieldKey[]>(() => {
    const s = this.selected();
    const req = new Set<RequiredFieldKey>();
    this.catalog().forEach((entry) => {
      if (s.has(entry.type)) {
        entry.requiredFields.forEach((f) => req.add(f as RequiredFieldKey));
      }
    });
    return Array.from(req);
  });

  protected readonly missingRequiredFields = computed<RequiredFieldKey[]>(() => {
    const ctx = this.context();
    return this.requiredFields().filter((key) => {
      if (key === 'founders') return !ctx.founders || ctx.founders.length === 0;
      const v = (ctx as Record<string, unknown>)[key];
      return !v || (typeof v === 'string' && !v.trim());
    });
  });

  protected readonly canGenerate = computed(
    () => this.selected().size > 0 && this.missingRequiredFields().length === 0,
  );

  protected readonly groupedCatalog = computed(() => {
    const entries = this.catalog();
    const groups: Record<string, LegalDocumentCatalogEntry[]> = {
      company: [],
      contracts: [],
      customers: [],
      internal: [],
    };
    entries.forEach((e) => {
      (groups[e.group] || (groups[e.group] = [])).push(e);
    });
    return groups;
  });

  ngOnInit(): void {
    const pid = this.cookieService.get('projectId');
    this.projectId.set(pid);
    if (!pid) {
      this.isLoading.set(false);
      return;
    }
    this.loadInitialData(pid);
  }

  private loadInitialData(projectId: string): void {
    this.isLoading.set(true);
    this.legalDocsService
      .getCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalog }) => {
          this.catalog.set(catalog);
          this.legalDocsService
            .getLegalDocs(projectId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (docs) => {
                this.legalDocs.set(docs);
                if (docs?.context) this.context.set({ ...this.context(), ...docs.context });
                this.isLoading.set(false);
              },
              error: () => this.isLoading.set(false),
            });
        },
        error: (err) => {
          console.error('Error loading legal docs catalog:', err);
          this.errorMessage.set(
            this.translate.instant('dashboard.legalDocs.errors.catalog'),
          );
          this.isLoading.set(false);
        },
      });
  }

  protected toggleType(type: LegalDocumentType): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  protected isSelected(type: LegalDocumentType): boolean {
    return this.selected().has(type);
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
      founders: [...(ctx.founders || []), { name: '', role: '', shares: '' }],
    }));
  }

  protected updateFounder(index: number, field: 'name' | 'role' | 'shares', value: string): void {
    this.context.update((ctx) => {
      const founders = [...(ctx.founders || [])];
      founders[index] = { ...founders[index], [field]: value };
      return { ...ctx, founders };
    });
  }

  protected removeFounder(index: number): void {
    this.context.update((ctx) => ({
      ...ctx,
      founders: (ctx.founders || []).filter((_, i) => i !== index),
    }));
  }

  protected generate(): void {
    const pid = this.projectId();
    if (!pid || !this.canGenerate()) return;
    this.errorMessage.set(null);
    this.isGenerating.set(true);
    const selectedTypes = Array.from(this.selected());
    const initialStatuses: Record<string, 'pending' | 'in-progress' | 'completed'> = {};
    selectedTypes.forEach((t) => (initialStatuses[t] = 'pending'));
    this.stepStatuses.set(initialStatuses);

    this.legalDocsService
      .generate(pid, selectedTypes, this.context())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: SSEStepEvent) => this.handleSseEvent(event),
        error: (err) => {
          console.error('Legal docs generation error:', err);
          this.errorMessage.set(
            this.translate.instant('dashboard.legalDocs.errors.generation'),
          );
          this.isGenerating.set(false);
        },
        complete: () => {
          this.isGenerating.set(false);
          this.legalDocsService
            .getLegalDocs(pid)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (docs) => this.legalDocs.set(docs),
            });
        },
      });
  }

  private handleSseEvent(event: SSEStepEvent): void {
    if (!event?.parsedData) return;
    const status = event.parsedData.status;
    if (status === 'progress') {
      const inProgress = event.parsedData.stepsInProgress || [];
      const completed = event.parsedData.completedSteps || [];
      this.stepStatuses.update((s) => {
        const next = { ...s };
        Object.keys(next).forEach((k) => {
          if (completed.includes(k)) next[k] = 'completed';
          else if (inProgress.includes(k)) next[k] = 'in-progress';
        });
        return next;
      });
    } else if (status === 'completed' && event.parsedData.stepName) {
      const name = event.parsedData.stepName;
      this.stepStatuses.update((s) => ({ ...s, [name]: 'completed' }));
    }
  }

  protected cancel(): void {
    this.legalDocsService.cancelGeneration();
    this.isGenerating.set(false);
  }

  protected downloadDocument(doc: LegalDocumentModel): void {
    const pid = this.projectId();
    if (!pid || !doc.id) return;
    this.legalDocsService
      .downloadDocumentPdf(pid, doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${doc.type}-${doc.id}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (err) => {
          console.error('Error downloading legal doc PDF:', err);
        },
      });
  }

  protected deleteDocument(doc: LegalDocumentModel): void {
    const pid = this.projectId();
    if (!pid || !doc.id) return;
    this.legalDocsService
      .deleteDocument(pid, doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.legalDocs.set(updated),
      });
  }

  protected entryName(entry: LegalDocumentCatalogEntry): string {
    const lang = this.translate.currentLang || 'fr';
    return lang.startsWith('fr') ? entry.nameFr : entry.nameEn;
  }

  protected entryDescription(entry: LegalDocumentCatalogEntry): string {
    const lang = this.translate.currentLang || 'fr';
    return lang.startsWith('fr') ? entry.descriptionFr : entry.descriptionEn;
  }

  protected findEntry(type: LegalDocumentType): LegalDocumentCatalogEntry | undefined {
    return this.catalog().find((e) => e.type === type);
  }
}
