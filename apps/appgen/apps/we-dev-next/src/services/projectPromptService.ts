import { ProjectModel } from '../types/project.js';
import { generateDockerfilePrompt } from '../config/dockerfilePrompt.js';

enum LandingPageConfig {
  NONE = 'NONE',
  INTEGRATED = 'INTEGRATED',
  SEPARATE = 'SEPARATE',
  ONLY_LANDING = 'ONLY_LANDING',
}

export class ProjectPromptService {
  /**
   * Generate the complete prompt based on ProjectModel
   */
  generatePrompt(projectData: ProjectModel): string {
    console.log('🔧 ProjectPromptService.generatePrompt called');
    console.log('Project data structure:', {
      name: projectData.name,
      description: projectData.description,
      type: projectData.type,
      hasAnalysisResult: !!projectData.analysisResultModel,
      hasConfigs: !!projectData.analysisResultModel?.development?.configs,
      landingPageConfig: projectData.analysisResultModel?.development?.configs?.landingPageConfig,
    });

    const landingPageConfig =
      projectData.analysisResultModel?.development?.configs?.landingPageConfig ||
      LandingPageConfig.NONE;

    console.log('Using landing page config:', landingPageConfig);

    let prompt = '';

    switch (landingPageConfig) {
      case LandingPageConfig.SEPARATE:
        console.log('📝 Generating SEPARATE application prompt');
        prompt = this.generateApplicationPrompt(projectData, 'separate');
        break;
      case LandingPageConfig.INTEGRATED:
        console.log('📝 Generating INTEGRATED application prompt');
        prompt = this.generateApplicationPrompt(projectData, 'integrated');
        break;
      case LandingPageConfig.ONLY_LANDING:
        console.log('📝 Generating LANDING ONLY prompt');
        prompt = this.generateLandingOnlyPrompt(projectData);
        break;
      case LandingPageConfig.NONE:
      default:
        console.log('📝 Generating DEFAULT application prompt (NONE config)');
        prompt = this.generateApplicationPrompt(projectData, 'none');
        break;
    }

    console.log('Generated base prompt length:', prompt.length);

    // Add Dockerfile prompt
    const dockerPrompt = generateDockerfilePrompt(projectData);
    console.log('🐳 Docker prompt length:', dockerPrompt.length);
    prompt += dockerPrompt;

    console.log('✅ Final generated prompt length:', prompt.length);

    if (!prompt || prompt.trim().length === 0) {
      console.error('❌ CRITICAL: Generated prompt is empty!');
      throw new Error('Generated prompt is empty - check project data structure');
    }

    return prompt;
  }

  private generateLandingOnlyPrompt(projectData: ProjectModel): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    // Pour les landing pages, utiliser des valeurs par défaut si les configs sont undefined
    const techStack = this.getTechStackForLandingPage(projectData);

    return `# Landing Page Only Generation

${projectInfo}

${brandInfo}

## Objective
Create a standalone landing page for "${projectData.name}" without any application functionality.

## Landing Page Specifications
- **Type**: Marketing landing page only
- **Goal**: Present the product, convert visitors to users
- **Integration**: No application integration needed

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
- Create a high-converting standalone landing page
- Focus on marketing and conversion optimization
- Implement modern design with smooth animations
- Optimize for SEO and performance
- Include clear call-to-action buttons
- Make it fully responsive across all devices
- Use the provided brand assets and colors
- No application functionality needed

## TARGET AUDIENCE - SUB-SAHARAN AFRICA (CRITICAL)
This platform primarily targets Sub-Saharan Africa. ALL generated content MUST reflect this:

### Images of People
- ALWAYS use images featuring Black African people. NEVER use generic Western/European/Asian stock photos.
- Use Unsplash with search terms: "african business", "african woman", "african man", "african team", "black professional", "african entrepreneur"
- For avatars/testimonials: use diverse Black African faces (men, women, young professionals)
- For hero/team photos: show diverse African teams in modern work environments

### UI and Cultural Context
- Testimonials and user names MUST use African names (e.g., Amara Diallo, Kwame Asante, Fatou Ndiaye, Chidi Okonkwo, Aisha Mbeki)
- Locations MUST reference African cities (Lagos, Nairobi, Dakar, Accra, Douala, Abidjan, Kigali, Johannesburg)
- Currency references: use local currencies (XAF/FCFA, NGN, KES, GHS, XOF) or USD
- Phone numbers: use African country codes (+237, +234, +254, +233, +225)

### Content and Messaging
- Use inclusive language that resonates with African audiences
- Social proof should mention African companies, organizations, or communities
- Success stories should feature African entrepreneurs and businesses
- Placeholder company names should be African-sounding or Africa-based

Generate the complete landing page code with all necessary files.`;
  }

  private getTechStackForLandingPage(projectData: ProjectModel): string {
    const configs = projectData.analysisResultModel?.development?.configs;

    // Valeurs par défaut pour une landing page moderne
    const defaultFrontend = {
      framework: 'React',
      frameworkVersion: '18',
      styling: ['TailwindCSS', 'CSS3'],
    };

    const framework = configs?.frontend?.framework || defaultFrontend.framework;
    const frameworkVersion =
      configs?.frontend?.frameworkVersion || defaultFrontend.frameworkVersion;

    let styling = defaultFrontend.styling;
    if (configs?.frontend?.styling) {
      styling = Array.isArray(configs.frontend.styling)
        ? configs.frontend.styling
        : [configs.frontend.styling];
    }

    let techStack = '## Technology Stack\n';
    techStack += '### Frontend\n';
    techStack += `- **Framework**: ${framework} v${frameworkVersion}\n`;
    techStack += `- **Styling**: ${styling.join(', ')}\n`;
    techStack += `- **Build Tool**: Vite\n`;
    techStack += `- **Package Manager**: npm\n\n`;

    techStack += '### Optimization\n';
    techStack += `- **SEO**: Enabled (meta tags, structured data, sitemap)\n`;
    techStack += `- **Performance**: Enabled (lazy loading, code splitting, image optimization)\n`;
    techStack += `- **Responsive Design**: Mobile-first approach\n`;
    techStack += `- **Animations**: Smooth transitions and scroll effects\n\n`;

    return techStack;
  }

  private generateApplicationPrompt(
    projectData: ProjectModel,
    type: 'separate' | 'integrated' | 'none'
  ): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);
    const techStack = this.getCompleteTechStack(projectData);
    const features = this.getCompleteFeatures(projectData);
    const useCaseDiagrams = this.getUseCaseDiagrams(projectData);

    let title = 'Web Application Generation';
    let objective = '';
    let specifications = '';
    let instructions = '';

    switch (type) {
      case 'separate':
        title = 'Application Generation (Separate Configuration)';
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
- Use the provided brand assets and design system

${this.getAfricanAudienceDirectives()}`;
        break;
      case 'integrated':
        title = 'Application Generation with Integrated Landing Page';
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
- Implement all features based on use case diagrams

${this.getAfricanAudienceDirectives()}`;
        break;
      case 'none':
        title = 'Web Application Generation';
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
- Use the provided brand assets and design system

${this.getAfricanAudienceDirectives()}`;
        break;
    }

    return `# ${title}

${projectInfo}

${brandInfo}

## Objective
${objective}

${specifications}

${techStack}


Generate the complete application code with all necessary files.`;
  }

  private getCompleteProjectInfo(projectData: ProjectModel): string {
    console.log('🔍 getCompleteProjectInfo - Raw projectData.type:', projectData.type);
    return `## Project Information
- **Name**: ${projectData.name}
- **Description**: ${projectData.description || 'No description provided'}
`;
  }

  private getCompleteBrandInfo(projectData: ProjectModel): string {
    const branding = projectData.analysisResultModel?.branding;
    if (!branding) return '## Brand Information\n- No brand information specified';

    let brandInfo = '## Brand Information\n';

    if (branding.logo) {
      brandInfo += `### Logo\n`;
      brandInfo += `- **Main Logo**: ${branding.logo.svg} (URL)\n`;
      brandInfo += `- **Concept**: ${branding.logo.concept}\n`;
      brandInfo += `- **Colors**: ${branding.logo.colors?.join(', ') || 'Not specified'}\n`;
      brandInfo += `- **Fonts**: ${branding.logo.fonts?.join(', ') || 'Not specified'}\n`;

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

    if (branding.typography) {
      brandInfo += `### Typography\n`;
      brandInfo += `- **Font System**: ${branding.typography.name}\n`;
      brandInfo += `- **Reference**: ${branding.typography.url} (URL)\n`;
      brandInfo += `- **Primary Font**: ${branding.typography.primaryFont}\n`;
      brandInfo += `- **Secondary Font**: ${branding.typography.secondaryFont}\n`;
    }

    return brandInfo;
  }

  private getCompleteTechStack(projectData: ProjectModel): string {
    const configs = projectData.analysisResultModel?.development?.configs;
    if (!configs) return '## Technology Stack\n- No technology stack specified';

    let techStack = '## Technology Stack\n';

    if (configs.frontend) {
      techStack += `### Frontend\n`;
      techStack += `- **Framework**: ${configs.frontend.framework}`;
      if (configs.frontend.frameworkVersion) {
        techStack += ` v${configs.frontend.frameworkVersion}`;
      }
      techStack += `\n`;
      techStack += `- **Styling**: ${Array.isArray(configs.frontend.styling) ? configs.frontend.styling.join(', ') : configs.frontend.styling}\n`;

      if (configs.frontend.features) {
        techStack += `- **Frontend Features**: ${JSON.stringify(configs.frontend.features)}\n`;
      }
    }

    if (configs.backend) {
      techStack += `### Backend\n`;
      techStack += `- **Language**: ${configs.backend.language || 'Not specified'}\n`;
      techStack += `- **Framework**: ${configs.backend.framework || 'Not specified'}`;
      if (configs.backend.frameworkVersion) {
        techStack += ` v${configs.backend.frameworkVersion}`;
      }
      techStack += `\n`;
      techStack += `- **API Type**: ${configs.backend.apiType || 'REST'}\n`;

      if (configs.backend.features) {
        techStack += `- **Backend Features**: ${JSON.stringify(configs.backend.features)}\n`;
      }
    }

    if (configs.database) {
      techStack += `### Database\n`;
      techStack += `- **Provider**: ${configs.database.provider}`;
      if (configs.database.version) {
        techStack += ` v${configs.database.version}`;
      }
      techStack += `\n`;
    }

    if (configs.projectConfig) {
      techStack += `### Project Configuration\n`;
      const projectConfig = configs.projectConfig;
      techStack += `- **Authentication**: ${projectConfig.authentication ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Authorization**: ${projectConfig.authorization ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **SEO**: ${projectConfig.seoEnabled ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Contact Form**: ${projectConfig.contactFormEnabled ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Analytics**: ${projectConfig.analyticsEnabled ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Internationalization**: ${projectConfig.i18nEnabled ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Performance Optimization**: ${projectConfig.performanceOptimized ? 'Enabled' : 'Disabled'}\n`;
      techStack += `- **Payment Integration**: ${projectConfig.paymentIntegration ? 'Enabled' : 'Disabled'}\n`;
    }

    return techStack;
  }

  private getCompleteFeatures(projectData: ProjectModel): string {
    const configs = projectData.analysisResultModel?.development?.configs;
    if (!configs) return '## Features\n- No features specified';

    let featuresInfo = '## Features to Implement\n';

    if (configs.frontend?.features) {
      featuresInfo += '### Frontend Features\n';
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
      featuresInfo += '\n';
    }

    if (configs.backend?.features) {
      featuresInfo += '### Backend Features\n';
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
      featuresInfo += '\n';
    }

    if (configs.projectConfig) {
      featuresInfo += '### Project Features\n';
      const projectConfig = configs.projectConfig;
      if (projectConfig.authentication) featuresInfo += '- User Authentication\n';
      if (projectConfig.authorization) featuresInfo += '- User Authorization\n';
      if (projectConfig.seoEnabled) featuresInfo += '- SEO Optimization\n';
      if (projectConfig.contactFormEnabled) featuresInfo += '- Contact Form\n';
      if (projectConfig.analyticsEnabled) featuresInfo += '- Analytics Integration\n';
      if (projectConfig.i18nEnabled) featuresInfo += '- Internationalization\n';
      if (projectConfig.performanceOptimized) featuresInfo += '- Performance Optimization\n';
      if (projectConfig.paymentIntegration) featuresInfo += '- Payment Integration\n';
    }

    return featuresInfo || '## Features\n- No features specified';
  }

  private getUseCaseDiagrams(projectData: ProjectModel): string {
    const diagrams = projectData.analysisResultModel?.design;
    if (!diagrams || !diagrams.sections || diagrams.sections.length === 0) {
      return '## Use Case Diagrams\n- No use case diagrams specified';
    }

    let diagramsInfo = '## Use Case Diagrams\n';
    diagramsInfo +=
      '**IMPORTANT**: Implement the application based on these use case diagrams:\n\n';

    diagrams.sections.forEach((section) => {
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

  private getAfricanAudienceDirectives(): string {
    return `## TARGET AUDIENCE - SUB-SAHARAN AFRICA (CRITICAL)
This platform primarily targets Sub-Saharan Africa. ALL generated content MUST reflect this:

### Images of People
- ALWAYS use images featuring Black African people. NEVER use generic Western/European/Asian stock photos.
- Use Unsplash with search terms: "african business", "african woman", "african man", "african team", "black professional", "african entrepreneur"
- For avatars/testimonials: use diverse Black African faces (men, women, young professionals)
- For hero/team photos: show diverse African teams in modern work environments

### UI and Cultural Context
- Testimonials and user names MUST use African names (e.g., Amara Diallo, Kwame Asante, Fatou Ndiaye, Chidi Okonkwo, Aisha Mbeki)
- Locations MUST reference African cities (Lagos, Nairobi, Dakar, Accra, Douala, Abidjan, Kigali, Johannesburg)
- Currency references: use local currencies (XAF/FCFA, NGN, KES, GHS, XOF) or USD
- Phone numbers: use African country codes (+237, +234, +254, +233, +225)

### Content and Messaging
- Use inclusive language that resonates with African audiences
- Social proof should mention African companies, organizations, or communities
- Success stories should feature African entrepreneurs and businesses
- Placeholder company names should be African-sounding or Africa-based`;
  }
}
