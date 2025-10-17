import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  ArchitectureTemplate,
  TemplateDeploymentModel,
} from '../../../../../models/deployment.model';
import {
  DeploymentFormData,
  DeploymentValidators,
} from '../../../../../models/api/deployments/deployments.api.model';
import { CookieService } from '../../../../../../../shared/services/cookie.service';
import { DeploymentService } from '../../../../../services/deployment.service';

const MOCK_TEMPLATES: ArchitectureTemplate[] = [
  {
    id: 'aws-3-tier',
    provider: 'aws',
    category: 'Web/API',
    name: '3-Tier Web Application (AWS)',
    description: 'EC2, ALB, and RDS for a standard and robust web application.',
    tags: ['High Availability', 'Scalability'],
    icon: 'pi pi-window-maximize',
  },
  {
    id: 'gcp-serverless',
    provider: 'gcp',
    category: 'Web/API',
    name: 'Serverless API (GCP)',
    description: 'Cloud Run and Firestore for a highly scalable API.',
    tags: ['Serverless', 'Cost Optimized'],
    icon: 'pi pi-bolt',
  },
  {
    id: 'azure-data-lake',
    provider: 'azure',
    category: 'Big Data',
    name: 'Data Lake (Azure)',
    description: 'Data Lake Storage and Synapse for data analysis.',
    tags: ['Big Data', 'ETL'],
    icon: 'pi pi-database',
  },
];
@Component({
  selector: 'app-template-deployment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './template-deployment.html',
  styleUrl: './template-deployment.css',
})
export class TemplateDeployment implements OnInit {
  // Angular properties (inputs, outputs, queries)

  // Template mode state signals
  protected readonly availableTemplates = signal<ArchitectureTemplate[]>([]);
  protected readonly selectedTemplate = signal<ArchitectureTemplate | null>(
    null
  );
  protected readonly loadingDeployment = signal<boolean>(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly errorMessages = signal<string[]>([]);
  protected readonly validationErrors = signal<string[]>([]);
  protected readonly templateVersion = signal<string>('1.0');

  // Form controls
  protected deploymentConfigForm: FormGroup;

  // Services
  private readonly formBuilder = inject(FormBuilder);
  private readonly cookieService = inject(CookieService);
  private readonly deploymentService = inject(DeploymentService);
  private readonly router = inject(Router);

  constructor() {
    this.deploymentConfigForm = this.formBuilder.group({
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
      console.log(
        'Template deployment initialized with project ID:',
        projectId
      );
    }

    // Load available templates
    this.loadAvailableTemplates();

    // Set up form validation
    this.setupFormValidation();
  }

  private loadAvailableTemplates(): void {
    this.availableTemplates.set(MOCK_TEMPLATES);
  }

  private clearErrors(): void {
    this.errorMessages.set([]);
    this.validationErrors.set([]);
  }

  // --- SETUP METHODS ---
  private setupFormValidation(): void {
    this.deploymentConfigForm.valueChanges.subscribe(() => {
      this.validateCurrentForm();
    });
  }

  protected selectTemplate(template: ArchitectureTemplate): void {
    this.selectedTemplate.set(template);
    this.validateCurrentForm();
  }

  private getFormData(): DeploymentFormData {
    const formValue = this.deploymentConfigForm.value;
    const selectedTemplate = this.selectedTemplate();

    return {
      mode: 'template',
      name: formValue.name,
      environment: formValue.environment,
      repoUrl: formValue.repoUrl,
      branch: formValue.branch,
      templateId: selectedTemplate?.id,
      templateName: selectedTemplate?.name,
      templateVersion: this.templateVersion(),
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

    // Template validation
    if (!this.selectedTemplate()) {
      errors.push('Please select an architecture template');
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
    if (!this.deploymentConfigForm.valid) {
      this.errorMessages.set(['Please fill in all required fields.']);
      return;
    }

    // Validate template selection
    if (!this.selectedTemplate()) {
      this.errorMessages.set(['Please select a template.']);
      return;
    }

    this.loadingDeployment.set(true);
    this.clearErrors();

    // Get form data
    const formData = this.getFormData();

    // Generate architecture components from the selected template
    if (this.selectedTemplate()) {
      // In a real implementation, we would generate components based on the template
      // For now, we're using an empty array as a placeholder
      formData.customComponents = [];

      // Add customizations if needed
      formData.customizations = {
        provider: this.selectedTemplate()?.provider,
        category: this.selectedTemplate()?.category,
      };
    }

    // Use DeploymentMapper to create the deployment object
    const deploymentData: TemplateDeploymentModel = {
      mode: 'template',
      templateId: this.selectedTemplate()?.id!,
      templateName: this.selectedTemplate()?.name!,
      templateVersion: this.templateVersion(),
      name: formData.name,
      environment: formData.environment,
      id: '',
      projectId: this.projectId()!,
      status: 'configuring',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Log the payload for debugging
    console.log('Creating template deployment with payload:', deploymentData);

    // Submit to service
    this.deploymentService.createTemplateDeployment(deploymentData).subscribe({
      next: (deployment) => {
        console.log('Template deployment created successfully:', deployment);
        this.loadingDeployment.set(false);
        this.router.navigate(['/console/deployments']);
      },
      error: (error) => {
        console.error('Error creating template deployment:', error);
        this.loadingDeployment.set(false);
        this.errorMessages.set([
          error.message || 'Failed to create template deployment',
        ]);
      },
    });
  }
}
