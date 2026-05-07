import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';

@Component({
  selector: 'app-incomplete-project-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './incomplete-project-banner.html',
  styleUrl: './incomplete-project-banner.css',
})
export class IncompleteProjectBannerComponent {
  readonly project = input.required<ProjectModel>();
  readonly completeProject = output<void>();

  protected get missingElements(): string[] {
    const missing: string[] = [];
    const branding = this.project().analysisResultModel?.branding;

    if (!branding?.logo) {
      missing.push('Logo');
    }
    if (!branding?.colors || !branding?.generatedColors?.length) {
      missing.push('Couleurs');
    }
    if (!branding?.typography || !branding?.generatedTypography?.length) {
      missing.push('Typographies');
    }

    return missing;
  }

  protected get isIncomplete(): boolean {
    return this.missingElements.length > 0;
  }

  protected onCompleteClick(): void {
    this.completeProject.emit();
  }
}
