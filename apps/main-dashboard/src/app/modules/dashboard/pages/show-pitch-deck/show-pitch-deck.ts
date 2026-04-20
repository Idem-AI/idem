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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { PitchDeckService } from '../../services/ai-agents/pitch-deck.service';
import { PitchDeckModel } from '../../models/pitchDeck.model';
import { SSEStepEvent } from '../../../../shared/models/sse-step.model';
import { PitchDeckPdfViewer } from './pitch-deck-pdf-viewer/pitch-deck-pdf-viewer';

interface GenerationStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
}

const PITCH_DECK_STEP_NAMES = [
  'Cover',
  'Problem',
  'Solution',
  'Market',
  'Product',
  'Business Model',
  'Traction',
  'Competition',
  'Team',
  'Financials',
  'Ask',
];

@Component({
  selector: 'app-show-pitch-deck',
  standalone: true,
  imports: [CommonModule, TranslateModule, Loader, PitchDeckPdfViewer],
  templateUrl: './show-pitch-deck.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowPitchDeck implements OnInit, OnDestroy {
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly pitchDeck = signal<PitchDeckModel | null>(null);
  protected readonly isGenerating = signal(false);
  protected readonly steps = signal<GenerationStep[]>(
    PITCH_DECK_STEP_NAMES.map((n) => ({ name: n, status: 'pending' })),
  );
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pdfBlob = signal<Blob | null>(null);
  protected readonly pdfLoading = signal(false);

  protected readonly slideNames = computed<string[]>(() => {
    const deck = this.pitchDeck();
    if (!deck) return [];
    const order = PITCH_DECK_STEP_NAMES;
    const sorted = [...deck.sections].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    return sorted.map((s) => this.translate.instant('dashboard.showPitchDeck.slides.' + s.name));
  });

  protected readonly completedCount = computed(
    () => this.steps().filter((s) => s.status === 'completed').length,
  );

  ngOnInit(): void {
    const pid = this.cookieService.get('projectId');
    this.projectId.set(pid);
    if (!pid) {
      this.isLoading.set(false);
      return;
    }
    this.loadPitchDeck(pid);
  }

  ngOnDestroy(): void {
    this.pdfBlob.set(null);
  }

  private loadPitchDeck(projectId: string): void {
    this.isLoading.set(true);
    this.pitchDeckService
      .getPitchDeck(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deck) => {
          this.pitchDeck.set(deck);
          this.isLoading.set(false);
          if (deck && deck.sections && deck.sections.length > 0) {
            this.fetchPdfBlob(projectId);
          }
        },
        error: () => {
          this.pitchDeck.set(null);
          this.isLoading.set(false);
        },
      });
  }

  private fetchPdfBlob(projectId: string): void {
    this.pdfLoading.set(true);
    this.pitchDeckService
      .downloadPitchDeckPdf(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.pdfBlob.set(blob);
          this.pdfLoading.set(false);
        },
        error: (err) => {
          console.error('Pitch deck PDF fetch error:', err);
          this.pdfLoading.set(false);
          this.errorMessage.set(this.translate.instant('dashboard.showPitchDeck.errors.pdfLoad'));
        },
      });
  }

  protected startGeneration(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.errorMessage.set(null);
    this.isGenerating.set(true);
    this.steps.set(PITCH_DECK_STEP_NAMES.map((n) => ({ name: n, status: 'pending' as const })));

    this.pitchDeckService
      .generatePitchDeck(pid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: SSEStepEvent) => this.handleSseEvent(event),
        error: (err) => {
          console.error('Pitch deck generation error:', err);
          this.errorMessage.set(
            this.translate.instant('dashboard.showPitchDeck.errors.generation'),
          );
          this.isGenerating.set(false);
        },
        complete: () => {
          this.isGenerating.set(false);
          this.loadPitchDeck(pid);
        },
      });
  }

  private handleSseEvent(event: SSEStepEvent): void {
    if (!event) return;
    const status = event.parsedData?.status;
    if (status === 'progress') {
      const inProgress = event.parsedData?.stepsInProgress || [];
      const completed = event.parsedData?.completedSteps || [];
      this.steps.update((current) =>
        current.map((s) => ({
          ...s,
          status: completed.includes(s.name)
            ? 'completed'
            : inProgress.includes(s.name)
              ? 'in-progress'
              : s.status === 'completed'
                ? 'completed'
                : 'pending',
        })),
      );
    } else if (status === 'completed' && event.parsedData?.stepName) {
      const stepName = event.parsedData.stepName;
      this.steps.update((current) =>
        current.map((s) => (s.name === stepName ? { ...s, status: 'completed' } : s)),
      );
    }
  }

  protected cancelGeneration(): void {
    this.pitchDeckService.cancelGeneration();
    this.isGenerating.set(false);
  }

  protected downloadPdf(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.pitchDeckService
      .downloadPitchDeckPdf(pid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pitch-deck-${pid}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (err) => {
          console.error('Error downloading pitch deck PDF:', err);
          this.errorMessage.set(this.translate.instant('dashboard.showPitchDeck.errors.download'));
        },
      });
  }

  protected regenerate(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.pdfBlob.set(null);
    this.pitchDeckService
      .deletePitchDeck(pid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pitchDeck.set(null);
          this.startGeneration();
        },
        error: () => this.startGeneration(),
      });
  }
}
