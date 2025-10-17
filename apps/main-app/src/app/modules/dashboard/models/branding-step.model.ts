export interface BrandingStepEvent {
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

export interface BrandingStep {
  stepName: string;
  status: 'progress' | 'completed';
  content?: string;
  timestamp: string;
  summary: string;
}

export interface BrandingGenerationState {
  steps: BrandingStep[];
  currentStep: BrandingStep | null;
  isGenerating: boolean;
  error: string | null;
  completed: boolean;
}
