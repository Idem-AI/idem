export interface DevelopmentConfigsModel {
  constraints: string[];
  frontend: {
    framework: string;
    frameworkVersion?: string;
    frameworkIconUrl?: string;
    styling: string[] | string;
    stateManagement?: string;
    features:
      | {
          routing?: boolean;
          componentLibrary?: boolean;
          testing?: boolean;
          pwa?: boolean;
          seo?: boolean;
          [key: string]: boolean | undefined;
        }
      | string[];
  };

  backend: {
    language?: string;
    languageVersion?: string;
    languageIconUrl?: string;
    framework: string;
    frameworkVersion?: string;
    frameworkIconUrl?: string;
    apiType: string;
    apiVersion?: string;
    apiIconUrl?: string;
    orm?: string;
    ormVersion?: string;
    ormIconUrl?: string;
    features:
      | {
          authentication?: boolean;
          authorization?: boolean;
          documentation?: boolean;
          testing?: boolean;
          logging?: boolean;
          [key: string]: boolean | undefined;
        }
      | string[];
  };

  database: {
    type?: string;
    provider: string;
    version?: string;
    providerIconUrl?: string;
    orm?: string;
    ormVersion?: string;
    ormIconUrl?: string;
    features:
      | {
          migrations?: boolean;
          seeders?: boolean;
          caching?: boolean;
          replication?: boolean;
          [key: string]: boolean | undefined;
        }
      | string[];
  };
  landingPageConfig: LandingPageConfig;
  landingPage?: {
    url: string;
    codeUrl: string;
  };

  projectConfig: {
    seoEnabled: boolean;
    contactFormEnabled: boolean;
    analyticsEnabled: boolean;
    i18nEnabled: boolean;
    performanceOptimized: boolean;
    authentication: boolean;
    authorization: boolean;
    paymentIntegration?: boolean;
    customOptions?: Record<string, any>;
  };
}

export enum LandingPageConfig {
  NONE = "NONE",
  SEPARATE = "SEPARATE",
  INTEGRATED = "INTEGRATED",
  ONLY_LANDING = "ONLY_LANDING",
}
