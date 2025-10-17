import {
  DevelopmentConfigsModel,
  LandingPageConfig,
} from "../development.model";

/**
 * Builder for DevelopmentConfigsModel
 */
export class DevelopmentConfigsBuilder {
  /**
   * Creates an empty DevelopmentConfigsModel with all required properties
   */
  static createEmpty(): DevelopmentConfigsModel {
    return {
      constraints: [],
      frontend: {
        framework: "",
        frameworkVersion: undefined,
        frameworkIconUrl: undefined,
        styling: "",
        stateManagement: undefined,
        features: [],
      },
      backend: {
        language: undefined,
        languageVersion: undefined,
        languageIconUrl: undefined,
        framework: "",
        frameworkVersion: undefined,
        frameworkIconUrl: undefined,
        apiType: "",
        apiVersion: undefined,
        apiIconUrl: undefined,
        orm: undefined,
        ormVersion: undefined,
        ormIconUrl: undefined,
        features: [],
      },
      database: {
        type: undefined,
        provider: "",
        version: undefined,
        providerIconUrl: undefined,
        orm: undefined,
        ormVersion: undefined,
        ormIconUrl: undefined,
        features: [],
      },
      landingPageConfig: LandingPageConfig.NONE,
      projectConfig: {
        seoEnabled: false,
        contactFormEnabled: false,
        analyticsEnabled: false,
        i18nEnabled: false,
        performanceOptimized: false,
        authentication: false,
        authorization: false,
        paymentIntegration: undefined,
        customOptions: undefined,
      },
    };
  }

  /**
   * Creates a partial DevelopmentConfigsModel with specified properties
   */
  static createPartial(
    data: Partial<DevelopmentConfigsModel>
  ): DevelopmentConfigsModel {
    return { ...this.createEmpty(), ...data };
  }
}
