export interface PipelineStepDto {
  name: string;
  status: 'pending' | 'in-progress' | 'succeeded' | 'failed' | 'skipped';
  startedAt?: Date;
  finishedAt?: Date;
  logs?: string;
  errorMessage?: string;
  aiRecommendation?: string;
}

export interface PipelineStatusDto {
  currentStage: string;
  steps: PipelineStepDto[];
  startedAt?: Date;
  estimatedCompletionTime?: Date;
}
