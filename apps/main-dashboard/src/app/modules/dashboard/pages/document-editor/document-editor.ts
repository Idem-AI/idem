import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TokenService } from '../../../../shared/services/token.service';
import { BusinessPlanEditorAdapter } from './adapters/business-plan-editor.adapter';
import { DocumentModelService } from './services/document-model.service';
import { EditorHistoryService } from './services/editor-history.service';
import {
  ChartConfigLite,
  DocumentTypeAdapter,
  EditorSelection,
  ElementStyle,
  FontHints,
  SaveState,
} from './models/editor.types';
import { EditorToolbarComponent } from './components/editor-toolbar/editor-toolbar';
import { LayersPanelComponent } from './components/layers-panel/layers-panel';
import { PropertyPanelComponent } from './components/property-panel/property-panel';
import { ChartEditorPanelComponent } from './components/chart-editor-panel/chart-editor-panel';
import { AiEditPanelComponent } from './components/ai-edit-panel/ai-edit-panel';
import {
  EditorCanvasComponent,
  ReorderEvent,
  TextChangeEvent,
} from './components/editor-canvas/editor-canvas';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const AUTOSAVE_DEBOUNCE = 1500;

/**
 * Shell de l'éditeur WYSIWYG. Orchestre le modèle (source de vérité), l'historique
 * (Ctrl+Z / Ctrl+Y), le canvas iframe et les panneaux. Applique les mutations,
 * déclenche la sauvegarde automatique (debounce) et l'édition IA par section.
 *
 * Le moteur est générique : le type de document est fourni par un
 * `DocumentTypeAdapter` (ici Business Plan). Modèle et historique sont fournis au
 * niveau du composant → état neuf à chaque ouverture.
 */
@Component({
  selector: 'app-document-editor',
  imports: [
    TranslateModule,
    EditorToolbarComponent,
    LayersPanelComponent,
    PropertyPanelComponent,
    ChartEditorPanelComponent,
    AiEditPanelComponent,
    EditorCanvasComponent,
  ],
  providers: [DocumentModelService, EditorHistoryService],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentEditorComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly renderer = inject(Renderer2);

  protected readonly model = inject(DocumentModelService);
  protected readonly history = inject(EditorHistoryService);

  /** Adaptateur du document en cours (Business Plan pour la phase 1). */
  private readonly adapter: DocumentTypeAdapter = inject(BusinessPlanEditorAdapter);

  private readonly canvas = viewChild(EditorCanvasComponent);
  private readonly aiPanel = viewChild(AiEditPanelComponent);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly title = signal('');
  protected readonly fonts = signal<FontHints>({});
  protected readonly dark = signal(false);
  protected readonly zoom = signal(0.85);
  protected readonly selection = signal<EditorSelection | null>(null);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly aiLoading = signal(false);

  protected readonly pageFormat = this.adapter.pageFormat;
  protected readonly titleKey = this.adapter.i18nTitleKey;

  protected readonly activeSectionId = computed(() => this.selection()?.sectionId ?? null);
  protected readonly selectedSectionName = computed(() => {
    const id = this.selection()?.sectionId;
    return this.model.sections().find((s) => s.id === id)?.name ?? '';
  });

  private projectId: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedResetTimer: ReturnType<typeof setTimeout> | null = null;
  private unlistenKeys?: () => void;
  private unlistenBeforeUnload?: () => void;

  async ngOnInit(): Promise<void> {
    this.dark.set(document.documentElement.classList.contains('dark'));
    this.unlistenKeys = this.renderer.listen('document', 'keydown', (e: KeyboardEvent) =>
      this.onKeydown(e),
    );
    this.unlistenBeforeUnload = this.renderer.listen('window', 'beforeunload', (e: BeforeUnloadEvent) => {
      if (this.saveState() === 'dirty' || this.saveState() === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    this.projectId = this.cookieService.get('projectId');
    if (!this.projectId) {
      this.loading.set(false);
      this.loadError.set('noProject');
      return;
    }

    await this.tokenService.waitForAuthReady();
    this.adapter.load(this.projectId).subscribe({
      next: (doc) => {
        this.title.set(doc.title);
        this.fonts.set(doc.fonts);
        this.model.setSections(doc.sections);
        this.history.reset();
        this.loading.set(false);
        // Le canvas est présent dès le premier rendu ; on lance le rendu initial.
        setTimeout(() => this.canvas()?.render(doc.sections), 0);
      },
      error: (err) => {
        console.error('Error loading document for editor:', err);
        this.loading.set(false);
        this.loadError.set('load');
      },
    });
  }

  ngOnDestroy(): void {
    this.unlistenKeys?.();
    this.unlistenBeforeUnload?.();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.savedResetTimer) clearTimeout(this.savedResetTimer);
  }

  /* ------------------------------------------------------------------ */
  /* Sélection                                                           */
  /* ------------------------------------------------------------------ */

  protected onSelectionChange(selection: EditorSelection | null): void {
    this.selection.set(selection);
  }

  protected onSelectSectionFromLayers(sectionId: string): void {
    this.canvas()?.selectPath(sectionId, '');
  }

  /* ------------------------------------------------------------------ */
  /* Mutations de contenu (patch en direct, pas de re-render)            */
  /* ------------------------------------------------------------------ */

  protected onStyleChange(style: ElementStyle): void {
    const sel = this.selection();
    if (!sel) return;
    this.record(`style-${sel.sectionId}-${sel.path}`);
    this.model.setStyle(sel.sectionId, sel.path, style);
    this.canvas()?.applyStyle(sel.sectionId, sel.path, style);
    this.markDirty();
  }

  protected onChartChange(config: ChartConfigLite): void {
    const sel = this.selection();
    if (!sel) return;
    this.record(`chart-${sel.sectionId}-${sel.path}`);
    this.model.setChart(sel.sectionId, sel.path, config);
    this.canvas()?.applyChart(sel.sectionId, sel.path, config);
    this.markDirty();
  }

  protected onTextChange(event: TextChangeEvent): void {
    this.record(`text-${event.sectionId}-${event.path}`);
    this.model.setText(event.sectionId, event.path, event.html);
    this.markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* Mutations structurelles (re-render du canvas)                       */
  /* ------------------------------------------------------------------ */

  protected onReorderRequest(event: ReorderEvent): void {
    this.record();
    this.model.reorder(event.sectionId, event.parentPath, event.fromIndex, event.toIndex);
    this.rerender();
    this.selection.set(null);
    this.markDirty();
  }

  protected onReorderButton(direction: 'up' | 'down'): void {
    const sel = this.selection();
    if (!sel) return;
    const parentPath = sel.path.includes('.') ? sel.path.split('.').slice(0, -1).join('.') : '';
    const toIndex = direction === 'up' ? sel.index - 1 : sel.index + 1;
    if (toIndex < 0 || toIndex > sel.siblingCount - 1) return;
    this.record();
    this.model.reorder(sel.sectionId, parentPath, sel.index, toIndex);
    this.rerender();
    this.selection.set(null);
    this.markDirty();
  }

  protected onRemove(): void {
    const sel = this.selection();
    if (!sel) return;
    this.record();
    this.model.removeNode(sel.sectionId, sel.path);
    this.rerender();
    this.selection.set(null);
    this.markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* Édition IA                                                          */
  /* ------------------------------------------------------------------ */

  protected onAiSubmit(instruction: string): void {
    const sel = this.selection();
    if (!sel || !this.projectId) return;
    this.aiLoading.set(true);
    this.adapter.aiEdit(this.projectId, sel.sectionId, instruction).subscribe({
      next: (res) => {
        this.aiLoading.set(false);
        if (!res.html) return;
        this.record();
        this.model.replaceSectionHtml(sel.sectionId, res.html);
        this.rerender();
        this.selection.set(null);
        this.aiPanel()?.reset();
        // L'édition IA est déjà persistée côté serveur ; on aligne l'état local.
        this.saveState.set('saved');
        this.scheduleSavedReset();
      },
      error: (err) => {
        console.error('AI edit failed:', err);
        this.aiLoading.set(false);
        this.saveState.set('error');
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Historique                                                          */
  /* ------------------------------------------------------------------ */

  protected undo(): void {
    const snapshot = this.history.undo(this.model.snapshot());
    if (!snapshot) return;
    this.model.setSections(snapshot);
    this.rerender();
    this.selection.set(null);
    this.markDirty();
  }

  protected redo(): void {
    const snapshot = this.history.redo(this.model.snapshot());
    if (!snapshot) return;
    this.model.setSections(snapshot);
    this.rerender();
    this.selection.set(null);
    this.markDirty();
  }

  /** Enregistre l'état AVANT mutation dans la pile d'annulation. */
  private record(coalesceKey?: string): void {
    this.history.record(this.model.snapshot(), coalesceKey);
  }

  private rerender(): void {
    this.canvas()?.render(this.model.sections(), true);
  }

  /* ------------------------------------------------------------------ */
  /* Zoom                                                                */
  /* ------------------------------------------------------------------ */

  protected zoomIn(): void {
    this.zoom.update((z) => Math.min(ZOOM_MAX, Math.round((z + 0.1) * 100) / 100));
  }

  protected zoomOut(): void {
    this.zoom.update((z) => Math.max(ZOOM_MIN, Math.round((z - 0.1) * 100) / 100));
  }

  /* ------------------------------------------------------------------ */
  /* Sauvegarde                                                          */
  /* ------------------------------------------------------------------ */

  private markDirty(): void {
    this.saveState.set('dirty');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.doSave(), AUTOSAVE_DEBOUNCE);
  }

  protected saveNow(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.doSave();
  }

  private doSave(): void {
    if (!this.projectId) return;
    if (this.saveState() === 'saving') return;
    this.saveState.set('saving');
    this.adapter.save(this.projectId, this.model.snapshot()).subscribe({
      next: () => {
        this.saveState.set('saved');
        this.scheduleSavedReset();
      },
      error: (err) => {
        console.error('Save failed:', err);
        this.saveState.set('error');
      },
    });
  }

  private scheduleSavedReset(): void {
    if (this.savedResetTimer) clearTimeout(this.savedResetTimer);
    this.savedResetTimer = setTimeout(() => {
      if (this.saveState() === 'saved') this.saveState.set('idle');
    }, 2500);
  }

  /* ------------------------------------------------------------------ */
  /* Clavier + sortie                                                    */
  /* ------------------------------------------------------------------ */

  private onKeydown(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      this.redo();
    } else if (key === 's') {
      e.preventDefault();
      this.saveNow();
    }
  }

  protected exit(): void {
    if (this.saveState() === 'dirty') this.saveNow();
    this.router.navigate([this.adapter.backRoute]);
  }
}
