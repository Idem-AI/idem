import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { ProjectService } from '../services/project.service';
import { BrandingValidationService } from '../services/branding-validation.service';
import { CookieService } from '../../../shared/services/cookie.service';

export const brandingCompleteGuard: CanActivateFn = () => {
  const projectService = inject(ProjectService);
  const brandingValidation = inject(BrandingValidationService);
  const cookieService = inject(CookieService);
  const router = inject(Router);

  const projectId = cookieService.get('projectId');

  if (!projectId) {
    router.navigate(['/console/projects']);
    return false;
  }

  return projectService.getProjectById(projectId).pipe(
    map((project) => {
      const { isComplete, missingElements } = brandingValidation.checkBrandingCompletion(project);

      if (!isComplete) {
        // Redirect to dashboard with a message
        console.warn('Branding incomplete:', missingElements);
        router.navigate(['/console/project/dashboard'], {
          queryParams: { brandingIncomplete: true },
        });
        return false;
      }

      return true;
    })
  );
};
