import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import {
  CloudComponentDetailed,
  ArchitectureComponent,
  DeploymentModel,
  ExpertDeploymentModel,
} from '../../../../../models/deployment.model';
import {
  DeploymentFormData,
  DeploymentMapper,
} from '../../../../../models/api/deployments/deployments.api.model';
import { DeploymentService } from '../../../../../services/deployment.service';
import { Router } from '@angular/router';
import { CookieService } from '../../../../../../../shared/services/cookie.service';
import { Select } from 'primeng/select';
import { ALL_COMPONENTS_LIST } from './datas';

@Component({
  selector: 'app-expert-deployment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    ButtonModule,
    Select,
  ],
  templateUrl: './expert-deployment.html',
  styleUrl: './expert-deployment.css',
})
export class ExpertDeployment {
  // Expert mode state
  protected readonly expertSelectedProvider = signal<'aws' | 'gcp' | 'azure'>('aws');
  protected readonly expertSearchTerm = signal<string>('');
  protected readonly expertArchitecture = signal<ArchitectureComponent[]>([]);
  protected readonly activeExpertComponent = signal<ArchitectureComponent | null>(null);
  private readonly formBuilder = inject(FormBuilder);
  // Forms
  protected deploymentConfigForm: FormGroup;
  protected expertForm: FormGroup;
  protected readonly loadingDeployment = signal<boolean>(false);

  // Git repository state
  protected readonly gitBranches = signal<string[]>([]);
  protected readonly loadingGitInfo = signal<boolean>(false);

  /**
   * Fetches Git branches for the repository URL in the form
   */
  protected fetchGitBranches(): void {
    const repoUrl = this.deploymentConfigForm.get('repoUrl')?.value;

    if (!repoUrl || repoUrl.trim() === '') {
      this.gitBranches.set([]);
      return;
    }

    this.loadingGitInfo.set(true);

    this.deploymentService.validateGitRepository(repoUrl).subscribe({
      next: (branches) => {
        this.gitBranches.set(branches);

        // If branches are available and current branch is not in the list, select the first branch
        const currentBranch = this.deploymentConfigForm.get('branch')?.value;
        if (branches.length > 0 && !branches.includes(currentBranch)) {
          this.deploymentConfigForm.get('branch')?.setValue(branches[0]);
        }

        this.loadingGitInfo.set(false);
      },
      error: (error) => {
        console.error('Error fetching Git branches:', error);
        this.gitBranches.set([]);
        this.loadingGitInfo.set(false);
        // Don't show error message to user as this is optional
      },
    });
  }

  // Computed properties
  protected readonly filteredCatalogue = computed(() => this.getComponentCatalogue());
  // Utility method for template
  objectKeys = Object.keys;
  protected readonly cookiesService = inject(CookieService);
  protected readonly projectId = this.cookiesService.get('projectId');
  protected readonly deploymentService = inject(DeploymentService);
  protected readonly router = inject(Router);
  protected readonly errorMessages = signal<string[]>([]);
  protected readonly deploymentModel = signal<DeploymentModel | null>(null);
  protected readonly deploymentNameDialogVisible = signal<boolean>(false);

  protected getFormData(): DeploymentFormData {
    return {
      name: this.deploymentConfigForm.value.name,
      environment: this.deploymentConfigForm.value.environment,
      repoUrl: this.deploymentConfigForm.value.repoUrl,
      branch: this.deploymentConfigForm.value.branch,
      mode: 'expert',
    };
  }

  protected openDeploymentNameDialog(): void {
    this.deploymentNameDialogVisible.set(true);
  }

  protected submitDeployment(): void {
    if (this.deploymentConfigForm.invalid) {
      // Mark form controls as touched to show validation errors
      Object.keys(this.deploymentConfigForm.controls).forEach((key) => {
        this.deploymentConfigForm.get(key)?.markAsTouched();
      });
      return;
    }

    console.log('Creating deployment...');
    this.loadingDeployment.set(true);
    this.deploymentNameDialogVisible.set(false);

    // Get form data
    const formData = this.getFormData();

    // Add architecture components with their configurations
    formData.customComponents = this.expertArchitecture().map((comp) => {
      const config = this.expertForm.get(comp.instanceId)?.value || {};
      return {
        ...comp,
        configuration: config,
      };
    });

    // Use DeploymentMapper to create deployment object
    const deploymentData = DeploymentMapper.formDataToDeploymentModel(
      formData,
      this.projectId!
    ) as Partial<ExpertDeploymentModel>; // Utiliser type assertion pour garantir le bon type

    // Log payload for debugging
    console.log('Creating deployment with payload:', deploymentData);

    // Submit to service
    this.deploymentService.createExpertDeployment(deploymentData).subscribe({
      next: (deployment) => {
        console.log('Deployment created successfully:', deployment);
        this.loadingDeployment.set(false);
        this.router.navigate(['/console/deployments']);
      },
      error: (error) => {
        console.error('Error creating deployment:', error);
        this.loadingDeployment.set(false);
        this.errorMessages.set([error.message || 'Failed to create deployment']);
      },
    });
  }

  constructor() {
    this.deploymentConfigForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      environment: ['development', Validators.required],
      repoUrl: [''],
      branch: ['main'],
    });

    this.expertForm = this.formBuilder.group({});
  }

  // --- EXPERT MODE ---
  protected addComponentToArchitecture(componentId: string): void {
    const component = this.getComponentById(componentId);
    if (!component) return;

    const architectureComponent: ArchitectureComponent = {
      ...component,
      instanceId: `${component.id}_${Date.now()}`,
      configuration: {},
      dependencies: [],
      // Définir le type en utilisant la catégorie du composant
      type: component.category,
    };

    console.log('Architecture component:', architectureComponent);

    this.expertArchitecture.update((arch) => [...arch, architectureComponent]);

    // Create form group for this component
    if (component.options) {
      const formGroup = this.formBuilder.group({});
      component.options.forEach((option) => {
        const validators = option.required ? [Validators.required] : [];
        formGroup.addControl(
          option.name,
          this.formBuilder.control(option.defaultValue || '', validators)
        );
      });
      this.expertForm.addControl(architectureComponent.instanceId, formGroup);
    }
  }

  protected removeComponentFromArchitecture(instanceId: string): void {
    this.expertArchitecture.update((arch) => arch.filter((comp) => comp.instanceId !== instanceId));
    this.expertForm.removeControl(instanceId);

    // Clear active component if it was the one being removed
    if (this.activeExpertComponent()?.instanceId === instanceId) {
      this.activeExpertComponent.set(null);
    }
  }
  protected getActiveComponentForm(): FormGroup | null {
    const activeComponent = this.activeExpertComponent();
    return activeComponent ? (this.expertForm.get(activeComponent.instanceId) as FormGroup) : null;
  }

  protected getActiveComponentModel(): CloudComponentDetailed | null {
    const activeComponent = this.activeExpertComponent();
    return activeComponent ? this.getComponentById(activeComponent.id) || null : null;
  }

  protected selectComponentForConfiguration(component: ArchitectureComponent): void {
    this.activeExpertComponent.set(component);
  }

  private getComponentById(id: string): CloudComponentDetailed | undefined {
    const catalogue = this.getComponentCatalogue();
    for (const category of Object.values(catalogue)) {
      const component = category.find((comp) => comp.id === id);
      if (component) return component;
    }
    return undefined;
  }

  private getComponentCatalogue(): { [cat: string]: CloudComponentDetailed[] } {
    const provider = this.expertSelectedProvider();
    const term = this.expertSearchTerm().toLowerCase();

    const filteredComponents = ALL_COMPONENTS_LIST.filter(
      (c) =>
        c.provider === provider &&
        (c.name.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.category.toLowerCase().includes(term))
    );

    return filteredComponents.reduce(
      (acc, comp) => {
        (acc[comp.category] = acc[comp.category] || []).push(comp);
        return acc;
      },
      {} as { [cat: string]: CloudComponentDetailed[] }
    );
  }
}
