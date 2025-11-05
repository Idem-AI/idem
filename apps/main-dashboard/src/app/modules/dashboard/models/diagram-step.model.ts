export interface DiagramStepEvent {
  type: 'started' | 'completed';
  stepName: string;
  data: string;
  summary: string;
  timestamp: string;
  parsedData: {
    status?: string;
    stepName?: string;
    stepsInProgress?: string[];
    completedSteps?: string[];
  };
}

export interface DiagramStep {
  stepName: string;
  status: 'progress' | 'completed';
  content?: string;
  timestamp: string;
  summary: string;
}

export interface DiagramGenerationState {
  steps: DiagramStep[];
  currentStep: DiagramStep | null;
  isGenerating: boolean;
  error: string | null;
  completed: boolean;
}
