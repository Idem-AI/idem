import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SheetRow } from '../finance-paste/finance-paste.draft';
import { isHeaderRow, parseClipboard } from '../finance-paste/finance-paste.parser';

interface Cell {
  r: number;
  c: number;
}

/** Ce que la page montre en bout de ligne : où elle sera rangée, ou ce qui ne va pas. */
export interface RowNote {
  text: string;
  error: boolean;
}

const MIN_ROWS = 12;
const HISTORY_LIMIT = 100;

/**
 * La grille du mode tableur — se comporte comme une feuille Excel.
 *
 * - Sélection : clic, glisser, Maj+clic, Maj+flèches ; clic sur le numéro de
 *   ligne pour la ligne entière, Maj ou Ctrl/⌘ pour en prendre plusieurs.
 * - Suppr : vide les cases sélectionnées, ou supprime les lignes entières.
 * - Ctrl/⌘ + C / X / V : copier, couper, coller (un bloc, ou une valeur
 *   répétée sur toute la sélection).
 * - Ctrl/⌘ + Z : annuler ; Ctrl/⌘ + Y ou Ctrl/⌘ + Maj + Z : rétablir.
 * - Clic droit : copier, couper, insérer, supprimer, vider.
 *
 * Composant contrôlé : il reçoit les lignes et émet chaque nouvel état. Il
 * garde l'historique, qui repart de zéro à chaque `resetToken` (chargement,
 * enregistrement). Une modification de case compte pour un seul pas
 * d'annulation, quelle que soit sa longueur — comme dans un tableur.
 */
@Component({
  selector: 'app-finance-sheet-grid',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-sheet-grid.html',
  styleUrl: './finance-sheet-grid.css',
  host: {
    '(document:mouseup)': 'dragging.set(false)',
    '(document:click)': 'menu.set(null)',
  },
})
export class FinanceSheetGridComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly rows = input.required<SheetRow[]>();
  readonly columnLabels = input.required<string[]>();
  readonly cellErrors = input<boolean[][]>([]);
  readonly notes = input<(RowNote | null)[]>([]);
  readonly sectionOptions = input<string[]>([]);
  /** Change à chaque chargement ou enregistrement : l'historique repart de zéro. */
  readonly resetToken = input<number>(0);

  readonly rowsChange = output<SheetRow[]>();
  /** Le texte brut du dernier collage, pour la lecture IA s'il est hors format. */
  readonly pasted = output<string>();

  protected readonly width = computed(() => this.columnLabels().length);
  /** Les lignes reçues, plus les lignes vides où continuer à saisir. */
  protected readonly view = computed(() => this.pad(this.rows()));
  protected readonly anchor = signal<Cell | null>(null);
  protected readonly focusCell = signal<Cell | null>(null);
  /** Lignes prises une à une (Ctrl/⌘ + clic sur le numéro). */
  protected readonly rowSet = signal<ReadonlySet<number> | null>(null);
  protected readonly dragging = signal(false);
  protected readonly menu = signal<{ x: number; y: number } | null>(null);

  private undoStack: SheetRow[][] = [];
  private redoStack: SheetRow[][] = [];
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  /** Case en cours de frappe : toute la frappe n'est qu'un pas d'historique. */
  private editing: string | null = null;

  constructor() {
    effect(() => {
      this.resetToken();
      untracked(() => {
        this.undoStack = [];
        this.redoStack = [];
        this.syncHistoryFlags();
        this.editing = null;
      });
    });
  }

  // -------------------------------------------------------------------
  // Sélection
  // -------------------------------------------------------------------

  protected readonly range = computed(() => {
    const a = this.anchor();
    const f = this.focusCell();
    if (!a || !f) return null;
    return { r1: Math.min(a.r, f.r), r2: Math.max(a.r, f.r), c1: Math.min(a.c, f.c), c2: Math.max(a.c, f.c) };
  });

  /** Les lignes entièrement sélectionnées, s'il y en a. */
  protected readonly selectedRows = computed<number[]>(() => {
    const set = this.rowSet();
    if (set) return [...set].sort((a, b) => a - b);
    const r = this.range();
    if (!r || r.c1 !== 0 || r.c2 !== this.width() - 1) return [];
    return Array.from({ length: r.r2 - r.r1 + 1 }, (_, i) => r.r1 + i);
  });

  /** Lignes touchées par la sélection, entière ou non : ce que « Supprimer les lignes » retire. */
  protected readonly touchedRows = computed<number[]>(() => {
    if (this.selectedRows().length) return this.selectedRows();
    const r = this.range();
    if (!r) return [];
    return Array.from({ length: r.r2 - r.r1 + 1 }, (_, i) => r.r1 + i).filter((i) =>
      this.view()[i]?.cells.some((c) => c.trim()),
    );
  });

  private readonly multiCell = computed(() => {
    if (this.rowSet()) return true;
    const r = this.range();
    return !!r && (r.r1 !== r.r2 || r.c1 !== r.c2);
  });

  protected isSelected(r: number, c: number): boolean {
    const set = this.rowSet();
    if (set) return set.has(r);
    const g = this.range();
    return !!g && this.multiCell() && r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
  }

  protected isRowSelected(r: number): boolean {
    return this.selectedRows().includes(r);
  }

  protected isActive(r: number, c: number): boolean {
    // Des lignes entières sélectionnées : pas de case active à montrer.
    if (this.selectedRows().length) return false;
    const f = this.focusCell();
    return !!f && f.r === r && f.c === c;
  }

  protected onCellMouseDown(event: MouseEvent, r: number, c: number): void {
    if (event.button !== 0) return;
    this.menu.set(null);
    this.rowSet.set(null);
    if (event.shiftKey && this.anchor()) {
      event.preventDefault();
      this.focusCell.set({ r, c });
    } else {
      this.anchor.set({ r, c });
      this.focusCell.set({ r, c });
    }
    this.dragging.set(true);
  }

  protected onCellMouseEnter(r: number, c: number): void {
    if (!this.dragging()) return;
    this.focusCell.set({ r, c });
    // Une sélection de plusieurs cases ne doit pas sélectionner du texte.
    if (this.multiCell()) window.getSelection()?.removeAllRanges();
  }

  /**
   * Comme dans un tableur : arriver sur une case sélectionne son contenu, et
   * taper le remplace. Un second clic place le curseur pour corriger.
   */
  private justFocused = false;

  protected onInputFocus(event: FocusEvent, r: number, c: number): void {
    this.onCellFocus(r, c);
    const input = event.target as HTMLInputElement;
    this.justFocused = true;
    queueMicrotask(() => input.select());
  }

  protected onInputMouseUp(event: MouseEvent): void {
    // Le relâchement du premier clic ne doit pas défaire la sélection du contenu.
    if (this.justFocused && !this.multiCell()) event.preventDefault();
    this.justFocused = false;
  }

  protected onCellFocus(r: number, c: number): void {
    // Tab, Entrée ou clic : la case qui reçoit le focus devient la sélection,
    // sauf pendant un glisser ou une extension Maj.
    if (this.dragging()) return;
    const f = this.focusCell();
    if (!f || f.r !== r || f.c !== c) {
      this.anchor.set({ r, c });
      this.focusCell.set({ r, c });
      this.rowSet.set(null);
    }
  }

  /** Numéro de ligne : la ligne entière. Maj étend, Ctrl/⌘ ajoute ou retire. */
  protected onRowHeaderClick(event: MouseEvent, r: number): void {
    event.preventDefault();
    this.menu.set(null);
    const last = this.width() - 1;
    if (event.metaKey || event.ctrlKey) {
      const set = new Set(this.rowSet() ?? this.selectedRows());
      if (set.has(r)) set.delete(r);
      else set.add(r);
      this.rowSet.set(set);
      this.focusCell.set({ r, c: 0 });
    } else if (event.shiftKey && this.anchor()) {
      this.rowSet.set(null);
      this.anchor.set({ r: this.anchor()!.r, c: 0 });
      this.focusCell.set({ r, c: last });
    } else {
      this.rowSet.set(null);
      this.anchor.set({ r, c: 0 });
      this.focusCell.set({ r, c: last });
    }
    this.host.nativeElement.querySelector<HTMLElement>('.fsg')?.focus();
  }

  // -------------------------------------------------------------------
  // Clavier
  // -------------------------------------------------------------------

  protected onKeyDown(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    // Une case sans texte sélectionné se copie entière, comme dans un tableur.
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const noTextSelected = !input || input.selectionStart === input.selectionEnd;
    if (mod && (key === 'c' || key === 'x') && (this.multiCell() || noTextSelected)) {
      event.preventDefault();
      this.copy(key === 'x');
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.multiCell()) {
      event.preventDefault();
      if (this.selectedRows().length) this.deleteRows();
      else this.clearSelection();
      return;
    }
    if (event.key === 'Escape') {
      this.rowSet.set(null);
      const f = this.focusCell();
      if (f) this.anchor.set(f);
      this.menu.set(null);
      return;
    }

    const f = this.focusCell();
    if (!f) return;
    const target = event.target as HTMLInputElement;
    // Contenu entièrement sélectionné (case qu'on vient d'atteindre) : les
    // flèches changent de case. Curseur dans le texte : elles s'y déplacent.
    const atStart = target.selectionStart === 0;
    const atEnd = target.selectionEnd === (target.value ?? '').length;
    const move: Record<string, [number, number] | undefined> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [event.shiftKey ? -1 : 1, 0],
      ArrowLeft: atStart || event.shiftKey ? [0, -1] : undefined,
      ArrowRight: atEnd || event.shiftKey ? [0, 1] : undefined,
    };
    const step = move[event.key];
    if (!step || (event.key === 'Enter' && mod)) return;
    event.preventDefault();
    const next = {
      r: Math.max(0, Math.min(this.view().length - 1, f.r + step[0])),
      c: Math.max(0, Math.min(this.width() - 1, f.c + step[1])),
    };
    this.rowSet.set(null);
    if (event.shiftKey && event.key !== 'Enter') {
      this.focusCell.set(next);
    } else {
      this.anchor.set(next);
      this.focusCell.set(next);
      this.focusInput(next);
    }
  }

  // -------------------------------------------------------------------
  // Saisie, copier, coller
  // -------------------------------------------------------------------

  protected onInput(r: number, c: number, value: string): void {
    const key = `${r}-${c}`;
    const record = this.editing !== key;
    this.editing = key;
    this.commit(
      this.view().map((row, i) => (i === r ? { ...row, cells: row.cells.map((v, j) => (j === c ? value : v)) } : row)),
      record,
    );
  }

  protected onBlur(): void {
    this.editing = null;
  }

  protected onPaste(event: ClipboardEvent): void {
    const html = event.clipboardData?.getData('text/html') ?? '';
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const matrix = parseClipboard(html, text);
    const range = this.range();
    const single = matrix.length <= 1 && (matrix[0]?.length ?? 0) <= 1;

    // Une valeur sur une sélection de plusieurs cases : elle les remplit toutes.
    if (single && this.multiCell() && range) {
      event.preventDefault();
      const value = matrix[0]?.[0] ?? '';
      this.commit(
        this.view().map((row, i) =>
          this.inRows(i) ? { ...row, cells: row.cells.map((v, j) => (this.isSelected(i, j) ? value : v)) } : row,
        ),
      );
      return;
    }
    if (single) return;
    event.preventDefault();
    this.pasted.emit(text || matrix.map((r) => r.join('\t')).join('\n'));

    const body = isHeaderRow(matrix[0]) ? matrix.slice(1) : matrix;
    const at = range ? { r: range.r1, c: range.c1 } : { r: this.firstEmptyRow(), c: 0 };
    // Un tableau complet se cale toujours sur la première colonne.
    const startCol = body.some((r) => r.length >= this.width()) ? 0 : at.c;
    const next = this.pad(this.view(), at.r + body.length).map((row) => ({ ...row, cells: [...row.cells] }));
    body.forEach((source, i) =>
      source.slice(0, this.width() - startCol).forEach((value, j) => (next[at.r + i].cells[startCol + j] = value)),
    );
    this.commit(next);
    this.anchor.set({ r: at.r, c: startCol });
    this.focusCell.set({ r: at.r + body.length - 1, c: Math.min(this.width() - 1, startCol + (body[0]?.length ?? 1) - 1) });
  }

  protected copy(cut = false): void {
    const rows = this.view();
    let text: string;
    const set = this.rowSet();
    if (set) {
      text = [...set].sort((a, b) => a - b).map((i) => rows[i].cells.join('\t')).join('\n');
    } else {
      const g = this.range();
      if (!g) return;
      text = rows
        .slice(g.r1, g.r2 + 1)
        .map((row) => row.cells.slice(g.c1, g.c2 + 1).join('\t'))
        .join('\n');
    }
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    if (cut) this.clearSelection();
    this.menu.set(null);
  }

  // -------------------------------------------------------------------
  // Lignes
  // -------------------------------------------------------------------

  protected clearSelection(): void {
    this.commit(
      this.view().map((row, i) =>
        this.inRows(i) ? { ...row, cells: row.cells.map((v, j) => (this.isSelected(i, j) || this.isActive(i, j) ? '' : v)) } : row,
      ),
    );
    this.menu.set(null);
  }

  /** Supprime les lignes sélectionnées — ou, à défaut, celles que la sélection touche. */
  deleteRows(): void {
    const doomed = new Set(this.touchedRows().length ? this.touchedRows() : this.focusCell() ? [this.focusCell()!.r] : []);
    if (!doomed.size) return;
    this.commit(this.view().filter((_, i) => !doomed.has(i)));
    const first = Math.min(...doomed);
    this.rowSet.set(null);
    this.anchor.set({ r: first, c: 0 });
    this.focusCell.set({ r: first, c: 0 });
    this.menu.set(null);
  }

  insertRow(): void {
    const at = this.range()?.r1 ?? this.firstEmptyRow();
    const next = [...this.view()];
    next.splice(at, 0, { cells: Array(this.width()).fill('') });
    this.commit(next);
    this.rowSet.set(null);
    this.anchor.set({ r: at, c: 0 });
    this.focusCell.set({ r: at, c: 0 });
    this.menu.set(null);
    queueMicrotask(() => this.focusInput({ r: at, c: 0 }));
  }

  /** Remplace tout le contenu en gardant l'annulation possible (exemple, import). */
  replaceAll(rows: SheetRow[]): void {
    this.commit(rows);
  }

  // -------------------------------------------------------------------
  // Historique
  // -------------------------------------------------------------------

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.view());
    this.editing = null;
    this.rowsChange.emit(previous);
    this.syncHistoryFlags();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.view());
    this.editing = null;
    this.rowsChange.emit(next);
    this.syncHistoryFlags();
  }

  private commit(next: SheetRow[], record = true): void {
    if (record) {
      this.undoStack.push(this.view());
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
      this.syncHistoryFlags();
    }
    this.rowsChange.emit(this.pad(next));
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  // -------------------------------------------------------------------
  // Menu contextuel
  // -------------------------------------------------------------------

  protected onContextMenu(event: MouseEvent, r: number, c: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isSelected(r, c) && !this.isActive(r, c)) {
      this.rowSet.set(null);
      this.anchor.set({ r, c });
      this.focusCell.set({ r, c });
    }
    const box = this.host.nativeElement.getBoundingClientRect();
    this.menu.set({ x: event.clientX - box.left, y: event.clientY - box.top });
  }

  // -------------------------------------------------------------------

  /** Toujours au moins deux lignes vides sous la dernière remplie. */
  private pad(rows: SheetRow[], min = 0): SheetRow[] {
    const width = this.width();
    const out = rows.map((r) => (r.cells.length === width ? r : { ...r, cells: Array.from({ length: width }, (_, i) => r.cells[i] ?? '') }));
    const lastFilled = out.reduce((last, r, i) => (r.cells.some((c) => c.trim()) ? i : last), -1);
    const target = Math.max(MIN_ROWS, min, lastFilled + 3);
    while (out.length < target) out.push({ cells: Array(width).fill('') });
    return out;
  }

  private inRows(i: number): boolean {
    const set = this.rowSet();
    if (set) return set.has(i);
    const g = this.range();
    return !!g && i >= g.r1 && i <= g.r2;
  }

  private firstEmptyRow(): number {
    const index = this.view().findIndex((r) => r.cells.every((c) => !c.trim()));
    return index < 0 ? this.view().length : index;
  }

  private focusInput(cell: Cell): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`[data-cell="${cell.r}-${cell.c}"]`)?.focus();
  }
}
