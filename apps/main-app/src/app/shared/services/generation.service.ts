import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SSEStepEvent,
  SSEStep,
  SSEGenerationState,
  SSEServiceEventType,
} from '../models/sse-step.model';
import { SSEService } from './sse.service';

@Injectable({
  providedIn: 'root',
})
export class GenerationService {
  private generationStates = new Map<
    SSEServiceEventType,
    BehaviorSubject<SSEGenerationState>
  >();
  private destroy$ = new Subject<void>();

  constructor(private sseService: SSEService) {}

  /**
   * Start generation for a specific service type
   * @param serviceType Type of service
   * @param sseConnection SSE connection observable
   * @returns Observable of generation state
   */
  startGeneration(
    serviceType: SSEServiceEventType,
    sseConnection: Observable<SSEStepEvent>
  ): Observable<SSEGenerationState> {
    console.log(`Starting ${serviceType} generation...`);

    // Initialize or get existing state subject
    if (!this.generationStates.has(serviceType)) {
      const initialState: SSEGenerationState = {
        isGenerating: true,
        steps: [],
        stepsInProgress: [],
        completedSteps: [],
        totalSteps: 0,
        completed: false,
        error: null,
      };
      this.generationStates.set(
        serviceType,
        new BehaviorSubject<SSEGenerationState>(initialState)
      );
    }

    const stateSubject = this.generationStates.get(serviceType)!;

    // Reset state for new generation
    const initialState: SSEGenerationState = {
      isGenerating: true,
      steps: [],
      stepsInProgress: [],
      completedSteps: [],
      totalSteps: 0,
      completed: false,
      error: null,
    };
    stateSubject.next(initialState);

    // Subscribe to SSE events and update state
    sseConnection.pipe(takeUntil(this.destroy$)).subscribe({
      next: (event: SSEStepEvent) => {
        console.log(`Processing ${serviceType} SSE event:`, event);
        this.processSSEEvent(serviceType, event);
      },
      error: (error) => {
        console.error(`${serviceType} SSE error:`, error);
        this.updateGenerationState(serviceType, {
          error: error.message || 'Generation failed',
          isGenerating: false,
        });
      },
      complete: () => {
        console.log(`${serviceType} SSE completed`);
        this.updateGenerationState(serviceType, {
          isGenerating: false,
          completed: true,
        });
      },
    });

    return stateSubject.asObservable();
  }

  /**
   * Process individual SSE events based on the exact backend format
   * @param serviceType Service type
   * @param event SSE event
   */
  private processSSEEvent(
    serviceType: SSEServiceEventType,
    event: SSEStepEvent
  ): void {
    const currentState = this.generationStates.get(serviceType)?.value;
    if (!currentState) return;

    const newState = { ...currentState };

    switch (event.type) {
      case 'progress':
        // Handle progress events with parsedData
        if (event.parsedData) {
          if (event.parsedData.stepsInProgress) {
            newState.stepsInProgress = event.parsedData.stepsInProgress;
          }
          if (event.parsedData.completedSteps) {
            newState.completedSteps = event.parsedData.completedSteps;
          }
          // Calculate total steps
          const totalSteps = Math.max(
            newState.stepsInProgress.length + newState.completedSteps.length,
            newState.totalSteps
          );
          newState.totalSteps = totalSteps;
        }
        break;

      case 'completed':
        // Handle individual step completion
        if (event.stepName && event.data) {
          // Find or create step
          let existingStep = newState.steps.find(
            (step) => step.name === event.stepName
          );

          if (existingStep) {
            existingStep.status = 'completed';
            existingStep.content = event.data;
            existingStep.timestamp = event.timestamp;
            existingStep.summary = event.summary;
          } else {
            // Create new completed step
            const completedStep: SSEStep = {
              name: event.stepName,
              status: 'completed',
              content: event.data,
              timestamp: event.timestamp,
              summary: event.summary,
            };
            newState.steps.push(completedStep);
          }

          // Update completed steps list
          if (!newState.completedSteps.includes(event.stepName)) {
            newState.completedSteps = [...newState.completedSteps, event.stepName];
          }

          // Remove from in-progress if present
          newState.stepsInProgress = newState.stepsInProgress.filter(
            (stepName) => stepName !== event.stepName
          );
        }
        break;
    }

    this.generationStates.get(serviceType)?.next(newState);
  }

  /**
   * Update generation state
   * @param serviceType Service type
   * @param updates Partial state updates
   */
  private updateGenerationState(
    serviceType: SSEServiceEventType,
    updates: Partial<SSEGenerationState>
  ): void {
    const stateSubject = this.generationStates.get(serviceType);
    if (stateSubject) {
      const currentState = stateSubject.value;
      const newState = { ...currentState, ...updates };
      stateSubject.next(newState);
    }
  }

  /**
   * Get current generation state
   * @param serviceType Service type
   * @returns Current state or null
   */
  getGenerationState(
    serviceType: SSEServiceEventType
  ): SSEGenerationState | null {
    return this.generationStates.get(serviceType)?.value || null;
  }

  /**
   * Calculate progress percentage
   * @param state Generation state
   * @returns Progress percentage (0-100)
   */
  calculateProgress(state: SSEGenerationState): number {
    if (state.totalSteps === 0) return 0;
    return Math.round((state.completedSteps.length / state.totalSteps) * 100);
  }

  /**
   * Check if there are completed steps
   * @param state Generation state
   * @returns True if has completed steps
   */
  hasCompletedSteps(state: SSEGenerationState): boolean {
    return state.completedSteps.length > 0;
  }

  /**
   * Get completed steps
   * @param state Generation state
   * @returns Array of completed steps
   */
  getCompletedSteps(state: SSEGenerationState): SSEStep[] {
    return state.steps.filter((step) => step.status === 'completed');
  }

  /**
   * Cancel generation
   * @param serviceType Service type
   */
  cancelGeneration(serviceType: SSEServiceEventType): void {
    this.sseService.cancelGeneration(serviceType);
    this.updateGenerationState(serviceType, {
      isGenerating: false,
      error: 'Generation cancelled by user',
    });
  }

  /**
   * Clean up resources
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
