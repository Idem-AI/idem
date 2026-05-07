import { Injectable } from '@angular/core';
import { ProjectModel } from '@idem/shared-models';

export interface BrandingCompletionStatus {
  isComplete: boolean;
  missingElements: string[];
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
      return { isComplete: false, missingElements: ['project'] };
    }

    const branding = project.analysisResultModel?.branding;

    // Check for logo
    if (!branding?.logo || !branding?.logo?.svg) {
      missingElements.push('Logo');
    }

    // Check for colors
    if (!branding?.colors || !branding?.generatedColors || branding.generatedColors.length === 0) {
      missingElements.push('Couleurs');
    }

    // Check for typography
    if (
      !branding?.typography ||
      !branding?.generatedTypography ||
      branding.generatedTypography.length === 0
    ) {
      missingElements.push('Typographies');
    }

    return {
      isComplete: missingElements.length === 0,
      missingElements,
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
