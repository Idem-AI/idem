/**
 * Generic SSE Step Event interface that can be used for all AI generation features
 */
export interface SSEStepEvent {
  type: 'progress' | 'completed';
  stepName: string;
  data: string;
  summary: string;
  timestamp: string;
  parsedData: {
    status: 'progress' | 'completed';
    stepsInProgress?: string[];
    completedSteps?: string[];
    stepName?: string;
  };
}

/**
 * Generic SSE Step interface
 */
export interface SSEStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  content?: string;
  timestamp?: string;
  summary?: string;
}

/**
 * Generic SSE Generation State interface
 */
export interface SSEGenerationState {
  isGenerating: boolean;
  steps: SSEStep[];
  stepsInProgress: string[];
  completedSteps: string[];
  totalSteps: number;
  completed: boolean;
  error: string | null;
}

/**
 * SSE Connection Configuration
 */
export interface SSEConnectionConfig {
  url: string;
  keepAlive?: boolean;
  reconnectionDelay?: number;
  maxRetries?: number;
}

/**
 * SSE Event types
 */
export type SSEEventType = 'progress' | 'completed' | 'completion' | 'steps_list' | 'started' | 'error';

/**
 * SSE Service Event Types
 */
export type SSEServiceEventType = 'diagram' | 'branding' | 'business-plan';
