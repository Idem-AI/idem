import { LandingPageConfig } from "@/api/persistence/models/development.model";
import { ChatType } from "../../../Sidebar/ProjectSidebar";
import { ProjectModel } from "@/api/persistence/models/project.model";

export class MultiChatPromptService {
  /**
   * Generate the appropriate prompt based on LandingPageConfig and ChatType
   */
  generatePrompt(projectData: ProjectModel): string {
    const landingPageConfig =
      projectData.analysisResultModel?.development?.configs
        ?.landingPageConfig || LandingPageConfig.NONE;

    switch (landingPageConfig) {
      case LandingPageConfig.SEPARATE:
        return this.generateSeparatePrompt(projectData, ChatType.LANDING_PAGE);

      case LandingPageConfig.INTEGRATED:
        return this.generateIntegratedPrompt(projectData);

      case LandingPageConfig.ONLY_LANDING:
        return this.generateLandingOnlyPrompt(projectData);

      case LandingPageConfig.NONE:
      default:
        return this.generateAppOnlyPrompt(projectData);
    }
  }

  /**
   * Generate prompt for SEPARATE config (two separate chats)
   */
  private generateSeparatePrompt(
    projectData: ProjectModel,
    chatType: ChatType
  ): string {
    if (chatType === ChatType.LANDING_PAGE) {
      return this.generateLandingPagePrompt(projectData, "separate");
    } else {
      return this.generateApplicationPrompt(projectData, "separate");
    }
  }

  /**
   * Generate prompt for INTEGRATED config (single chat with landing page)
   */
  private generateIntegratedPrompt(projectData: ProjectModel): string {
    return this.generateApplicationPrompt(projectData, "integrated");
  }

  /**
   * Generate prompt for ONLY_LANDING config (landing page only)
   */
  private generateLandingOnlyPrompt(projectData: ProjectModel): string {
    return this.generateLandingPagePrompt(projectData, "only");
  }

  /**
   * Generate prompt for NONE config (application only)
   */
  private generateAppOnlyPrompt(projectData: ProjectModel): string {
    return this.generateApplicationPrompt(projectData, "none");
  }

  /**
   * Generate comprehensive landing page prompt
   */
  private generateLandingPagePrompt(
    projectData: ProjectModel,
    type: "separate" | "only"
  ): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);
    const techStack = this.getCompleteTechStack(projectData);

    const title =
      type === "separate"
        ? "Separate Landing Page Generation"
        : "Landing Page Only Generation";
    const objective =
      type === "separate"
        ? `Create a separate and independent landing page to present the "${projectData.name}" project.`
        : `Create a standalone landing page for "${projectData.name}" without any application functionality.`;

    return `# ${title}

${projectInfo}

${brandInfo}

## Objective
${objective}

## Landing Page Specifications
- **Type**: Marketing landing page ${type === "separate" ? "separate from the application" : "only"}
- **Goal**: Present the product, convert visitors to users
- **Integration**: ${type === "separate" ? "Link to main application but separate codebase" : "No application integration needed"}

${techStack}

## Landing Page Sections
1. **Hero Section**: Compelling headline, value proposition, primary CTA
2. **Features**: Key product features and benefits
3. **Social Proof**: Testimonials, reviews, client logos
4. **Pricing**: Pricing plans and packages (if applicable)
5. **About**: Company/product information
6. **Contact**: Contact form and information
7. **Footer**: Legal links, social media, additional info


## Instructions
- Create a high-converting ${type === "separate" ? "separate" : "standalone"} landing page
- Focus on marketing and conversion optimization
- Implement modern design with smooth animations
- Optimize for SEO and performance
- Include clear call-to-action buttons
- Make it fully responsive across all devices
- Use the provided brand assets and colors
- ${type === "separate" ? "Include clear CTAs to the application" : "No application functionality needed"}

Generate the complete landing page code with all necessary files.`;
  }

  /**
   * Generate comprehensive application prompt
   */
  private generateApplicationPrompt(
    projectData: ProjectModel,
    type: "separate" | "integrated" | "none"
  ): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);
    const techStack = this.getCompleteTechStack(projectData);
    const features = this.getCompleteFeatures(projectData);
    const useCaseDiagrams = this.getUseCaseDiagrams(projectData);

    let title = "Web Application Generation";
    let objective = "";
    let specifications = "";
    let instructions = "";

    switch (type) {
      case "separate":
        title = "Application Generation (Separate Configuration)";
        objective = `Create the main "${projectData.name}" application without integrated landing page.`;
        specifications = `## Application Specifications
- **Type**: Complete web application
- **Landing Page**: Separate (managed in another chat)
- **Focus**: Business features and user interface`;
        instructions = `## Instructions
- Create a complete and functional web application
- Implement all required business features based on use case diagrams
- Ensure excellent UX/UI with brand consistency
- Optimize performance and security
- Include authentication and user management
- Landing page will be managed separately
- Use the provided brand assets and design system`;
        break;
      case "integrated":
        title = "Application Generation with Integrated Landing Page";
        objective = `Create a complete "${projectData.name}" web application with integrated landing page.`;
        specifications = `## Architecture
- **Type**: Monolithic application with integrated landing page
- **Structure**: Landing page + Application in the same project
- **Routing**: Separate routes for landing (/), app (/app/*, /dashboard/*, etc.)

## Integrated Landing Page Sections
1. **Hero Section**: Product presentation
2. **Features**: Main features
3. **Benefits**: User advantages
4. **CTA**: Buttons to signup/login
5. **Footer**: Legal information`;
        instructions = `## Instructions
- Create a complete application with integrated landing page
- Use a routing system to separate landing and app
- Ensure smooth transition between landing and application
- Implement authentication with appropriate redirection
- Optimize for SEO on the landing page
- Maintain design consistency between landing and app
- Use the provided brand assets throughout
- Implement all features based on use case diagrams`;
        break;
      case "none":
        title = "Web Application Generation";
        objective = `Create the "${projectData.name}" web application without landing page.`;
        specifications = `## Specifications
- **Type**: Pure web application
- **Landing Page**: None
- **Focus**: User interface and business features only`;
        instructions = `## Instructions
- Create a complete and functional web application
- Start directly with authentication interface or dashboard
- Implement all required business features based on use case diagrams
- Ensure excellent UX/UI with brand consistency
- Optimize performance and security
- Include complete user management
- Use the provided brand assets and design system`;
        break;
    }

    return `# ${title}

${projectInfo}

${brandInfo}

## Objective
${objective}

${specifications}

${techStack}

${features}

${useCaseDiagrams}

${instructions}

Generate the complete application code with all necessary files.`;
  }

  /**
   * Get complete project information
   */
  private getCompleteProjectInfo(projectData: ProjectModel): string {
    return `## Project Information
- **Name**: ${projectData.name}
- **Description**: ${projectData.description || "No description provided"}
- **Type**: ${projectData.type || "web"}
- **Scope**: ${projectData.scope || "Not specified"}
- **Targets**: ${Array.isArray(projectData.targets) ? projectData.targets.join(", ") : projectData.targets || "Not specified"}`;
  }

  /**
   * Get complete brand information including logos
   */
  private getCompleteBrandInfo(projectData: ProjectModel): string {
    const branding = projectData.analysisResultModel?.branding;
    if (!branding)
      return "## Brand Information\n- No brand information specified";

    let brandInfo = "## Brand Information\n";

    // Logo information
    if (branding.logo) {
      brandInfo += `### Logo\n`;
      brandInfo += `- **Main Logo**: ${branding.logo.svg} (URL)\n`;
      brandInfo += `- **Concept**: ${branding.logo.concept}\n`;
      brandInfo += `- **Colors**: ${branding.logo.colors?.join(", ") || "Not specified"}\n`;
      brandInfo += `- **Fonts**: ${branding.logo.fonts?.join(", ") || "Not specified"}\n`;

      if (branding.logo.variations) {
        brandInfo += `- **Variations**:\n`;
        if (branding.logo.variations.lightBackground) {
          brandInfo += `  - Light Background: ${branding.logo.variations.lightBackground} (URL)\n`;
        }
        if (branding.logo.variations.darkBackground) {
          brandInfo += `  - Dark Background: ${branding.logo.variations.darkBackground} (URL)\n`;
        }
        if (branding.logo.variations.monochrome) {
          brandInfo += `  - Monochrome: ${branding.logo.variations.monochrome} (URL)\n`;
        }
      }
    }

    // Colors
    if (branding.colors) {
      brandInfo += `### Colors\n`;
      brandInfo += `- **Color Scheme**: ${branding.colors.name}\n`;
      brandInfo += `- **Reference**: ${branding.colors.url} (URL)\n`;
      if (branding.colors.colors) {
        brandInfo += `- **Primary**: ${branding.colors.colors.primary}\n`;
        brandInfo += `- **Secondary**: ${branding.colors.colors.secondary}\n`;
        brandInfo += `- **Accent**: ${branding.colors.colors.accent}\n`;
        brandInfo += `- **Background**: ${branding.colors.colors.background}\n`;
        brandInfo += `- **Text**: ${branding.colors.colors.text}\n`;
      }
    }

    // Typography
    if (branding.typography) {
      brandInfo += `### Typography\n`;
      brandInfo += `- **Font System**: ${branding.typography.name}\n`;
      brandInfo += `- **Reference**: ${branding.typography.url} (URL)\n`;
      brandInfo += `- **Primary Font**: ${branding.typography.primaryFont}\n`;
      brandInfo += `- **Secondary Font**: ${branding.typography.secondaryFont}\n`;
    }

    return brandInfo;
  }

  /**
   * Get complete technology stack information
   */
  private getCompleteTechStack(projectData: ProjectModel): string {
    const configs = projectData.analysisResultModel?.development?.configs;
    if (!configs) return "## Technology Stack\n- No technology stack specified";

    let techStack = "## Technology Stack\n";

    // Frontend
    if (configs.frontend) {
      techStack += `### Frontend\n`;
      techStack += `- **Framework**: ${configs.frontend.framework}`;
      if (configs.frontend.frameworkVersion) {
        techStack += ` v${configs.frontend.frameworkVersion}`;
      }
      techStack += `\n`;
      techStack += `- **Styling**: ${Array.isArray(configs.frontend.styling) ? configs.frontend.styling.join(", ") : configs.frontend.styling}\n`;

      if (configs.frontend.features) {
        techStack += `- **Frontend Features**: ${JSON.stringify(configs.frontend.features)}\n`;
      }
    }

    // Backend
    if (configs.backend) {
      techStack += `### Backend\n`;
      techStack += `- **Language**: ${configs.backend.language || "Not specified"}\n`;
      techStack += `- **Framework**: ${configs.backend.framework || "Not specified"}`;
      if (configs.backend.frameworkVersion) {
        techStack += ` v${configs.backend.frameworkVersion}`;
      }
      techStack += `\n`;
      techStack += `- **API Type**: ${configs.backend.apiType || "REST"}\n`;

      if (configs.backend.features) {
        techStack += `- **Backend Features**: ${JSON.stringify(configs.backend.features)}\n`;
      }
    }

    // Database
    if (configs.database) {
      techStack += `### Database\n`;
      techStack += `- **Provider**: ${configs.database.provider}`;
      if (configs.database.version) {
        techStack += ` v${configs.database.version}`;
      }
      techStack += `\n`;
    }

    // Project Configuration
    if (configs.projectConfig) {
      techStack += `### Project Configuration\n`;
      const projectConfig = configs.projectConfig;
      techStack += `- **Authentication**: ${projectConfig.authentication ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Authorization**: ${projectConfig.authorization ? "Enabled" : "Disabled"}\n`;
      techStack += `- **SEO**: ${projectConfig.seoEnabled ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Contact Form**: ${projectConfig.contactFormEnabled ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Analytics**: ${projectConfig.analyticsEnabled ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Internationalization**: ${projectConfig.i18nEnabled ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Performance Optimization**: ${projectConfig.performanceOptimized ? "Enabled" : "Disabled"}\n`;
      techStack += `- **Payment Integration**: ${projectConfig.paymentIntegration ? "Enabled" : "Disabled"}\n`;
    }

    return techStack;
  }

  /**
   * Get complete features information
   */
  private getCompleteFeatures(projectData: ProjectModel): string {
    const configs = projectData.analysisResultModel?.development?.configs;
    if (!configs) return "## Features\n- No features specified";

    let featuresInfo = "## Features to Implement\n";

    // Frontend features
    if (configs.frontend?.features) {
      featuresInfo += "### Frontend Features\n";
      const frontendFeatures = configs.frontend.features;
      if (Array.isArray(frontendFeatures)) {
        frontendFeatures.forEach((feature) => {
          featuresInfo += `- ${feature}\n`;
        });
      } else {
        Object.entries(frontendFeatures).forEach(([key, enabled]) => {
          if (enabled) {
            featuresInfo += `- ${key.charAt(0).toUpperCase() + key.slice(1)}\n`;
          }
        });
      }
      featuresInfo += "\n";
    }

    // Backend features
    if (configs.backend?.features) {
      featuresInfo += "### Backend Features\n";
      const backendFeatures = configs.backend.features;
      if (Array.isArray(backendFeatures)) {
        backendFeatures.forEach((feature) => {
          featuresInfo += `- ${feature}\n`;
        });
      } else {
        Object.entries(backendFeatures).forEach(([key, enabled]) => {
          if (enabled) {
            featuresInfo += `- ${key.charAt(0).toUpperCase() + key.slice(1)}\n`;
          }
        });
      }
      featuresInfo += "\n";
    }

    // Project configuration features
    if (configs.projectConfig) {
      featuresInfo += "### Project Features\n";
      const projectConfig = configs.projectConfig;
      if (projectConfig.authentication)
        featuresInfo += "- User Authentication\n";
      if (projectConfig.authorization) featuresInfo += "- User Authorization\n";
      if (projectConfig.seoEnabled) featuresInfo += "- SEO Optimization\n";
      if (projectConfig.contactFormEnabled) featuresInfo += "- Contact Form\n";
      if (projectConfig.analyticsEnabled)
        featuresInfo += "- Analytics Integration\n";
      if (projectConfig.i18nEnabled) featuresInfo += "- Internationalization\n";
      if (projectConfig.performanceOptimized)
        featuresInfo += "- Performance Optimization\n";
      if (projectConfig.paymentIntegration)
        featuresInfo += "- Payment Integration\n";
    }

    return featuresInfo || "## Features\n- No features specified";
  }

  /**
   * Get use case diagrams information
   */
  private getUseCaseDiagrams(projectData: ProjectModel): string {
    const diagrams = projectData.analysisResultModel?.design;
    if (!diagrams || !diagrams.sections || diagrams.sections.length === 0) {
      return "## Use Case Diagrams\n- No use case diagrams specified";
    }

    let diagramsInfo = "## Use Case Diagrams\n";
    diagramsInfo +=
      "**IMPORTANT**: Implement the application based on these use case diagrams:\n\n";

    diagrams.sections.forEach((section, index) => {
      diagramsInfo += `### ${section.name}\n`;
      diagramsInfo += `- **Type**: ${section.type}\n`;
      diagramsInfo += `- **Summary**: ${section.summary}\n`;
      if (section.data) {
        diagramsInfo += `- **Details**: ${JSON.stringify(section.data, null, 2)}\n`;
      }
      diagramsInfo += `\n`;
    });

    return diagramsInfo;
  }
}
