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

