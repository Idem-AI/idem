import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ChartConfigLite, ChartDatasetLite } from '../../models/editor.types';

const PIE_LIKE = new Set(['pie', 'doughnut', 'polarArea']);

/**
 * Éditeur complet de graphique Chart.js : type, titre, légende, libellés,
 * séries (valeurs) et couleurs. Chaque changement renvoie la config complète à
 * l'hôte, qui redessine le graphique en direct et régénère le <script>.
 * Pour les graphiques circulaires, l'édition des couleurs se fait par secteur.
 */
@Component({
  selector: 'app-chart-editor-panel',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Type + légende -->
      <div class="grid grid-cols-2 gap-3">
        <label class="ce-field">
          <span class="ce-label">{{ 'dashboard.documentEditor.chart.type' | translate }}</span>
          <select class="ce-input" [value]="model().type" (change)="setType($any($event.target).value)">
            @for (t of types; track t) {
              <option [value]="t">{{ 'dashboard.documentEditor.chart.types.' + t | translate }}</option>
            }
          </select>
        </label>
        <label class="ce-field justify-end">
          <span class="ce-label">{{ 'dashboard.documentEditor.chart.legend' | translate }}</span>
          <label class="inline-flex items-center gap-2 h-9 cursor-pointer">
            <input
              type="checkbox"
              class="accent-[var(--color-primary)] w-4 h-4"
              [checked]="model().legend !== false"
              (change)="setLegend($any($event.target).checked)"
            />
            <span class="text-sm text-text-secondary">{{ 'dashboard.documentEditor.chart.showLegend' | translate }}</span>
          </label>
        </label>
      </div>

      <label class="ce-field">
        <span class="ce-label">{{ 'dashboard.documentEditor.chart.title' | translate }}</span>
        <input
          type="text"
          class="ce-input"
          [value]="model().title || ''"
          (input)="setTitle($any($event.target).value)"
        />
      </label>

      <!-- Libellés (axes / secteurs) -->
      <div class="ce-field">
        <span class="ce-label flex items-center justify-between">
          {{ 'dashboard.documentEditor.chart.labels' | translate }}
          <button type="button" class="ce-add" (click)="addLabel()">
            <i class="pi pi-plus" aria-hidden="true"></i>
          </button>
        </span>
        <div class="space-y-2">
          @for (label of model().labels; track $index) {
            <div class="flex items-center gap-2">
              @if (isPieLike()) {
                <input
                  type="color"
                  class="ce-color"
                  [value]="sliceColor($index)"
                  (input)="setSliceColor($index, $any($event.target).value)"
                  [attr.aria-label]="'dashboard.documentEditor.chart.sliceColor' | translate"
                />
              }
              <input
                type="text"
                class="ce-input flex-1"
                [value]="label"
                (input)="setLabel($index, $any($event.target).value)"
              />
              <button
                type="button"
                class="ce-remove"
                (click)="removeLabel($index)"
                [attr.aria-label]="'dashboard.documentEditor.chart.removeLabel' | translate"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            </div>
          }
        </div>
      </div>

      <div class="h-px bg-[var(--glass-border)]"></div>

      <!-- Séries -->
      <div class="ce-field">
        <span class="ce-label flex items-center justify-between">
          {{ 'dashboard.documentEditor.chart.datasets' | translate }}
          <button type="button" class="ce-add" (click)="addDataset()">
            <i class="pi pi-plus" aria-hidden="true"></i>
          </button>
        </span>

        <div class="space-y-4">
          @for (ds of model().datasets; track $index) {
            <div class="rounded-lg border border-[var(--glass-border)] p-3 space-y-3">
              <div class="flex items-center gap-2">
                @if (!isPieLike()) {
                  <input
                    type="color"
                    class="ce-color"
                    [value]="datasetColor($index)"
                    (input)="setDatasetColor($index, $any($event.target).value)"
                    [attr.aria-label]="'dashboard.documentEditor.chart.seriesColor' | translate"
                  />
                }
                <input
                  type="text"
                  class="ce-input flex-1"
                  [value]="ds.label || ''"
                  (input)="setDatasetLabel($index, $any($event.target).value)"
                  [placeholder]="'dashboard.documentEditor.chart.seriesName' | translate"
                />
                @if (model().datasets.length > 1) {
                  <button
                    type="button"
                    class="ce-remove"
                    (click)="removeDataset($index)"
                    [attr.aria-label]="'dashboard.documentEditor.chart.removeSeries' | translate"
                  >
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                }
              </div>
              <div class="grid grid-cols-2 gap-2">
                @for (label of model().labels; track $index) {
                  <label class="flex flex-col gap-1">
                    <span class="text-[0.65rem] text-text-tertiary truncate">{{ label || ('dashboard.documentEditor.chart.value' | translate) }}</span>
                    <input
                      type="number"
                      class="ce-input !h-8 !text-xs"
                      [value]="ds.data[$index] ?? 0"
                      (input)="setValue(dsIndex($index, ds), $index, $any($event.target).value)"
                    />
                  </label>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ce-field { display: flex; flex-direction: column; gap: 0.4rem; }
      .ce-label {
        font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.04em; color: var(--color-text-tertiary);
      }
      .ce-input {
        width: 100%; height: 2.25rem; padding: 0 0.6rem;
        border-radius: 0.5rem; border: 1px solid var(--glass-border);
        background: var(--color-surface-1); color: var(--color-text-primary);
        font-size: 0.85rem; transition: border-color 0.15s ease;
      }
      .ce-input:focus-visible { outline: none; border-color: var(--color-primary); }
      .ce-color {
        width: 2.25rem; height: 2.25rem; padding: 2px; cursor: pointer; flex-shrink: 0;
        border-radius: 0.5rem; border: 1px solid var(--glass-border);
      }
      .ce-add, .ce-remove {
        display: inline-flex; align-items: center; justify-content: center;
        width: 1.75rem; height: 1.75rem; border-radius: 0.4rem;
        border: 1px solid var(--glass-border); color: var(--color-text-secondary);
        transition: all 0.15s ease; flex-shrink: 0;
      }
      .ce-add:hover { background: var(--glass-bg-subtle); color: var(--color-primary); }
      .ce-remove:hover { background: var(--glass-bg-subtle); color: #f87171; }
      .ce-add:focus-visible, .ce-remove:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    `,
  ],
})
export class ChartEditorPanelComponent {
  readonly chart = input.required<ChartConfigLite>();
  readonly chartChange = output<ChartConfigLite>();

  protected readonly types = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];

  /** Palette accessible par défaut (contraste suffisant, une par secteur/série). */
  private readonly palette = ['#1447e6', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  protected readonly model = signal<ChartConfigLite>({ type: 'bar', labels: [], datasets: [] });
  protected readonly isPieLike = computed(() => PIE_LIKE.has(this.model().type));

  constructor() {
    effect(() => this.model.set(structuredClone(this.chart())));
  }

  /** Track helper: retourne l'index de dataset réel (les templates imbriquent $index). */
  protected dsIndex(_labelIndex: number, ds: ChartDatasetLite): number {
    return this.model().datasets.indexOf(ds);
  }

  protected datasetColor(i: number): string {
    const c = this.model().datasets[i]?.backgroundColor;
    return (Array.isArray(c) ? c[0] : c) || this.palette[i % this.palette.length];
  }

  protected sliceColor(i: number): string {
    const c = this.model().datasets[0]?.backgroundColor;
    if (Array.isArray(c)) return c[i] || this.palette[i % this.palette.length];
    return this.palette[i % this.palette.length];
  }

  private commit(next: ChartConfigLite): void {
    this.model.set(next);
    this.chartChange.emit(next);
  }

  protected setType(type: string): void {
    const next = structuredClone(this.model());
    next.type = type;
    // Bascule couleur unique <-> tableau selon le type.
    if (PIE_LIKE.has(type)) {
      next.datasets = next.datasets.map((d) => ({
        ...d,
        backgroundColor: d.data.map((_, i) => this.palette[i % this.palette.length]),
      }));
    } else {
      next.datasets = next.datasets.map((d, i) => ({
        ...d,
        backgroundColor: Array.isArray(d.backgroundColor)
          ? d.backgroundColor[0] || this.palette[i % this.palette.length]
          : d.backgroundColor || this.palette[i % this.palette.length],
      }));
    }
    this.commit(next);
  }

  protected setTitle(title: string): void {
    this.commit({ ...structuredClone(this.model()), title });
  }

  protected setLegend(legend: boolean): void {
    this.commit({ ...structuredClone(this.model()), legend });
  }

  protected setLabel(i: number, value: string): void {
    const next = structuredClone(this.model());
    next.labels[i] = value;
    this.commit(next);
  }

  protected addLabel(): void {
    const next = structuredClone(this.model());
    next.labels.push(`Label ${next.labels.length + 1}`);
    next.datasets.forEach((d) => d.data.push(0));
    if (this.isPieLike() && next.datasets[0]) {
      const c = next.datasets[0].backgroundColor;
      if (Array.isArray(c)) c.push(this.palette[c.length % this.palette.length]);
    }
    this.commit(next);
  }

  protected removeLabel(i: number): void {
    const next = structuredClone(this.model());
    next.labels.splice(i, 1);
    next.datasets.forEach((d) => {
      d.data.splice(i, 1);
      if (Array.isArray(d.backgroundColor)) d.backgroundColor.splice(i, 1);
    });
    this.commit(next);
  }

  protected setValue(dsIndex: number, valueIndex: number, value: string): void {
    const next = structuredClone(this.model());
    if (!next.datasets[dsIndex]) return;
    next.datasets[dsIndex].data[valueIndex] = parseFloat(value) || 0;
    this.commit(next);
  }

  protected setDatasetLabel(i: number, label: string): void {
    const next = structuredClone(this.model());
    if (next.datasets[i]) next.datasets[i].label = label;
    this.commit(next);
  }

  protected setDatasetColor(i: number, color: string): void {
    const next = structuredClone(this.model());
    if (next.datasets[i]) {
      next.datasets[i].backgroundColor = color;
      next.datasets[i].borderColor = color;
    }
    this.commit(next);
  }

  protected setSliceColor(i: number, color: string): void {
    const next = structuredClone(this.model());
    const ds = next.datasets[0];
    if (!ds) return;
    const colors = Array.isArray(ds.backgroundColor)
      ? [...ds.backgroundColor]
      : next.labels.map((_, k) => this.palette[k % this.palette.length]);
    colors[i] = color;
    ds.backgroundColor = colors;
    this.commit(next);
  }

  protected addDataset(): void {
    const next = structuredClone(this.model());
    const idx = next.datasets.length;
    next.datasets.push({
      label: `Series ${idx + 1}`,
      data: next.labels.map(() => 0),
      backgroundColor: this.isPieLike()
        ? next.labels.map((_, k) => this.palette[k % this.palette.length])
        : this.palette[idx % this.palette.length],
    });
    this.commit(next);
  }

  protected removeDataset(i: number): void {
    const next = structuredClone(this.model());
    next.datasets.splice(i, 1);
    this.commit(next);
  }
}
