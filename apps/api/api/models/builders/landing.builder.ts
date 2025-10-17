import { LandingModel } from "../landing.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder for LandingModel
 */
export class LandingBuilder {
  /**
   * Creates an empty LandingModel with all required properties
   */
  static createEmpty(): LandingModel {
    return {
      selectedOptions: {
        stack: "",
        seoEnabled: false,
        contactFormEnabled: false,
        analyticsEnabled: false,
        i18nEnabled: false,
        performanceOptimized: false,
      },
    };
  }

  /**
   * Creates a partial LandingModel with specified properties
   */
  static createPartial(data: Partial<LandingModel>): LandingModel {
    return { ...this.createEmpty(), ...data };
  }
}
