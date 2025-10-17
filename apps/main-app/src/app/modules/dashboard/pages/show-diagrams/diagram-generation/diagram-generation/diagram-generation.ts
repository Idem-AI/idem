import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  input,
  output,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { DiagramsService } from '../../../../services/ai-agents/diagrams.service';
import { DiagramModel } from '../../../../models/diagram.model';
import { GenerationService } from '../../../../../../shared/services/generation.service';
import { SSEGenerationState } from '../../../../../../shared/models/sse-step.model';
import { generatePdf } from '../../../../../../utils/pdf-generator';
import { environment } from '../../../../../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-diagram-generation',
  standalone: true,
  imports: [
    CommonModule,
    MarkdownModule,
    SkeletonModule,
    CardModule,
    ProgressBarModule,
    ButtonModule,
    TagModule,
  ],
  templateUrl: './diagram-generation.html',
  styleUrls: ['./diagram-generation.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramGeneration implements OnInit, OnDestroy {
  private readonly diagramsService = inject(DiagramsService);
  private readonly generationService = inject(GenerationService);
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  // ViewChild for scroll container
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;

  // Input for project ID
  readonly projectId = input.required<string>();

  // Output to emit the final diagram to parent component
  readonly diagramGenerated = output<DiagramModel>();

  // Generation state signal
  protected readonly generationState = signal<SSEGenerationState>({
    isGenerating: false,
    steps: [],
    stepsInProgress: [],
    completedSteps: [],
    totalSteps: 0,
    completed: false,
    error: null,
  });

  protected readonly finalDiagram = signal<DiagramModel | null>(null);

  // Environment URL
  protected readonly diagenUrl = environment.services.diagen.url;

  // Computed properties using the new generation state
  protected readonly isGenerating = computed(
    () => this.generationState().isGenerating
  );
  protected readonly generationError = computed(
    () => this.generationState().error
  );
  protected readonly completedSteps = computed(() =>
    this.generationState().steps.filter((step) => step.status === 'completed')
  );
  protected readonly isCompleted = computed(
    () => this.generationState().completed
  );
  protected readonly progressPercentage = computed(() =>
    this.generationService.calculateProgress(this.generationState())
  );

  // Computed-like getters
  protected hasCompletedSteps(): boolean {
    return this.generationService.hasCompletedSteps(this.generationState());
  }

  protected totalSteps(): number {
    return this.generationState().totalSteps;
  }

  ngOnInit(): void {
    // Component is ready, but wait for user to start generation
    console.log('Diagram generation component loaded, waiting for user action');
    this.generateDiagrams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Generate new diagrams using SSE for real-time updates
   */
  protected generateDiagrams(): void {
    if (!this.projectId()) {
      console.error('Project ID not found');
      return;
    }

    // Reset state for new generation
    this.resetGenerationState();
    console.log('Starting diagram generation with SSE...');

    const sseConnection = this.diagramsService.createDiagramModel(
      this.projectId()
    );

    this.generationService
      .startGeneration('diagram', sseConnection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (state) => {
          console.log('Generation state updated:', state);
          this.generationState.set(state);

          // Handle completion
          if (state.completed) {
            this.handleGenerationComplete(state);
          }

          // Handle errors
          if (state.error) {
            this.handleGenerationError(state.error);
          }
        },
        error: (error) => {
          console.error('Diagram generation error:', error);
          this.handleGenerationError(error.message || 'Generation failed');
        },
        complete: () => {
          console.log('Diagram generation stream completed');
        },
      });
  }

  /**
   * Handle generation completion
   */
  private handleGenerationComplete(state: SSEGenerationState): void {
    console.log('Diagram generation completed:', state);
    this.router.navigate(['/console/diagrams']);
  }

  /**
   * Handle generation error
   */
  private handleGenerationError(error: string): void {
    console.error('Generation error:', error);
    this.generationState.update((state) => ({
      ...state,
      error: error,
      isGenerating: false,
    }));
  }

  /**
   * Reset generation state
   */
  private resetGenerationState(): void {
    this.generationState.set({
      isGenerating: true,
      steps: [],
      stepsInProgress: [],
      completedSteps: [],
      totalSteps: 0,
      completed: false,
      error: null,
    });
    this.finalDiagram.set(null);
  }

  /**
      );
      
      // Combine all diagram content
      const combinedContent = diagramSections
        .map((section: any) => section.data)
        .join('\n\n');
      
      // Create final diagram model
      const finalDiagram: DiagramModel = {
        id: diagramPayload.id || `diagram-${Date.now()}`,
        title: 'Generated Diagram',
        content: combinedContent,
        sections: diagramSections.map((section: any) => ({
          id: `section-${section.name.replace(/\s+/g, '-').toLowerCase()}`,
          name: section.name,
          type: 'generated',
          data: section.data,
          summary: section.summary,
        })),
        createdAt: diagramPayload.createdAt ? new Date(diagramPayload.createdAt._seconds * 1000) : new Date(),
        updatedAt: diagramPayload.updatedAt ? new Date(diagramPayload.updatedAt._seconds * 1000) : new Date(),
      };
      
      console.log('Final diagram created:', finalDiagram);
      this.finalDiagram.set(finalDiagram);
    }
    
    // Auto-scroll to bottom after completion
    setTimeout(() => this.scrollToBottom(), 100);
  }
    setTimeout(() => this.scrollToBottom(), 100);
  }

  /**
   * Download PDF of the generated diagram
   */
  protected downloadPdf(): void {
    const diagram = this.finalDiagram();
    if (diagram && diagram.content) {
      generatePdf(diagram.content);
    }
  }

  /**
   * Cancel ongoing diagram generation
   */
  protected cancelGeneration(): void {
    this.generationService.cancelGeneration('diagram');
    this.generationState.update((state) => ({
      ...state,
      isGenerating: false,
      error: 'Generation cancelled',
    }));
  }

  /**
   * Auto-scroll to bottom of the container
   */
  private scrollToBottom(): void {
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollTo({
        top: this.scrollContainer.nativeElement.scrollHeight,
        behavior: 'smooth',
      });
    }
  }
}
