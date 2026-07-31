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

    switch (type) {
      case 'separate':
        title = 'Application Generation (Separate Configuration)';
        objective = `Create the main "${projectData.name}" application. The landing page is built separately — do not include one.`;
        specifications = `## Application Specifications
- **Type**: Complete web application
- **Landing Page**: Separate (managed in another chat)
- **Entry point**: authentication surface or dashboard`;
        break;
      case 'integrated':
        title = 'Application Generation with Integrated Landing Page';
        objective = `Create a complete "${projectData.name}" web application with integrated landing page.`;
        specifications = `## Architecture
- **Type**: Monolithic application with integrated landing page
- **Routing**: landing at \`/\`, application under \`/app/*\` and \`/dashboard/*\`
- **Auth**: sign-in redirects into the application
- **Consistency**: one visual system across landing and app`;
        break;
      case 'none':
        title = 'Web Application Generation';
        objective = `Create the "${projectData.name}" web application without landing page.`;
        specifications = `## Specifications
- **Type**: Pure web application
- **Landing Page**: None
- **Entry point**: authentication surface or dashboard`;
        break;
    }

    // `features` and `useCaseDiagrams` used to be computed here and then dropped
    // from the returned template, so applications were generated with no idea
    // what they were supposed to do. They are part of the brief now.
    return [
      `# ${title}`,
      projectInfo,
      brandInfo,
      `## Objective\n${objective}`,
      specifications,
      techStack,
      features,
      useCaseDiagrams,
      'Generate the complete application code with all necessary files.',
    ]
      .filter((section) => section && section.trim().length > 0)
      .join('\n\n');
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
      brandInfo += this.getLogoSection(branding.logo, projectData.name);
    }

    // Raw brand values are named, not listed as usable colours: the token forge
    // has already turned them into a contrast-verified Tailwind palette above.
    // Repeating the hexes here is what makes models hardcode `bg-[#7C3AED]`
    // next to the tokens and drift off the system.
    if (branding.colors) {
      brandInfo += `### Colour scheme\n`;
      brandInfo += `- **Name**: ${branding.colors.name}\n`;
      brandInfo += `- Already converted into the \`brand\` / \`accent\` / \`surface\` / \`ink\` Tailwind tokens in the design system above. Use those tokens; do not hardcode hex values.\n`;
    }

    if (branding.typography) {
      brandInfo += `### Typography\n`;
      brandInfo += `- **Font System**: ${branding.typography.name} (${branding.typography.primaryFont} / ${branding.typography.secondaryFont})\n`;
      brandInfo += `- Already wired into \`fontFamily.display\` and \`fontFamily.sans\` above.\n`;
    }

    return brandInfo;
  }

  /**
   * Logo section of the prompt.
   *
   * A stored logo value is EITHER a hosted URL (bucket — the nominal case since
   * the assets were externalized) OR raw inline `<svg>` markup (projects created
   * before that, which are still the majority). Labelling markup as "(URL)" —
   * what this prompt used to do — makes the model emit `<img src="<svg ...>">`
   * or drop the logo altogether, which is why generated sites came out with no
   * logo at all. So each value is typed explicitly and comes with the matching
   * integration instructions.
   */
  private getLogoSection(
    logo: NonNullable<NonNullable<ProjectModel['analysisResultModel']>['branding']>['logo'],
    projectName: string
  ): string {
    if (!logo) return '';

    const assetUrls = logo.assetUrls;
    const variations = logo.variations;

    // A hosted URL always wins over inline markup, whichever field it sits in:
    // it costs a handful of tokens instead of a few thousand, and an <img src>
    // is far harder for the model to get wrong than hand-converted JSX markup.
    const pickBest = (...candidates: (string | undefined)[]): string | undefined => {
      const usable = candidates.map((c) => c?.trim()).filter((c): c is string => !!c);
      return usable.find((c) => !c.startsWith('<')) ?? usable[0];
    };

    const light = pickBest(
      assetUrls?.withText?.lightBackground,
      assetUrls?.primary,
      variations?.withText?.lightBackground,
      variations?.lightBackground,
      logo.svg
    );
    const dark = pickBest(
      assetUrls?.withText?.darkBackground,
      variations?.withText?.darkBackground,
      variations?.darkBackground
    );

    let section = `### Logo\n`;
    section += `- **Concept**: ${logo.concept}\n`;
    section += `- **Colors**: ${logo.colors?.join(', ') || 'Not specified'}\n`;
    section += `- **Fonts**: ${logo.fonts?.join(', ') || 'Not specified'}\n`;

    if (!light) {
      section += `- No logo asset available: use the project name "${projectName}" as a styled wordmark.\n`;
      return section;
    }

    section += `\n⚠️ LOGO IS MANDATORY: the header/navbar MUST display this logo (footer too when there is one).\n`;
    section += `Never replace it with an emoji, an icon-font glyph or a plain text wordmark.\n`;
    section += this.renderLogoAsset('Primary logo', light, projectName);

    // Second asset only when it is genuinely different AND cheap enough: a full
    // inline SVG can weigh several thousand characters, and burying the rest of
    // the brief under a duplicate of the same drawing costs more than the dark
    // variant is worth.
    const inlineBudget = ProjectPromptService.MAX_INLINE_LOGO_PAYLOAD_CHARS;
    const inlineWeight = (value: string) => (value.startsWith('<') ? value.length : 0);

    if (dark && dark !== light && inlineWeight(light) + inlineWeight(dark) <= inlineBudget) {
      section += this.renderLogoAsset('Dark-background version', dark, projectName);
    }

    return section;
  }

  /** Longest inline SVG worth pasting into the prompt (keeps the context sane). */
  private static readonly MAX_INLINE_SVG_CHARS = 8000;

  /** Above this, a second inline rendition is not worth its weight in context. */
  private static readonly MAX_INLINE_LOGO_PAYLOAD_CHARS = 4000;

  private renderLogoAsset(label: string, value: string, projectName: string): string {
    const isInlineSvg = value.startsWith('<');

    if (!isInlineSvg) {
      return (
        `\n**${label}** — hosted image, reference it by URL:\n` +
        `${value}\n` +
        `Use: <img src="${value}" alt="${projectName} logo" className="h-10 w-auto" />\n`
      );
    }

    if (value.length > ProjectPromptService.MAX_INLINE_SVG_CHARS) {
      return `\n**${label}** — inline SVG too large to embed; render the project name "${projectName}" as a styled wordmark instead.\n`;
    }

    return (
      `\n**${label}** — inline SVG markup (NOT a URL). Paste it directly into the JSX:\n` +
      '```svg\n' +
      `${value}\n` +
      '```\n' +
      `Rules: convert the attributes to JSX (fill-rule → fillRule, stroke-width → strokeWidth, ` +
      `style="fill:#abc" → style={{ fill: '#abc' }}), KEEP the viewBox, drop any width/height ` +
      `attribute and size it with a class (e.g. className="h-10 w-auto"). ` +
      `NEVER put this markup inside an <img src="..."> — an <img> cannot render raw SVG markup ` +
      `and the logo would silently stay blank.\n`
    );
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

  // The Sub-Saharan Africa directives used to be inlined here twice and in two
  // other files. They now live in a single skill (`src/skills/catalog/audience.md`)
  // loaded into the cacheable system prefix on every request.
}
