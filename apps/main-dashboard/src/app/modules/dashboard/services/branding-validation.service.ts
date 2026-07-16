import { Injectable } from '@angular/core';
import { ProjectModel } from '@idem/shared-models';

export interface BrandingCompletionStatus {
  isComplete: boolean;
  missingElements: string[];
  hasGeneratedContent?: boolean; // true if branding has generated logos/colors/typography waiting for selection
}

@Injectable({
  providedIn: 'root',
})
export class BrandingValidationService {
  /**
   * Check if project branding is complete
   */
  checkBrandingCompletion(project: ProjectModel | null): BrandingCompletionStatus {
    const missingElements: string[] = [];

    if (!project) {
      return { isComplete: false, missingElements: ['project'], hasGeneratedContent: false };
    }

    const branding = project.analysisResultModel?.branding as any;

    if (branding?.isComplete) {
      return {
        isComplete: true,
        missingElements: [],
        hasGeneratedContent: false,
      };
    }

    // Check if there's generated content waiting for selection
    const hasGeneratedLogos = branding?.generatedLogos && branding.generatedLogos.length > 0;
    const hasGeneratedColors = branding?.generatedColors && branding.generatedColors.length > 0;
    const hasGeneratedTypography = branding?.generatedTypography && branding.generatedTypography.length > 0;
    const hasGeneratedContent = hasGeneratedLogos || hasGeneratedColors || hasGeneratedTypography;

    // Check for logo (selected logo or generated logos waiting for selection)
    if (!branding?.logo || !branding?.logo?.svg) {
      if (!hasGeneratedLogos) {
        missingElements.push('Logo');
      }
    }

    // Check for colors
    if (!branding?.colors && !hasGeneratedColors) {
      missingElements.push('Couleurs');
    }

    // Check for typography
    if (!branding?.typography && !hasGeneratedTypography) {
      missingElements.push('Typographies');
    }

    return {
      isComplete: missingElements.length === 0,
      missingElements,
      hasGeneratedContent,
    };
  }

  /**
   * Get user-friendly message for incomplete branding
   */
  getIncompleteBrandingMessage(missingElements: string[]): string {
    if (missingElements.length === 0) return '';
    
    const elements = missingElements.join(', ');
    return `Veuillez d'abord compléter l'identité de marque de votre projet (${elements}) avant d'accéder à cette fonctionnalité.`;
  }
}
