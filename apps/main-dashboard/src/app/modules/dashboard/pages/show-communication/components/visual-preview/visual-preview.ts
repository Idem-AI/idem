import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EditTarget, FontHints, IdemDocumentPreviewComponent, PageFormat } from '@idem/shared-document-editor/angular';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { Flyer, FlyerFormat } from '../../../../models/communication.model';

/** Dimensions réelles de chaque format, en pixels — celles du rendu PNG côté API. */
const FORMAT_SIZE: Record<FlyerFormat, [number, number]> = {
  square: [1080, 1080],
  story: [1080, 1920],
  banner: [1200, 630],
  post: [1200, 1500],
  a4: [1240, 1754],
};

/**
 * Aperçu d'un visuel de Communication, rendu par l'APERÇU ÉDITABLE PARTAGÉ d'IDEM
 * (`<idem-document-preview>`) : le HTML du visuel, aux proportions du format, dans la même iframe
 * que l'éditeur. Survoler cadre un élément ; cliquer ouvre « Modifier », qui mène à l'éditeur
 * partagé sur cet élément précis.
 *
 * Le HTML n'est pas porté par la liste des visuels (trop lourd pour le planning) : cet aperçu le
 * demande lui-même dès que le visuel change.
 */
@Component({
  selector: 'app-visual-preview',
  imports: [TranslateModule, IdemDocumentPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="relative mx-auto" [style.max-width]="maxWidth()">
      <div class="overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]">
        <idem-document-preview
          [html]="html()"
          [section]="section()"
          [pageFormat]="pageFormat()"
          [fonts]="fonts()"
          [maxHeight]="maxHeight()"
          [loading]="loading()"
          [failed]="failed()"
          [showHint]="false"
          (editRequested)="edit($event)"
        />
      </div>
      @if (failed()) {
        <button type="button" class="outer-button button-sm absolute bottom-2 left-1/2 -translate-x-1/2" (click)="load()">
          {{ 'common.retry' | translate }}
        </button>
      }
      @if (!loading() && !failed()) {
        <button type="button" class="inner-button button-sm absolute right-2 top-2 shadow-lg" (click)="editWhole()">
          <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'common.edit' | translate }}
        </button>
      }
    </figure>
  `,
})
export class VisualPreview {
  private readonly router = inject(Router);
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly visual = input.required<Flyer>();
  /** Polices de la marque, sans quoi le rendu retombe sur la police système. */
  readonly fonts = input<FontHints>({});
  /** Hauteur maximale de l'aperçu à l'écran. */
  readonly maxHeight = input<number>(460);

  /** L'utilisateur a demandé à retoucher : l'hôte peut fermer sa fenêtre avant. */
  readonly editRequested = output<EditTarget>();

  protected readonly size = computed(() => FORMAT_SIZE[this.visual().format] ?? FORMAT_SIZE.square);
  protected readonly pageFormat = computed<PageFormat>(() => {
    const [w, h] = this.size();
    return { width: `${w}px`, height: `${h}px` };
  });
  /** La largeur qui laisse le format tenir dans la hauteur maximale. */
  protected readonly maxWidth = computed(() => {
    const [w, h] = this.size();
    return `min(100%, ${Math.round((this.maxHeight() * w) / h)}px)`;
  });
  protected readonly section = computed(() => {
    const visual = this.visual();
    return { id: visual.id, name: visual.marketingText?.headline || visual.id, type: `flyer-${visual.format}` };
  });

  protected readonly html = signal('');
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    // Un autre visuel (variante, retouche, déclinaison) redemande son HTML.
    effect(() => {
      this.visual().id;
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const visual = this.visual();
    this.loading.set(true);
    this.failed.set(false);
    this.communication.getVisual(this.projectId(), visual.id).subscribe({
      next: (loaded) => {
        this.loading.set(false);
        if (loaded.html) this.html.set(loaded.html);
        else this.failed.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** « Modifier » sur l'élément désigné (ou la section entière, depuis le bouton du haut). */
  protected edit(target: EditTarget): void {
    this.editRequested.emit(target);
    this.goToEditor(target);
  }

  protected editWhole(): void {
    const target: EditTarget = { sectionId: this.visual().id, path: null };
    this.editRequested.emit(target);
    this.goToEditor(target);
  }

  private goToEditor(target: EditTarget): void {
    this.router.navigate(['/project/communication/flyer/edit'], {
      queryParams: { flyerId: this.visual().id, section: target.sectionId, ...(target.path !== null ? { path: target.path } : {}) },
    });
  }
}
