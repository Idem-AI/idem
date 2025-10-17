import { AnalysisResultModel } from "../analysisResult.model";
import { BrandIdentityBuilder } from "./brandIdentity.builder";
import { DevelopmentConfigsBuilder } from "./developmentConfigs.builder";
import { DiagramBuilder } from "./diagram.builder";
import { LandingBuilder } from "./landing.builder";

/**
 * Builder for AnalysisResultModel
 */
export class AnalysisResultBuilder {
  /**
   * Creates an empty AnalysisResultModel with all required properties
   */
  static createEmpty(): AnalysisResultModel {
    return {
      architectures: [],
      design: DiagramBuilder.createEmpty(),
      development: { configs: DevelopmentConfigsBuilder.createEmpty() },
      branding: BrandIdentityBuilder.createEmpty(),
      landing: LandingBuilder.createEmpty(),
      testing: "",
      generatedDeployment: [{ name: "", content: "" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Creates a partial AnalysisResultModel with specified properties
   */
  static createPartial(
    data: Partial<AnalysisResultModel>
  ): AnalysisResultModel {
    return { ...this.createEmpty(), ...data };
  }
}
