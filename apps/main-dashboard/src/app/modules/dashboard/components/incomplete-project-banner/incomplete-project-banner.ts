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
    const branding = this.project().analysisResultModel?.branding;

    if (!branding?.logo) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.logo'));
    }
    if (!branding?.colors || !branding?.generatedColors?.length) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.colors'));
    }
    if (!branding?.typography || !branding?.generatedTypography?.length) {
      missing.push(this.translate.instant('dashboard.incompleteBanner.elements.typography'));
    }

    return missing;
  }

  protected get isIncomplete(): boolean {
    return this.missingElements.length > 0;
  }

  protected onCompleteClick(): void {
    this.router.navigate(['/project/complete-branding']);
  }
}
