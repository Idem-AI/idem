import { Component, input, output, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProjectModel } from '@idem/shared-models';
import { environment } from '../../../../../../../environments/environment';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../../../auth/services/auth.service';
import CreateProjectDatas, { SelectElement } from '../../datas';

@Component({
  selector: 'app-project-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Loader, TranslateModule],
  templateUrl: './project-summary.html',
  styleUrl: './project-summary.css',
})
export class ProjectSummaryComponent implements OnInit {
  // Services
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly landingUrl = environment.services.domain;

  // Angular inputs
  readonly project = input.required<ProjectModel>();
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

  protected readonly requiredCount = computed(() => (this.isBeta() ? 3 : 2));

  protected readonly acceptedCount = computed(() => {
    let count = 0;
    if (this.privacyPolicyAccepted()) count++;
    if (this.termsOfServiceAccepted()) count++;
    if (this.isBeta() && this.betaPolicyAccepted()) count++;
    return count;
  });

  protected readonly canSubmit = computed(() => {
    const requiredPolicies = this.privacyPolicyAccepted() && this.termsOfServiceAccepted();
    const betaRequired = this.isBeta() ? this.betaPolicyAccepted() : true;
    return requiredPolicies && betaRequired;
  });

  /** Résout un code d'option vers son libellé lisible (ou renvoie la valeur telle quelle). */
  private labelFromCode(value: unknown, options: SelectElement[]): string {
    if (typeof value === 'object' && value !== null) {
      return (value as any).name || JSON.stringify(value);
    }
    if (typeof value === 'string' && value) {
      return options.find((o) => o.code === value)?.name || value;
    }
    return 'Non spécifié';
  }

  // Computed properties for formatted display
  protected readonly formattedProjectType = computed(() =>
    this.labelFromCode(this.project().type, CreateProjectDatas.groupedProjectTypes),
  );

  protected readonly formattedScope = computed(() =>
    this.labelFromCode(this.project().scope, CreateProjectDatas.groupedScopes),
  );

  protected readonly formattedTargets = computed(() =>
    this.labelFromCode(this.project().targets, CreateProjectDatas.groupedTargets),
  );

  protected readonly formattedCurrency = computed(() => {
    const currency = (this.project() as any).currency;
    if (typeof currency === 'string' && currency.trim()) {
      return currency;
    }
    return 'Non spécifiée';
  });

  ngOnInit(): void {
    console.log('=== PROJECT SUMMARY DEBUG ===');
    console.log('Project:', this.project());
    console.log('============================');
  }

  protected togglePrivacyPolicy(): void {
    this.privacyPolicyChange.emit(!this.privacyPolicyAccepted());
  }

  protected toggleTermsOfService(): void {
    this.termsOfServiceChange.emit(!this.termsOfServiceAccepted());
  }

  protected toggleBetaPolicy(): void {
    this.betaPolicyChange.emit(!this.betaPolicyAccepted());
  }

  protected toggleMarketingConsent(): void {
    this.marketingConsentChange.emit(!this.marketingConsentAccepted());
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
      // Check if user is logged in
      const user = this.authService.getCurrentUser();
      if (!user) {
        // Redirect to login page
        const returnUrl = window.location.pathname + window.location.search;
        this.router.navigate(['/login'], { queryParams: { returnUrl } });
        return;
      }

      this.isSubmitting.set(true);

      const acceptanceData = {
        privacyPolicyAccepted: this.privacyPolicyAccepted(),
        termsOfServiceAccepted: this.termsOfServiceAccepted(),
        betaPolicyAccepted: this.betaPolicyAccepted(),
        marketingAccepted: this.marketingConsentAccepted(),
      };

      const brandingUpdate: Partial<ProjectModel> = {
        analysisResultModel: this.project().analysisResultModel,
      };

      this.projectService
        .updateProject(this.project().id!, brandingUpdate)
        .pipe(
          switchMap(() =>
            this.projectService.finalizeProjectCreation(this.project().id!, acceptanceData),
          ),
        )
        .subscribe({
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
    this.cookieService.remove('draftProjectStep');
  }
}
