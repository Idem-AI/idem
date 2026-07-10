import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-incomplete-project-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './incomplete-project-banner.html',
  styleUrl: './incomplete-project-banner.css',
})
export class IncompleteProjectBannerComponent {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  readonly project = input.required<ProjectModel>();
  readonly completeProject = output<void>();

  protected get missingElements(): string[] {
    const missing: string[] = [];
    const branding = this.project().analysisResultModel?.branding as any;

    // Si le workflow est terminé (isComplete === true), rien ne manque
    if (branding?.isComplete) {
      return [];
    }

    // Pas de branding du tout → tout manque
    if (!branding) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.logo'));
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.colors'));
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.typography'));
      return missing;
    }

    if (!branding.logo) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.logo'));
    } else if (!branding.logo.variations?.withText) {
      // Logo sélectionné mais variations non générées → workflow non terminé
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.logo'));
    }
    if (!branding.colors && (!branding.generatedColors || !branding.generatedColors.length)) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.colors'));
    }
    if (!branding.typography && (!branding.generatedTypography || !branding.generatedTypography.length)) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.typography'));
    }

    // Même si rien ne manque individuellement, si isComplete n'est pas true, on considère le workflow incomplet
    if (missing.length === 0 && !branding.isComplete) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.logo'));
    }

    return missing;
  }

  protected get isIncomplete(): boolean {
    const branding = this.project().analysisResultModel?.branding as any;
    // Incomplet tant que le workflow n'a pas été finalisé
    if (branding && !branding.isComplete) {
      return true;
    }
    return this.missingElements.length > 0;
  }

  protected onCompleteClick(): void {
    this.router.navigate(['/project/complete-branding']);
  }
}
