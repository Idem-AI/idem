/**
 * Generation types for development
 */
export type GenerationType = 'landing' | 'app' | 'both' | 'integrated';

/**
 * Development modes
 */
export type DevelopmentMode = 'quick' | 'advanced';

/**
 * L'application est web (par défaut, recommandée) ou mobile. Une application
 * mobile est une application React pensée pour le téléphone, installable en
 * PWA et emballée par Capacitor pour Android et iOS.
 */
export type AppPlatform = 'web' | 'mobile';

/**
 * Quick generation preset configurations
 */
export interface QuickGenerationPreset {
  name: string;
  description: string;
  frontend: {
    framework: string;
    styling: string[];
    features: string[];
  };
  backend: {
    language: string;
    framework: string;
    apiType: string;
    features: string[];
  };
  database: {
    type: string;
    provider: string;
    features: string[];
  };
}

/**
 * Model for development configurations that will be sent to the backend
 */
export interface DevelopmentConfigsModel {
  mode: DevelopmentMode;
  generationType: GenerationType;
  /** Web ou mobile, pour l'application. Absent : web. */
  appPlatform?: AppPlatform;
  constraints: string[];
  preset?: string; // For quick generation mode
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
    typeVersion?: string;
    typeIconUrl?: string;
    provider: string;
    providerVersion?: string;
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
          realTimeSubscriptions?: boolean;
          authentication?: boolean;
          storage?: boolean;
          edgeFunctions?: boolean;
          vectorSearch?: boolean;
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
  NONE = 'NONE',
  SEPARATE = 'SEPARATE',
  INTEGRATED = 'INTEGRATED',
  ONLY_LANDING = 'ONLY_LANDING',
}

/**
 * Une application complète (interface + serveur + base de données), par
 * opposition au site vitrine seul. Les anciennes configurations « app »,
 * « both » et « integrated » en sont toutes : elles ont un serveur et une base.
 */
export function isFullApplication(configs: DevelopmentConfigsModel | null | undefined): boolean {
  return !!configs && configs.landingPageConfig !== LandingPageConfig.ONLY_LANDING;
}
