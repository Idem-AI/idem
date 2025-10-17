import { AnalysisResultModel } from "../analysisResult.model";
import { ArchetypeModel } from "../archetypes.model";
import { ArchitectureModel } from "../architecture.model";
import {
  BrandIdentityModel,
  ColorModel,
  TypographyModel,
} from "../brand-identity.model";
import { BusinessPlanModel } from "../businessPlan.model";
import { DeploymentModel } from "../deployment.model";
import {
  DevelopmentConfigsModel,
  LandingPageConfig,
} from "../development.model";
import { DiagramModel } from "../diagram.model";
import { LandingModel } from "../landing.model";
import { LogoModel } from "../logo.model";
import { ProjectModel } from "../project.model";
import { SectionModel } from "../section.model";
import { UserModel } from "../userModel";
import { WebContainerModel } from "../webcontainer.model";
import { v4 as uuidv4 } from "uuid";

/**
 * Builder pattern for creating empty/default instances of all models
 * Provides type-safe initialization with all required properties
 */
export class ModelBuilder {
  /**
   * Creates an empty AnalysisResultModel with all required properties
   */
  static createEmptyAnalysisResult(): AnalysisResultModel {
    return {
      architectures: [],
      design: this.createEmptyDiagram(),
      development: { configs: this.createEmptyDevelopmentConfigs() },
      branding: this.createEmptyBrandIdentity(),
      landing: this.createEmptyLanding(),
      testing: "",
      generatedDeployment: [{ name: "", content: "" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Creates an empty BrandIdentityModel with all required properties
   */
  static createEmptyBrandIdentity(): BrandIdentityModel {
    return {
      logo: this.createEmptyLogo(),
      generatedLogos: [],
      colors: this.createEmptyColor(),
      generatedColors: [],
      typography: this.createEmptyTypography(),
      generatedTypography: [],
      sections: [],
    };
  }

  /**
   * Creates an empty LogoModel with all required properties
   */
  static createEmptyLogo(): LogoModel {
    return {
      id: uuidv4(),
      name: "",
      svg: "",
      concept: "",
      colors: [],
      fonts: [],
    };
  }

  /**
   * Creates an empty ColorModel with all required properties
   */
  static createEmptyColor(): ColorModel {
    return {
      id: uuidv4(),
      name: "",
      url: "",
      colors: {
        primary: "#000000",
        secondary: "#666666",
        accent: "#0066cc",
        background: "#ffffff",
        text: "#333333",
      },
    };
  }

  /**
   * Creates an empty TypographyModel with all required properties
   */
  static createEmptyTypography(): TypographyModel {
    return {
      id: uuidv4(),
      name: "",
      url: "",
      primaryFont: "",
      secondaryFont: "",
    };
  }

  /**
   * Creates an empty ProjectModel with all required properties
   */
  static createEmptyProject(): ProjectModel {
    return {
      project: undefined,
      name: "",
      description: "",
      type: "web",
      constraints: [],
      teamSize: "",
      scope: "",
      targets: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "",
      selectedPhases: [],
      analysisResultModel: this.createEmptyAnalysisResult(),
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
   * Creates an empty DiagramModel with all required properties
   */
  static createEmptyDiagram(): DiagramModel {
    return {
      sections: [],
    };
  }

  /**
   * Creates an empty LandingModel with all required properties
   */
  static createEmptyLanding(): LandingModel {
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
   * Creates an empty BusinessPlanModel with all required properties
   */
  static createEmptyBusinessPlan(): BusinessPlanModel {
    return {
      sections: [],
    };
  }

  /**
   * Creates an empty DeploymentModel with all required properties
   */
  static createEmptyDeployment(): DeploymentModel {
    return {
      id: uuidv4(),
      name: "",
      projectId: "",
      status: "configuring",
      environment: "development",
      mode: "beginner",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Creates an empty UserModel with all required properties
   */
  static createEmptyUser(): UserModel {
    return {
      uid: "",
      email: "",
      subscription: "free",
      createdAt: new Date(),
      lastLogin: new Date(),
      quota: {
        dailyUsage: 0,
        weeklyUsage: 0,
        lastResetDaily: new Date().toISOString(),
        lastResetWeekly: new Date().toISOString(),
        quotaUpdatedAt: new Date(),
      },
      roles: [],
    };
  }

  /**
   * Creates an empty SectionModel with all required properties
   */
  static createEmptySection(): SectionModel {
    return {
      name: "",
      type: "",
      data: undefined,
      summary: "",
    };
  }

  /**
   * Creates an empty ArchitectureModel with all required properties
   */
  static createEmptyArchitecture(): ArchitectureModel {
    return {
      content: "",
      summary: "",
      name: "",
    };
  }

  /**
   * Creates an empty ArchetypeModel with all required properties
   */
  static createEmptyArchetype(): ArchetypeModel {
    return {
      id: "",
      name: "",
      description: "",
      provider: "aws",
      category: "",
      tags: [],
      icon: "",
      version: "",
      terraformVariables: [],
      defaultValues: {},
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Creates an empty DevelopmentConfigsModel with all required properties
   */
  static createEmptyDevelopmentConfigs(): DevelopmentConfigsModel {
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
   * Utility method to create a partial model with only specified properties
   * Useful when you only need to initialize certain fields
   */
  static createPartial<T>(partialData: Partial<T>, emptyModel: T): T {
    return { ...emptyModel, ...partialData };
  }

  /**
   * Creates a deep copy of any model to avoid reference issues
   */
  static deepCopy<T>(model: T): T {
    return JSON.parse(JSON.stringify(model));
  }
}

/**
 * Convenience exports for direct access to builders
 */
export const EmptyModels = {
  AnalysisResult: () => ModelBuilder.createEmptyAnalysisResult(),
  BrandIdentity: () => ModelBuilder.createEmptyBrandIdentity(),
  Logo: () => ModelBuilder.createEmptyLogo(),
  Color: () => ModelBuilder.createEmptyColor(),
  Typography: () => ModelBuilder.createEmptyTypography(),
  Project: () => ModelBuilder.createEmptyProject(),
  Diagram: () => ModelBuilder.createEmptyDiagram(),
  Landing: () => ModelBuilder.createEmptyLanding(),
  BusinessPlan: () => ModelBuilder.createEmptyBusinessPlan(),
  Deployment: () => ModelBuilder.createEmptyDeployment(),
  User: () => ModelBuilder.createEmptyUser(),
  Section: () => ModelBuilder.createEmptySection(),
  Architecture: () => ModelBuilder.createEmptyArchitecture(),
  Archetype: () => ModelBuilder.createEmptyArchetype(),
  DevelopmentConfigs: () => ModelBuilder.createEmptyDevelopmentConfigs(),
};
