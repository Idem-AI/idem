import { Component, inject, signal, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { QuickDeploymentModel } from '../../../../../models/deployment.model';
import {
  DeploymentFormData,
  DeploymentValidators,
} from '../../../../../models/api/deployments/deployments.api.model';
import { CookieService } from '../../../../../../../shared/services/cookie.service';
import { DeploymentService } from '../../../../../services/deployment.service';

@Component({
  selector: 'app-quick-deployment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './quick-deployment.html',
  styleUrl: './quick-deployment.css',
})
export class QuickDeployment implements OnInit {
  // Angular properties (inputs, outputs, queries)

  // Quick deployment state signals
  protected readonly gitBranches = signal<string[]>([]);
  protected readonly loadingGitInfo = signal<boolean>(false);
  protected readonly loadingDeployment = signal<boolean>(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly errorMessages = signal<string[]>([]);
  protected readonly validationErrors = signal<string[]>([]);

  // Form controls
  protected deploymentForm: FormGroup;

  // Services
  private readonly formBuilder = inject(FormBuilder);
  private readonly cookieService = inject(CookieService);
  private readonly deploymentService = inject(DeploymentService);
  private readonly router = inject(Router);

  constructor() {
    this.deploymentForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      environment: ['development', Validators.required],
      repoUrl: [''],
      branch: ['main'],
    });
  }

  ngOnInit(): void {
    // Initialize project ID from cookie
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      console.error('No project ID found in cookies');
      this.errorMessages.set([
        'No project selected. Please select a project first.',
      ]);
    } else {
      this.projectId.set(projectId);
      console.log('Quick deployment initialized with project ID:', projectId);
    }

    // Set up form validation
    this.setupFormValidation();
  }

  private clearErrors(): void {
    this.errorMessages.set([]);
    this.validationErrors.set([]);
  }

  // --- SETUP METHODS ---
  private setupFormValidation(): void {
    this.deploymentForm.valueChanges.subscribe(() => {
      this.validateCurrentForm();
    });
  }

  protected fetchGitBranches(): void {
    const repoUrl = this.deploymentForm.get('repoUrl')?.value;
    if (!repoUrl) {
      this.errorMessages.set(['Please enter a valid repository URL']);
      return;
    }

    this.loadingGitInfo.set(true);
    this.clearErrors();

    // In a real implementation, we would call a service to fetch branches
    // For now, we're simulating the API call with a timeout
    setTimeout(() => {
      // Mock data for branches
      this.gitBranches.set([
        'main',
        'develop',
        'feature/auth',
        'feature/dashboard',
      ]);
      this.loadingGitInfo.set(false);
    }, 1000);
  }

  private getFormData(): DeploymentFormData {
    const formValue = this.deploymentForm.value;

    return {
      mode: 'beginner',
      name: formValue.name,
      environment: formValue.environment,
      repoUrl: formValue.repoUrl,
      branch: formValue.branch,
    };
  }

  private validateCurrentForm(): void {
    const formData = this.getFormData();
    const errors: string[] = [];

    // Complete form validation
    errors.push(...DeploymentValidators.validateFormData(formData));

    // Git repository validation (if provided)
    if (formData.repoUrl) {
      const gitRepo = {
        url: formData.repoUrl,
        branch: formData.branch || 'main',
        provider: 'github' as 'github' | 'gitlab' | 'bitbucket' | 'azure-repos',
      };
      errors.push(...DeploymentValidators.validateGitRepository(gitRepo));
    }

    this.validationErrors.set(errors);
  }

  protected createDeployment(): void {
    // Validate project ID
    if (!this.projectId()) {
      this.errorMessages.set([
        'No project selected. Please select a project first.',
      ]);
      return;
    }

    // Validate form
    if (!this.deploymentForm.valid) {
      this.errorMessages.set(['Please fill in all required fields.']);
      return;
    }

    this.loadingDeployment.set(true);
    this.clearErrors();

    // Get form data
    const formData = this.getFormData();

    // Use DeploymentMapper to create the deployment object
    const deploymentData: QuickDeploymentModel = {
      mode: 'beginner',
      name: formData.name,
      environment: formData.environment,
      id: '',
      projectId: this.projectId()!,
      status: 'configuring',
      createdAt: new Date(),
      updatedAt: new Date(),
      gitRepository: formData.repoUrl
        ? {
            url: formData.repoUrl,
            branch: formData.branch || 'main',
            provider: 'github',
          }
        : undefined,
    };

    // Log the payload for debugging
    console.log('Creating quick deployment with payload:', deploymentData);

    // Submit to service
    this.deploymentService.createQuickDeployment(deploymentData).subscribe({
      next: (deployment: QuickDeploymentModel) => {
        console.log('Quick deployment created successfully:', deployment);
        this.loadingDeployment.set(false);
        this.router.navigate(['/console/deployments']);
      },
      error: (error: any) => {
        console.error('Error creating quick deployment:', error);
        this.loadingDeployment.set(false);
        this.errorMessages.set([
          error.message || 'Failed to create quick deployment',
        ]);
      },
    });
  }
}
