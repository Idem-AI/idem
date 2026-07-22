import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SSEStepEvent,
  SSEStep,
  SSEGenerationState,
  SSEServiceEventType,
  ResearchConsoleState,
  ConsoleAgent,
  ConsoleActivity,
  AgentEventEnvelope,
  SectionCompletedEnvelope,
} from '../models/sse-step.model';
import { SSEService } from './sse.service';

/** Plafond du flux d'activité conservé en mémoire (évite une croissance illimitée). */
const MAX_ACTIVITIES = 250;

function emptyResearchState(): ResearchConsoleState {
  return { active: false, agents: [], activities: [], queries: [], sources: [], sections: [] };
}

@Injectable({
  providedIn: 'root',
})
export class GenerationService {
  private generationStates = new Map<SSEServiceEventType, BehaviorSubject<SSEGenerationState>>();
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
    sseConnection: Observable<SSEStepEvent>,
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
        research: emptyResearchState(),
      };
      this.generationStates.set(serviceType, new BehaviorSubject<SSEGenerationState>(initialState));
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
      research: emptyResearchState(),
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
  private processSSEEvent(serviceType: SSEServiceEventType, event: SSEStepEvent): void {
    const currentState = this.generationStates.get(serviceType)?.value;
    if (!currentState) return;

    // Événements de l'équipe d'agents de recherche (salle de contrôle).
    const eventType = (event as { type?: string }).type;
    if (eventType === 'agent_event') {
      this.applyResearchUpdate(serviceType, currentState, (research) =>
        this.reduceAgentEvent(research, event as unknown as AgentEventEnvelope),
      );
      return;
    }
    if (eventType === 'section_completed') {
      this.applyResearchUpdate(serviceType, currentState, (research) =>
        this.reduceSectionCompleted(research, event as unknown as SectionCompletedEnvelope),
      );
      return;
    }
    if (eventType === 'run_completed') {
      this.applyResearchUpdate(serviceType, currentState, (research) => ({
        ...research,
        active: false,
      }));
      return;
    }

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
            newState.totalSteps,
          );
          newState.totalSteps = totalSteps;
        }
        break;

      case 'completed':
        // Handle individual step completion
        if (event.stepName && event.data) {
          // Find or create step
          let existingStep = newState.steps.find((step) => step.name === event.stepName);

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
            (stepName) => stepName !== event.stepName,
          );
        }
        break;
    }

    this.generationStates.get(serviceType)?.next(newState);
  }

  /** Applique une transformation immuable à l'état de la salle de contrôle. */
  private applyResearchUpdate(
    serviceType: SSEServiceEventType,
    currentState: SSEGenerationState,
    reducer: (research: ResearchConsoleState) => ResearchConsoleState,
  ): void {
    const research = currentState.research ?? emptyResearchState();
    const newState: SSEGenerationState = { ...currentState, research: reducer(research) };
    this.generationStates.get(serviceType)?.next(newState);
  }

  /** Réduit un événement d'agent dans l'état de la salle de contrôle. */
  private reduceAgentEvent(
    research: ResearchConsoleState,
    envelope: AgentEventEnvelope,
  ): ResearchConsoleState {
    const e = envelope.agentEvent;
    if (!e) return research;

    // 1) Met à jour l'agent (upsert par agentId).
    const agents = [...research.agents];
    let agent = agents.find((a) => a.agentId === e.agentId);
    if (!agent) {
      agent = {
        agentId: e.agentId,
        role: e.role,
        section: e.section,
        status: e.status ?? 'queued',
        message: e.message,
        queryCount: 0,
        sourceCount: 0,
        lastUpdate: e.ts,
      };
      agents.push(agent);
    } else {
      agent = { ...agent, lastUpdate: e.ts, section: e.section ?? agent.section };
    }
    if (e.kind === 'agent_status') {
      if (e.status) agent.status = e.status;
      if (e.message) agent.message = e.message;
    }
    if (e.kind === 'search_query') {
      agent.status = 'searching';
      agent.queryCount += 1;
    }
    if (e.kind === 'source_found') {
      agent.sourceCount += 1;
    }
    const agentIdx = agents.findIndex((a) => a.agentId === e.agentId);
    agents[agentIdx] = agent;

    // 2) Requêtes (dédupliquées).
    let queries = research.queries;
    if (e.kind === 'search_query' && e.query && !queries.includes(e.query)) {
      queries = [...queries, e.query];
    }

    // 3) Sources (dédupliquées par URL).
    let sources = research.sources;
    if (e.kind === 'source_found' && e.source?.url && !sources.some((s) => s.url === e.source!.url)) {
      sources = [...sources, e.source];
    }

    // 4) Flux d'activité (texte lisible best-effort).
    const text = this.activityText(e);
    const activity: ConsoleActivity = {
      ts: e.ts,
      role: e.role,
      agentId: e.agentId,
      section: e.section,
      kind: e.kind,
      text,
      source: e.kind === 'source_found' ? e.source : undefined,
    };
    const activities = [...research.activities, activity].slice(-MAX_ACTIVITIES);

    return { ...research, active: true, agents, queries, sources, activities };
  }

  /** Réduit une section finalisée dans l'état de la salle de contrôle. */
  private reduceSectionCompleted(
    research: ResearchConsoleState,
    envelope: SectionCompletedEnvelope,
  ): ResearchConsoleState {
    const s = envelope.section;
    if (!s) return research;
    const sections = [...research.sections];
    const idx = sections.findIndex((x) => x.name === s.name);
    const entry = {
      name: s.name,
      sourceCount: s.sources?.length ?? 0,
      verdict: s.verdict,
    };
    if (idx !== -1) sections[idx] = { ...sections[idx], ...entry };
    else sections.push(entry);

    // Fusionne d'éventuelles nouvelles sources.
    let sources = research.sources;
    for (const src of s.sources || []) {
      if (src.url && !sources.some((x) => x.url === src.url)) sources = [...sources, src];
    }
    return { ...research, sections, sources };
  }

  /** Construit un texte lisible pour une entrée du flux d'activité. */
  private activityText(e: AgentEventEnvelope['agentEvent']): string {
    switch (e.kind) {
      case 'search_query':
        return e.query ?? '';
      case 'source_found':
        return e.source?.title ?? e.source?.url ?? '';
      case 'finding':
        return e.finding?.claim ?? '';
      case 'section_drafted':
        return `${e.section ?? ''} · ${e.wordCount ?? 0} mots · ${e.sourceCount ?? 0} source(s)`;
      case 'verification':
        return e.verdict
          ? `${e.verdict.passed ? 'OK' : 'À corriger'} · ${e.verdict.citedClaims} cité(s) / ${e.verdict.uncitedClaims} non sourcé(s)`
          : '';
      case 'agent_status':
      case 'note':
      default:
        return e.message ?? '';
    }
  }

  /**
   * Update generation state
   * @param serviceType Service type
   * @param updates Partial state updates
   */
  private updateGenerationState(
    serviceType: SSEServiceEventType,
    updates: Partial<SSEGenerationState>,
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
  getGenerationState(serviceType: SSEServiceEventType): SSEGenerationState | null {
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
