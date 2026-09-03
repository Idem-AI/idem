export interface ProjectModel {
  id?: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'iot' | 'desktop';
  analysisResultModel?: {
    branding?: {
      logo?: {
        svg: string;
        iconSvg?: string;
        concept: string;
        colors?: string[];
        fonts?: string[];
        variations?: {
          lightBackground?: string;
          darkBackground?: string;
          monochrome?: string;
          withText?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
          iconOnly?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
        };
        // Hosted PNG asset URLs (SVG stays the source of truth). Preferred when
        // referencing the logo by URL in generation contexts.
        assetUrls?: {
          primary?: string;
          icon?: string;
          withText?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
          iconOnly?: {
            lightBackground?: string;
            darkBackground?: string;
            monochrome?: string;
          };
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
  /** User UI language ('en' | 'fr') so the AI generates content in the right language. */
  language?: string;
  /**
   * Design-linter repair instructions, sent alongside a short human-readable
   * message so the transcript stays clean while the model gets the full list.
   */
  qualityRepair?: string;
  /**
   * Instantané de l'espace de travail, envoyé en mode Plan uniquement.
   *
   * Le code vit dans le WebContainer du navigateur, pas sur le serveur : sans
   * cet instantané, les outils de lecture n'auraient rien à lire. Il n'est pas
   * envoyé en mode Build, où l'historique des artefacts porte déjà les
   * fichiers.
   */
  workspace?: {
    files: Record<string, string>;
    logs?: string[];
  };
}
