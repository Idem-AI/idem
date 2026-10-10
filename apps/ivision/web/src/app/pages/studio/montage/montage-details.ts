import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../core/api.service';
import { CaptionStyle, CutMode, Montage, MontageElement } from '../../../core/models';

const CAPTIONS: CaptionStyle[] = ['pop', 'karaoke', 'minimal', 'none'];
const CUTS: CutMode[] = ['tight', 'natural', 'none'];
const FORMATS = ['story', 'square', 'portrait', 'landscape'];

/** Un instant de l'original dans la vidéo montée (même calcul que le moteur). */
function mapTime(ranges: Montage['cuts']['ranges'], t: number): number | null {
  for (const r of ranges) if (t >= r.start - 1e-6 && t <= r.end + 1e-6) return r.at + Math.min(r.end, Math.max(r.start, t)) - r.start;
  return null;
}

/**
 * « Ajuster les détails » d'un montage — pour qui veut aller plus loin que la conversation :
 * ce qui est dit (un mot cliqué y amène, une faute se corrige), ce qui apparaît (élément par
 * élément), les sous-titres, les coupes, le format, la musique, le carton de fin.
 */
@Component({
  selector: 'iv-montage-details',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './montage-details.html',
})
export class MontageDetails {
  private readonly api = inject(ApiService);

  readonly montage = input.required<Montage>();
  /** L'instant de l'aperçu (le mot dit s'allume). */
  readonly time = input(0);
  readonly changed = output<Montage>();
  readonly seek = output<number>();

  protected readonly captionStyles = CAPTIONS;
  protected readonly cutModes = CUTS;
  protected readonly formats = FORMATS;

  protected readonly saving = signal<string | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly selectedWord = signal<number | null>(null);
  protected readonly wordDraft = signal('');
  protected readonly draft = signal<MontageElement[]>([]);
  protected readonly draftDirty = signal(false);
  protected readonly outroText = signal('');
  protected readonly outroDetail = signal('');

  protected readonly ready = computed(() => this.montage().status === 'ready');
  protected readonly timed = computed(() => {
    const m = this.montage();
    const dropped = new Set(m.cuts.dropped ?? []);
    return m.words.map((w, i) => {
      if (dropped.has(i)) return null;
      const start = mapTime(m.cuts.ranges, w.start) ?? mapTime(m.cuts.ranges, (w.start + w.end) / 2);
      return start === null ? null : { start, end: mapTime(m.cuts.ranges, w.end) ?? start + 0.3 };
    });
  });
  protected readonly activeWord = computed(() => {
    const t = this.time();
    const timed = this.timed();
    for (let i = 0; i < timed.length; i++) {
      const w = timed[i];
      if (w && t >= w.start - 0.02 && t < w.end + 0.05) return i;
    }
    return -1;
  });

  constructor() {
    // Le montage reçu (création, retour, retouche) : copie locale, sauf retouches en cours.
    effect(() => {
      const m = this.montage();
      untracked(() => {
        if (this.draftDirty()) return;
        this.draft.set(m.elements.map((e) => ({ ...e, items: e.items ? [...e.items] : undefined })));
        this.outroText.set(m.outro?.text ?? '');
        this.outroDetail.set(m.outro?.detail ?? '');
      });
    });
  }

  private save(kind: string, patch: Record<string, unknown>): void {
    this.saving.set(kind);
    this.saveFailed.set(false);
    this.api.updateMontage(this.montage().id, patch).subscribe({
      next: (next) => {
        this.saving.set(null);
        if (kind === 'elements') this.draftDirty.set(false);
        this.changed.emit(next);
      },
      error: () => {
        this.saving.set(null);
        this.saveFailed.set(true);
      },
    });
  }

  protected seekWord(i: number): void {
    const w = this.timed()[i];
    if (w) this.seek.emit(w.start);
  }

  protected elementTime(e: MontageElement): number | null {
    for (let i = e.from; i <= e.to; i++) {
      const w = this.timed()[i];
      if (w) return w.start;
    }
    return null;
  }

  protected clock(t: number | null): string {
    if (t === null) return '–';
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  }

  protected selectWord(i: number): void {
    this.selectedWord.set(i);
    this.wordDraft.set(this.montage().words[i]?.text ?? '');
    this.seekWord(i);
  }

  protected saveWord(): void {
    const i = this.selectedWord();
    const text = this.wordDraft().trim();
    if (i === null || !text) return;
    this.selectedWord.set(null);
    this.save('word', { words: { [String(i)]: text } });
  }

  protected editElement(id: string, field: 'text' | 'value' | 'label', value: string): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    this.draftDirty.set(true);
  }

  protected editItems(id: string, value: string): void {
    const items = value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, items } : e)));
    this.draftDirty.set(true);
  }

  protected toggleElement(id: string, visible: boolean): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, off: !visible } : e)));
    this.draftDirty.set(true);
  }

  protected removeElement(id: string): void {
    this.draft.update((list) => list.filter((e) => e.id !== id));
    this.draftDirty.set(true);
  }

  protected saveElements(): void {
    this.save('elements', { elements: this.draft() });
  }

  protected itemsText(e: MontageElement): string {
    return (e.items ?? []).join('\n');
  }

  protected clipPoster(e: MontageElement): string | undefined {
    return this.montage().clips?.find((c) => c.id === e.clip)?.posterUrl;
  }

  protected setCaptions(style: string): void {
    this.save('captions', { captions: style });
  }

  protected setMusic(on: boolean): void {
    this.save('music', { music: on });
  }

  protected setCuts(mode: string): void {
    this.save('cuts', { cuts: mode });
  }

  protected setFormat(format: string): void {
    this.save('format', { format });
  }

  protected saveOutro(enabled: boolean): void {
    const text = this.outroText().trim();
    this.save('outro', { outro: enabled && text ? { text, detail: this.outroDetail().trim() } : null });
  }
}
