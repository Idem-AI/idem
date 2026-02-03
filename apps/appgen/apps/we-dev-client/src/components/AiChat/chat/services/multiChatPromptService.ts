import { ProjectModel } from '@/api/persistence/models/project.model';

export class MultiChatPromptService {
  /**
   * Generate the appropriate prompt based on LandingPageConfig and ChatType
   */
  generatePrompt(projectData: ProjectModel): string {
    return this.generateLandingOnlyPrompt(projectData);
  }

  /**
   * Generate prompt for ONLY_LANDING config (landing page only)
   */
  private generateLandingOnlyPrompt(projectData: ProjectModel): string {
    return this.generateLandingPagePrompt(projectData);
  }

  /**
   * Generate comprehensive landing page prompt
   */
  private generateLandingPagePrompt(projectData: ProjectModel): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    const title = 'Landing Page Generation';

    return `# ${title}

${projectInfo}

${brandInfo}

Generate the complete landing page code with all necessary files.`;
  }

  /**
   * Generate comprehensive application prompt
   */
  private generateApplicationPrompt(
    projectData: ProjectModel,
    type: 'separate' | 'integrated' | 'none'
  ): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    let title = 'Web Application Generation';

    return `# ${title}

${projectInfo}

${brandInfo}

Generate the complete application code with all necessary files.`;
  }

  /**
   * Get complete project information
   */
  private getCompleteProjectInfo(projectData: ProjectModel): string {
    const typeStr =
      typeof projectData.type === 'object'
        ? JSON.stringify(projectData.type)
        : projectData.type || 'web';
    const scopeStr =
      typeof projectData.scope === 'object'
        ? JSON.stringify(projectData.scope)
        : projectData.scope || 'Not specified';
    const targetsStr = Array.isArray(projectData.targets)
      ? projectData.targets.join(', ')
      : typeof projectData.targets === 'object'
        ? JSON.stringify(projectData.targets)
        : projectData.targets || 'Not specified';

    return `## Project Information
- **Name**: ${projectData.name}
- **Description**: ${projectData.description || 'No description provided'}
- **Type**: ${typeStr}
- **Scope**: ${scopeStr}
- **Targets**: ${targetsStr}`;
  }

  /**
   * Get complete brand information including logos
   */
  private getCompleteBrandInfo(projectData: ProjectModel): string {
    const branding = projectData.analysisResultModel?.branding;
    if (!branding) return '## Brand Information\n- No brand information specified';

    let brandInfo = '## Brand Information\n';

    // Logo information - simplified to just URL
    if (branding.logo) {
      brandInfo += `### Logo\n`;
      brandInfo += `- **Logo URL**: ${branding.logo.svg}\n`;
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
}
