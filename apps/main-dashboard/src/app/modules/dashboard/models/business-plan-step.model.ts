export interface BusinessPlanStepEvent {
  type: 'started' | 'completed';
  stepName: string;
  data: string;
  summary: string;
  timestamp: string;
  parsedData: {
    status: string;
    stepName: string;
  };
}

export interface BusinessPlanStep {
  stepName: string;
  status: 'progress' | 'completed';
  content?: string;
  timestamp: string;
  summary: string;
}

export interface BusinessPlanGenerationState {
  steps: BusinessPlanStep[];
  currentStep: BusinessPlanStep | null;
  isGenerating: boolean;
  error: string | null;
  completed: boolean;
}
