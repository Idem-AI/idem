import { ProjectModel } from "../project.model";
import { v4 as uuidv4 } from "uuid";
import { AnalysisResultBuilder } from "./analysisResult.builder";

/**
 * Builder for ProjectModel
 */
export class ProjectBuilder {
  /**
   * Creates an empty ProjectModel with all required properties
   */
  static createEmpty(): ProjectModel {
    return {
      id: uuidv4(),
      name: "",
      description: "",
      userId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      project: undefined,
      type: "web",
      constraints: [],
      teamSize: "",
      scope: "",
      targets: "",
      selectedPhases: [],
      analysisResultModel: AnalysisResultBuilder.createEmpty(),
      deployments: [],
      activeChatMessages: [],
      additionalInfos: {
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "",
        zipCode: "",
        teamMembers: [],
      },
    };
  }

  /**
   * Creates a partial ProjectModel with specified properties
   */
  static createPartial(data: Partial<ProjectModel>): ProjectModel {
    return { ...this.createEmpty(), ...data };
  }
}
