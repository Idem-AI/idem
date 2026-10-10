import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { EditorTranslatePipe } from '../i18n/editor-translate.pipe';
import { DocumentModelService } from '../services/document-model.service';
import { EditorHistoryService } from '../services/editor-history.service';
import {
  ChartConfigLite,
  DocumentTypeAdapter,
  EditorSelection,
  ElementStyle,
  FontHints,
  PageFormat,
  SaveState,
} from '../models/editor.types';
import { EditorToolbarComponent } from '../components/editor-toolbar/editor-toolbar';
import { LayersPanelComponent } from '../components/layers-panel/layers-panel';
import { PropertyPanelComponent } from '../components/property-panel/property-panel';
import { ChartEditorPanelComponent } from '../components/chart-editor-panel/chart-editor-panel';
import { AttributesPanelComponent } from '../components/attributes-panel/attributes-panel';
import { AiEditPanelComponent } from '../components/ai-edit-panel/ai-edit-panel';
import {
  EditorCanvasComponent,
  ReorderEvent,
  StyleChangeEvent,
  TextChangeEvent,
} from '../components/editor-canvas/editor-canvas';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

const AUTOSAVE_DEBOUNCE = 1500;

/** En dessous : pages en tiroir, inspecteur en panneau bas (cf. document-editor.css). */
const COMPACT_QUERY = '(max-width: 1023px)';
/** À partir de là, le panneau des pages est ouvert d'office. */
const WIDE_QUERY = '(min-width: 1280px)';

/**
 * L'ÉDITEUR WYSIWYG PARTAGÉ (IDEM, iVision). Orchestre le modèle (source de vérité),
 * l'historique (Ctrl+Z / Ctrl+Y), le canvas iframe et les panneaux. Applique les mutations,
 * déclenche la sauvegarde automatique (debounce) et l'édition IA par section.
 *
 * Le moteur ne connaît ni route, ni projet, ni serveur : l'hôte lui donne un
 * `DocumentTypeAdapter` (charger, enregistrer, retouche IA), l'identifiant de son contexte
 * (projet IDEM, marque iVision…), le document, la cible éventuelle (élément cliqué dans
 * l'aperçu) et le titre ; il écoute `exit`. Modèle et historique sont fournis au niveau du
 * composant → état neuf à chaque ouverture.
 */
@Component({
  selector: 'idem-document-editor',
  imports: [
    EditorTranslatePipe,
    EditorToolbarComponent,
    LayersPanelComponent,
    PropertyPanelComponent,
    ChartEditorPanelComponent,
    AttributesPanelComponent,
    AiEditPanelComponent,
    EditorCanvasComponent,
    IdemLoaderComponent,
  ],
  providers: [DocumentModelService, EditorHistoryService],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdemDocumentEditorComponent implements OnInit, OnDestroy {
  private readonly renderer = inject(Renderer2);

  protected readonly model = inject(DocumentModelService);
  protected readonly history = inject(EditorHistoryService);

  /** Ce qui charge, enregistre et retouche le document (propre à chaque appli). */
  readonly adapter = input.required<DocumentTypeAdapter>();
  /** Le contexte du document chez l'hôte : projet IDEM, marque iVision… */
  readonly contextId = input.required<string>();
  /** Le document, quand le contexte en garde plusieurs. */
  readonly documentId = input<string | null>(null);
  /** L'élément (ou la page) à montrer à l'ouverture : celui cliqué dans l'aperçu. */
  readonly target = input<{ sectionId: string; path: string | null } | null>(null);
  /** Titre affiché tant que le document n'a pas donné le sien (déjà traduit par l'hôte). */
  readonly heading = input<string>('');
  /** L'utilisateur quitte l'éditeur (après un dernier enregistrement s'il en restait). */
  readonly exit = output<void>();

  protected readonly canvas = viewChild(EditorCanvasComponent);
  private readonly aiPanel = viewChild(AiEditPanelComponent);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly title = signal('');
  protected readonly fonts = signal<FontHints>({});
  protected readonly dark = signal(false);
  protected readonly layersOpen = signal(this.matches(WIDE_QUERY));
  protected readonly selection = signal<EditorSelection | null>(null);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly aiLoading = signal(false);

  /**
   * Format déclaré par l'adaptateur, remplacé au chargement quand le document
   * ne le connaît qu'à l'exécution (un visuel est carré, story ou bannière
   * selon le flyer ouvert).
   */
  protected readonly pageFormat = signal<PageFormat>({ width: '1080px', height: '1080px' });
  protected readonly multiPage = computed(() => this.adapter().multiPage);
  protected readonly fitRoot = computed(() => this.adapter().fitRoot ?? false);
  /** La retouche IA n'existe que si l'adaptateur la fournit (pas pour les visuels d'iVision). */
  protected readonly aiEnabled = computed(() => typeof this.adapter().aiEdit === 'function');

  protected readonly activeSectionId = computed(() => this.selection()?.sectionId ?? null);
  protected readonly selectedSectionName = computed(() => {
    const id = this.selection()?.sectionId;
    return this.model.sections().find((s) => s.id === id)?.name ?? '';
  });

  /** Élément ou page à montrer au premier rendu (lien profond depuis l'aperçu). */
  private pendingTarget: { sectionId: string; path: string | null } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedResetTimer: ReturnType<typeof setTimeout> | null = null;
  private unlistenKeys?: () => void;
  private unlistenBeforeUnload?: () => void;

  ngOnInit(): void {
    this.pageFormat.set(this.adapter().pageFormat);
    this.dark.set(document.documentElement.classList.contains('dark'));
    this.unlistenKeys = this.renderer.listen('document', 'keydown', (e: KeyboardEvent) =>
      this.onKeydown(e),
    );
    this.unlistenBeforeUnload = this.renderer.listen(
      'window',
      'beforeunload',
      (e: BeforeUnloadEvent) => {
        if (this.saveState() === 'dirty' || this.saveState() === 'saving') {
          e.preventDefault();
          e.returnValue = '';
        }
      },
    );

    this.pendingTarget = this.target();
    this.adapter().load(this.contextId(), this.documentId()).subscribe({
      next: (doc) => {
        this.title.set(doc.title);
        this.fonts.set(doc.fonts);
        if (doc.pageFormat) this.pageFormat.set(doc.pageFormat);
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
    if (this.matches(COMPACT_QUERY)) this.layersOpen.set(false);
  }

  /** Désélectionne (et referme le panneau bas sur petit écran). */
  protected closeInspector(): void {
    this.canvas()?.clearSelection();
    this.selection.set(null);
  }

  /** Premier rendu prêt : applique le lien profond, une seule fois. */
  protected onCanvasReady(): void {
    const target = this.pendingTarget;
    if (!target) return;
    this.pendingTarget = null;
    if (!this.model.sections().some((s) => s.id === target.sectionId)) return;
    if (target.path !== null) this.canvas()?.selectPath(target.sectionId, target.path, false);
    else this.canvas()?.scrollToSection(target.sectionId, false);
  }

  private matches(query: string): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
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

  /**
   * Le déplacement libre est déjà visible dans l'iframe. On persiste seulement
   * son état final ici, sans reconstruire le canevas sous le pointeur.
   */
  protected onCanvasStyleChange(event: StyleChangeEvent): void {
    this.record(`style-${event.sectionId}-${event.path}`);
    this.model.setStyle(event.sectionId, event.path, event.style);
    this.markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* Mutations structurelles (re-render du canvas)                       */
  /* ------------------------------------------------------------------ */

  protected onReorderRequest(event: ReorderEvent): void {
    // Le déplacement DOM a déjà eu lieu dans l'iframe (live, façon Figma) ; on
    // aligne seulement le modèle, sans re-render. Le runtime re-sélectionne
    // l'élément et renvoie sa nouvelle sélection.
    this.record();
    this.model.reorder(event.sectionId, event.parentPath, event.fromIndex, event.toIndex);
    this.markDirty();
  }

  protected onReorderButton(direction: 'up' | 'down'): void {
    const sel = this.selection();
    if (!sel) return;
    const parentPath = sel.path.includes('.') ? sel.path.split('.').slice(0, -1).join('.') : '';
    const toIndex = direction === 'up' ? sel.index - 1 : sel.index + 1;
    if (toIndex < 0 || toIndex > sel.siblingCount - 1) return;
    this.record();
    this.canvas()?.moveNode(sel.sectionId, sel.path, toIndex); // déplacement live + re-sélection
    this.model.reorder(sel.sectionId, parentPath, sel.index, toIndex);
    this.markDirty();
  }

  protected onRemove(): void {
    const sel = this.selection();
    if (!sel) return;
    this.record();
    this.canvas()?.removeNodeLive(sel.sectionId, sel.path); // suppression live + deselect
    this.model.removeNode(sel.sectionId, sel.path);
    this.selection.set(null);
    this.markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* Attributs génériques (tout paramètre présent dans le code)          */
  /* ------------------------------------------------------------------ */

  protected onAttrChange(change: { name: string; value: string }): void {
    const sel = this.selection();
    if (!sel) return;
    this.record(`attr-${sel.sectionId}-${sel.path}-${change.name}`);
    this.model.setAttribute(sel.sectionId, sel.path, change.name, change.value);
    this.canvas()?.applyAttr(sel.sectionId, sel.path, change.name, change.value);
    this.markDirty();
  }

  protected onAttrAdd(change: { name: string; value: string }): void {
    const sel = this.selection();
    if (!sel || !change.name) return;
    this.record();
    this.model.setAttribute(sel.sectionId, sel.path, change.name, change.value);
    this.canvas()?.applyAttr(sel.sectionId, sel.path, change.name, change.value);
    this.markDirty();
  }

  protected onAttrRemove(name: string): void {
    const sel = this.selection();
    if (!sel) return;
    this.record();
    this.model.removeAttribute(sel.sectionId, sel.path, name);
    this.canvas()?.applyAttr(sel.sectionId, sel.path, name, null);
    this.markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* Édition IA                                                          */
  /* ------------------------------------------------------------------ */

  protected onAiSubmit(instruction: string): void {
    const sel = this.selection();
    const aiEdit = this.adapter().aiEdit?.bind(this.adapter());
    if (!sel || !aiEdit) return;
    this.aiLoading.set(true);
    aiEdit(this.contextId(), sel.sectionId, instruction, this.documentId()).subscribe({
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
    if (this.saveState() === 'saving') return;
    this.saveState.set('saving');
    this.adapter().save(this.contextId(), this.model.snapshot(), this.documentId()).subscribe({
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

  protected leave(): void {
    if (this.saveState() === 'dirty') this.saveNow();
    this.exit.emit();
  }
}
