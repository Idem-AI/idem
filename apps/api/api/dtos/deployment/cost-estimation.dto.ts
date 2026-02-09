export interface CostEstimationDto {
  monthlyCost: number;
  hourlyCost: number;
  oneTimeCost: number;
  currency: string;
  estimatedAt: Date;
  breakdown: {
    componentId: string;
    componentName: string;
    cost: number;
    description: string;
  }[];
}
