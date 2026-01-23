export interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'iot' | 'desktop';
  scope?: string;
  targets?: string[] | string;
  analysisResultModel?: {
    branding?: {
      logo?: {
        svg: string;
        concept: string;
        colors?: string[];
        fonts?: string[];
        variations?: {
          lightBackground?: string;
          darkBackground?: string;
          monochrome?: string;
        };
      };
      colors?: {
        name: string;
        url: string;
        colors?: {
          primary: string;
          secondary: string;
          accent: string;
          background: string;
          text: string;
        };
      };
      typography?: {
        name: string;
        url: string;
        primaryFont: string;
        secondaryFont: string;
      };
    };
    development?: {
      configs?: {
        frontend?: {
          framework: string;
          frameworkVersion?: string;
          styling: string | string[];
          features?: string[] | Record<string, boolean>;
        };
        backend?: {
          language?: string;
          framework: string;
          frameworkVersion?: string;
          apiType: string;
          orm?: string;
          features?: string[] | Record<string, boolean>;
        };
        database?: {
          provider: string;
          version?: string;
          orm?: string;
          features?: string[] | Record<string, boolean>;
        };
        projectConfig?: {
          authentication?: boolean;
          authorization?: boolean;
          seoEnabled?: boolean;
          contactFormEnabled?: boolean;
          analyticsEnabled?: boolean;
          i18nEnabled?: boolean;
          performanceOptimized?: boolean;
          paymentIntegration?: boolean;
          [key: string]: boolean | undefined;
        };
        landingPageConfig?: 'NONE' | 'INTEGRATED' | 'SEPARATE' | 'ONLY_LANDING';
      };
    };
    design?: {
      sections?: Array<{
        name: string;
        type: string;
        summary: string;
        data?: Record<string, unknown>;
      }>;
    };
  };
}
