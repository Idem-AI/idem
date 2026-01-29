export interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'iot' | 'desktop';
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
    design?: {
      sections: Array<{
        name: string;
        type: string;
        summary: string;
        data?: any;
      }>;
    };
    development?: {
      configs?: {
        landingPageConfig?: 'NONE' | 'INTEGRATED' | 'SEPARATE' | 'ONLY_LANDING';
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
          [key: string]: any;
        };
      };
    };
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: any;
  experimental_attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
  }>;
}

export type Messages = Message[];

export interface ParametersSchema {
  type: string;
  title?: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

export interface ToolInfo {
  id: `${string}.${string}`;
  name: string;
  description?: string;
  parameters: ParametersSchema;
}

export interface ChatRequest {
  messages: Messages;
  model: string;
  mode: 'chat' | 'builder';
  otherConfig?: {
    isBackEnd: boolean;
    backendLanguage: string;
    extra: Record<string, any>;
  };
  tools?: ToolInfo[];
  projectData?: ProjectModel;
}
