import type { BrandIdentityModel } from "./brand-identity.model";
import type { DiagramModel } from "./diagram.model";
import type { BusinessPlanModel } from "./businessPlan.model";
import type { DevelopmentConfigsModel } from "./development.model";

export interface AnalysisResultModel {
  id?: string;
  businessPlan?: BusinessPlanModel;
  design: DiagramModel;
  development: {
    configs: DevelopmentConfigsModel;
  };
  branding: BrandIdentityModel;
  createdAt: Date;
  updatedAt: Date;
}
