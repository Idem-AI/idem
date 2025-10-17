import { Component, input, output, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProjectModel } from '../../../../models/project.model';
import { SafeHtmlPipe } from '../../../projects-list/safehtml.pipe';
import { ColorModel, TypographyModel } from '../../../../models/brand-identity.model';
import { LogoModel } from '../../../../models/logo.model';
import { environment } from '../../../../../../../environments/environment';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { Loader } from '../../../../../../components/loader/loader';

@Component({
  selector: 'app-project-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe, RouterModule, Loader],
  templateUrl: './project-summary.html',
  styleUrl: './project-summary.css',
})
export class ProjectSummaryComponent {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);

  // Angular inputs
  readonly project = input.required<ProjectModel>();
  readonly selectedLogo = input.required<string>();
  readonly selectedColor = input.required<string>();
  readonly selectedTypography = input.required<string>();
  readonly logos = input.required<LogoModel[]>();
  readonly colorPalettes = input.required<ColorModel[]>();
  readonly typographyOptions = input.required<TypographyModel[]>();
  readonly privacyPolicyAccepted = input.required<boolean>();
  readonly termsOfServiceAccepted = input.required<boolean>();
  readonly betaPolicyAccepted = input.required<boolean>();
  readonly marketingConsentAccepted = input.required<boolean>();

  // Angular outputs
  readonly privacyPolicyChange = output<boolean>();
  readonly termsOfServiceChange = output<boolean>();
  readonly betaPolicyChange = output<boolean>();
  readonly marketingConsentChange = output<boolean>();
  readonly finalizeProject = output<void>();

  // Component state
  protected readonly isBeta = signal(environment.isBeta);
  protected readonly isSubmitting = signal(false);

  protected readonly canSubmit = computed(() => {
    const requiredPolicies = this.privacyPolicyAccepted() && this.termsOfServiceAccepted();
    const betaRequired = this.isBeta() ? this.betaPolicyAccepted() : true;
    return requiredPolicies && betaRequired;
  });

  protected getSelectedLogo(): LogoModel | undefined {
    const logo = this.logos().find((logo) => logo.id === this.selectedLogo());
    console.log('Selected logo', logo);
    return logo;
  }

  protected getSelectedColor(): ColorModel | undefined {
    const color = this.colorPalettes().find((color) => color.id === this.selectedColor());
    console.log('Selected color', color);
    return color;
  }

  protected getSelectedTypography(): TypographyModel | undefined {
    const typography = this.typographyOptions().find(
      (typo) => typo.id === this.selectedTypography()
    );
    console.log('Selected typography', typography);
    return typography;
  }

  protected onPrivacyPolicyChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.privacyPolicyChange.emit(checkbox.checked);
  }

  protected onTermsOfServiceChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.termsOfServiceChange.emit(checkbox.checked);
  }

  protected onBetaPolicyChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.betaPolicyChange.emit(checkbox.checked);
  }

  protected onMarketingConsentChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.marketingConsentChange.emit(checkbox.checked);
  }

  protected submitProject(): void {
    if (this.canSubmit() && !this.isSubmitting()) {
      this.isSubmitting.set(true);

      const acceptanceData = {
        privacyPolicyAccepted: this.privacyPolicyAccepted(),
        termsOfServiceAccepted: this.termsOfServiceAccepted(),
        betaPolicyAccepted: this.betaPolicyAccepted(),
        marketingAccepted: this.marketingConsentAccepted(),
      };

      this.projectService.finalizeProjectCreation(this.project().id!, acceptanceData).subscribe({
        next: (response) => {
          this.clearProjectCookies();

          this.isSubmitting.set(false);
          this.finalizeProject.emit();
        },
        error: (error) => {
          console.error('Error finalizing project:', error);
          this.isSubmitting.set(false);
        },
      });
    }
  }

  private clearProjectCookies(): void {
    this.cookieService.remove('projectId');
    this.cookieService.remove('draftProject');
  }
}
