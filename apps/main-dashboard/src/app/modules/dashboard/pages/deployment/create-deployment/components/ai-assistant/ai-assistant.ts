import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import {
  AiAssistantDeploymentModel,
  ChatMessage,
  ArchitectureComponent,
  FormOption,
  SensitiveVariable,
  SensitiveVariableValue,
  StoreSensitiveVariablesRequest,
} from '../../../../../models/deployment.model';
import {
  DeploymentFormData,
  DeploymentValidators,
} from '../../../../../models/api/deployments/deployments.api.model';
import { CookieService } from '../../../../../../../shared/services/cookie.service';
import { DeploymentService } from '../../../../../services/deployment.service';
import { AuthService } from '../../../../../../auth/services/auth.service';
import { MarkdownModule } from 'ngx-markdown';

// Import Prism core only - specific languages are already imported in app.config.ts
import 'prismjs';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MarkdownModule, DialogModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.css',
})
export class AiAssistant implements OnInit, AfterViewInit {
  // Angular properties (inputs, outputs, queries)
  @ViewChild('chatContainer', { static: false }) chatContainer!: ElementRef;

  // AI Assistant state signals
  protected readonly chatMessages = signal<ChatMessage[]>([]);
  protected readonly aiPrompt = signal<string>('');
  protected readonly aiIsThinking = signal<boolean>(false);
  // Removed showDeploymentForm - chat now takes full container
  protected readonly loadingDeployment = signal<boolean>(false);
  protected readonly projectId = signal<string | null>(null);
  protected readonly errorMessages = signal<string[]>([]);
  protected readonly validationErrors = signal<string[]>([]);
  protected readonly generatedArchitecture = signal<boolean>(false);
  protected readonly generatedComponents = signal<ArchitectureComponent[] | null>(null);

  // Architecture proposal signals
  protected readonly activeProposedComponent = signal<ArchitectureComponent | null>(null);
  protected readonly configurationDialogVisible = signal<boolean>(false);
  protected readonly currentProposalMessage = signal<ChatMessage | null>(null);
  protected readonly configuredComponents = signal<Set<string>>(new Set<string>());

  // Architecture component forms
  private readonly componentForms = new Map<string, FormGroup>();

  // Deployment configuration modal
  protected readonly showDeploymentConfigDialog = signal<boolean>(false);
  protected readonly creatingDeployment = signal<boolean>(false);

  // Sensitive variables handling
  protected readonly showSensitiveVariablesDialog = signal<boolean>(false);
  protected readonly currentSensitiveVariables = signal<SensitiveVariable[]>([]);
  protected readonly sensitiveVariablesForm = signal<FormGroup | null>(null);
  protected readonly storingSensitiveVariables = signal<boolean>(false);
  protected readonly currentDeploymentId = signal<string | null>(null);
  protected readonly sensitiveVariablesReady = signal<boolean>(false);

  // Computed values
  protected readonly hasUnacceptedArchitecture = computed(() => {
    return (
      this.chatMessages().some(
        (msg) =>
          msg.isProposingArchitecture &&
          msg.proposedComponents &&
          msg.proposedComponents.length > 0,
      ) && !this.generatedArchitecture()
    );
  });

  // Form controls
  protected deploymentConfigForm: FormGroup;

  // Services
  private readonly formBuilder = inject(FormBuilder);
  private readonly cookieService = inject(CookieService);
  private readonly deploymentService = inject(DeploymentService);
  private readonly authService = inject(AuthService);
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
    // Reset the architecture state at initialization
    this.generatedArchitecture.set(false);
    this.generatedComponents.set(null);

    // Initialize project ID from cookie
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      console.error('No project ID found in cookies');
      this.errorMessages.set(['No project selected. Please select a project first.']);
    } else {
      this.projectId.set(projectId);
      console.log('AI Assistant initialized with project ID:', projectId);

      // Add initial greeting message
      this.addInitialGreeting();
    }

    // Try to restore deployment ID from cookie if it exists
    const savedDeploymentId = this.cookieService.get(`deploymentId_${projectId}`);
    if (savedDeploymentId) {
      this.currentDeploymentId.set(savedDeploymentId);
      console.log('Restored deployment ID from cookie:', savedDeploymentId);
    }

    // Auto-scroll effect when messages change
    effect(() => {
      this.chatMessages(); // Track changes
      this.aiIsThinking(); // Track thinking state changes
      setTimeout(() => this.scrollToBottom(), 100);
    });

    // Initialize chat with welcome message
    this.chatMessages.set([
      {
        sender: 'ai',
        text: "Hello! I'm your AI assistant. Describe the infrastructure you'd like to deploy.",
        timestamp: new Date(),
      },
    ]);

    // Set up form validation
    this.setupFormValidation();
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

  protected updatePrompt(prompt: string): void {
    this.aiPrompt.set(prompt);
  }

  // Removed toggleDeploymentForm method - no longer needed

  /**
   * Scrolls the chat container to the bottom
   */
  private scrollToBottom(): void {
    if (this.chatContainer?.nativeElement) {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  // --- ARCHITECTURE PROPOSAL METHODS ---

  /**
   * Selects a component from the proposed architecture for configuration
   */
  protected selectProposedComponent(component: ArchitectureComponent, message: ChatMessage): void {
    this.activeProposedComponent.set(component);
    this.currentProposalMessage.set(message);
    this.configurationDialogVisible.set(true);

    // Create a form for this component if it doesn't exist already
    if (!this.componentForms.has(component.instanceId)) {
      this.createComponentForm(component);
    }
  }

  /**
   * Creates a form group for component configuration
   */
  private createComponentForm(component: ArchitectureComponent): void {
    if (!component.options || component.options.length === 0) {
      // If no options, create an empty form group
      this.componentForms.set(component.instanceId, this.formBuilder.group({}));
      return;
    }

    const formGroup = this.formBuilder.group({});

    // Add form controls for each option
    component.options.forEach((option) => {
      const validators = option.required ? [Validators.required] : [];
      formGroup.addControl(
        option.name,
        this.formBuilder.control(option.defaultValue || '', validators),
      );
    });

    this.componentForms.set(component.instanceId, formGroup);
  }

  /**
   * Saves the component configuration
   */
  protected saveComponentConfiguration(): void {
    const component = this.activeProposedComponent();
    const message = this.currentProposalMessage();

    if (!component || !message) return;

    // Get form values
    const form = this.componentForms.get(component.instanceId);
    if (!form) return;

    // Update component configuration
    const components = message.proposedComponents?.map((c) => {
      if (c.instanceId === component.instanceId) {
        return {
          ...c,
          configuration: form.value,
        };
      }
      return c;
    });

    // Update message with configured component
    if (message.proposedComponents && components) {
      message.proposedComponents = components;

      // Mark as configured
      this.configuredComponents.update((set) => {
        const newSet = new Set(set);
        newSet.add(component.instanceId);
        return newSet;
      });
    }

    this.configurationDialogVisible.set(false);
  }

  /**
   * Checks if a component has been configured
   */
  protected isComponentConfigured(instanceId: string): boolean {
    return this.configuredComponents().has(instanceId);
  }

  /**
   * Gets the form group for the active component
   */
  protected getActiveComponentForm(): FormGroup | null {
    const component = this.activeProposedComponent();
    if (!component) return null;

    return this.componentForms.get(component.instanceId) || null;
  }

  /**
   * Gets the options for the active component
   */
  protected getActiveComponentOptions(): FormOption[] {
    const component = this.activeProposedComponent();
    if (!component) return [];

    return component.options || [];
  }

  /**
   * Accepts the proposed architecture and adds it to the deployment
   */
  protected acceptProposedArchitecture(message: ChatMessage): void {
    if (!message.proposedComponents) return;

    // Check if all components are configured
    const allConfigured = message.proposedComponents.every((component) =>
      this.isComponentConfigured(component.instanceId),
    );

    if (!allConfigured) {
      const unconfiguredCount = message.proposedComponents.filter(
        (c) => !this.isComponentConfigured(c.instanceId),
      ).length;

      this.errorMessages.set([
        `Please configure all ${unconfiguredCount} component(s) before accepting the architecture`,
      ]);
      return;
    }

    // Set thinking state for better UX
    this.aiIsThinking.set(true);

    // Set generated architecture flag
    this.generatedArchitecture.set(true);

    // Store the configured components
    this.generatedComponents.set([...message.proposedComponents]);

    // Log the accepted architecture
    console.log('Architecture accepted:', this.generatedComponents());

    // Add a confirmation message from AI after a brief delay
    setTimeout(() => {
      this.chatMessages.update((messages) => [
        ...messages,
        {
          sender: 'ai',
          text: 'Great! The architecture has been accepted. Now let me check if any sensitive variables are needed for this deployment...',
          timestamp: new Date(),
        },
      ]);

      // Clear error messages
      this.errorMessages.set([]);

      // Stop thinking state
      this.aiIsThinking.set(false);

      // After architecture acceptance, request sensitive variables from AI if needed
      this.requestSensitiveVariablesFromAI();
    }, 1500); // 1.5 second delay for realistic thinking time
  }

  ngAfterViewInit(): void {
    // Initialize Prism for syntax highlighting after view is initialized
    if (typeof window !== 'undefined') {
      const Prism = (window as any).Prism;
      if (Prism) {
        console.log('Prism initialized for syntax highlighting');
      }
    }
  }

  protected sendAiPrompt(): void {
    const prompt = this.aiPrompt().trim();
    if (!prompt || this.aiIsThinking()) return;

    // Clear the input field
    this.aiPrompt.set('');

    // Create user message
    const userMessage: ChatMessage = {
      sender: 'user',
      text: prompt,
      timestamp: new Date(),
    };

    // Add user message to chat
    this.chatMessages.update((messages) => [...messages, userMessage]);

    // Set thinking state
    this.aiIsThinking.set(true);

    // Send message to backend using DeploymentService
    this.deploymentService.sendChatMessage(userMessage, this.projectId()!).subscribe({
      next: (response) => {
        // Add AI response to chat
        this.chatMessages.update((messages) => [...messages, response]);

        // Note: Sensitive variables are now only handled after architecture acceptance
        // This section intentionally left empty - sensitive variables logic moved to requestSensitiveVariablesFromAI()

        // Set architecture as generated if this is the first user message
        if (!this.generatedArchitecture()) {
          this.generatedArchitecture.set(true);
        }

        // Stop thinking state
        this.aiIsThinking.set(false);

        // Validate form after AI response
        this.validateCurrentForm();
      },
      error: (error) => {
        console.error('Error getting AI response:', error);

        // Add error message to chat
        this.chatMessages.update((messages) => [
          ...messages,
          {
            sender: 'ai',
            text: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date(),
          },
        ]);

        // Stop thinking state
        this.aiIsThinking.set(false);

        // Add to error messages
        this.errorMessages.update((msgs) => [
          ...msgs,
          error.message || 'Failed to get AI response',
        ]);
      },
    });
  }

  // No longer needed as we're using the real API

  private getFormData(): DeploymentFormData {
    const formValue = this.deploymentConfigForm.value;

    // Use the stored generatedComponents instead of searching through chat messages
    const components = this.generatedComponents() || [];

    return {
      mode: 'ai-assistant',
      name: formValue.name,
      environment: formValue.environment,
      repoUrl: formValue.repoUrl,
      branch: formValue.branch,
      aiPrompt: this.chatMessages()
        .map((msg) => msg.text)
        .join('\n'),
      chatMessages: this.chatMessages(),
      aiGeneratedArchitecture: this.generatedArchitecture(),
      customComponents: components,
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

    // AI-specific validation
    if (this.chatMessages().length <= 1) {
      // Only the welcome message
      errors.push('Please interact with the AI assistant before creating a deployment');
    }

    this.validationErrors.set(errors);
  }

  // --- SENSITIVE VARIABLES HANDLING ---

  /**
   * Opens the sensitive variables modal
   */
  protected openSensitiveVariablesModal(): void {
    console.log('Opening sensitive variables modal');
    this.showSensitiveVariablesDialog.set(true);
  }

  /**
   * Creates a form for sensitive variables input
   */
  private createSensitiveVariablesForm(sensitiveVariables: SensitiveVariable[]): void {
    const formGroup = this.formBuilder.group({});

    sensitiveVariables.forEach((variable) => {
      const validators = variable.required ? [Validators.required] : [];

      // Add specific validators based on type
      if (variable.type === 'string' && variable.name.includes('password')) {
        validators.push(Validators.minLength(8));
      }

      formGroup.addControl(variable.name, this.formBuilder.control('', validators));
    });

    this.sensitiveVariablesForm.set(formGroup);

    // Reset ready state when form is recreated
    this.sensitiveVariablesReady.set(false);
  }

  /**
   * Validates sensitive variables form and marks as ready
   */
  protected validateSensitiveVariables(): void {
    const form = this.sensitiveVariablesForm();

    if (!form) {
      this.errorMessages.set(['Form not initialized.']);
      return;
    }

    // Mark all fields as touched to show validation errors
    Object.keys(form.controls).forEach((key) => {
      form.get(key)?.markAsTouched();
    });

    if (form.valid) {
      this.sensitiveVariablesReady.set(true);
      this.showSensitiveVariablesDialog.set(false);
      this.clearErrors();

      // Add success message to chat
      this.chatMessages.update((messages) => [
        ...messages,
        {
          sender: 'ai',
          text: `✅ Sensitive variables validated and ready to submit. You can now click the "Submit Variables" button to store them securely.`,
          timestamp: new Date(),
        },
      ]);
    } else {
      this.errorMessages.set(['Please fill in all required fields correctly.']);
    }
  }

  /**
   * Opens deployment configuration modal when submitting sensitive variables
   */
  protected submitSensitiveVariables(): void {
    const form = this.sensitiveVariablesForm();

    if (!form || !form.valid || !this.sensitiveVariablesReady()) {
      let errorMsg = 'Validation failed: ';
      if (!form) errorMsg += 'Form not initialized. ';
      if (form && !form.valid) errorMsg += 'Form has validation errors. ';
      if (!this.sensitiveVariablesReady()) errorMsg += 'Variables not validated. ';

      this.errorMessages.set([errorMsg]);
      return;
    }

    // Open deployment configuration modal
    console.log('Opening deployment configuration modal...');
    this.showDeploymentConfigDialog.set(true);
  }

  /**
   * Cancels deployment configuration
   */
  protected cancelDeploymentConfig(): void {
    this.showDeploymentConfigDialog.set(false);
  }

  /**
   * Saves deployment configuration and creates deployment with sensitive variables
   */
  protected saveDeploymentConfig(): void {
    // Validate form
    if (!this.deploymentConfigForm.valid) {
      this.errorMessages.set(['Please fill in all required fields.']);
      return;
    }

    // Validate AI interaction
    if (this.chatMessages().length <= 1) {
      this.errorMessages.set([
        'Please interact with the AI assistant before creating a deployment',
      ]);
      return;
    }

    this.creatingDeployment.set(true);
    this.clearErrors();

    // Get form data
    const formData = this.getFormData();

    // Use stored generatedComponents
    const proposedComponents = this.generatedComponents() || [];

    // Create deployment object
    const deploymentData: AiAssistantDeploymentModel = {
      mode: 'ai-assistant',
      chatMessages: this.chatMessages(),
      aiGeneratedArchitecture: this.generatedArchitecture(),
      name: formData.name,
      environment: formData.environment,
      id: '',
      projectId: this.projectId()!,
      status: 'configuring',
      createdAt: new Date(),
      updatedAt: new Date(),
      generatedComponents: proposedComponents,
    };

    console.log('Creating deployment with config:', deploymentData);

    // Create deployment
    this.deploymentService.createAiAssistantDeployment(deploymentData).subscribe({
      next: (deployment) => {
        console.log('Deployment created successfully:', deployment);

        // Store deployment ID
        this.currentDeploymentId.set(deployment.id);
        this.cookieService.set(`deploymentId_${this.projectId()}`, deployment.id, 1);

        // Close deployment config modal
        this.showDeploymentConfigDialog.set(false);
        this.creatingDeployment.set(false);

        // Now store sensitive variables
        this.storeSensitiveVariablesAfterDeployment(deployment.id);
      },
      error: (error) => {
        console.error('Error creating deployment:', error);
        this.creatingDeployment.set(false);
        this.errorMessages.set([error.message || 'Failed to create deployment']);
      },
    });
  }

  /**
   * Stores sensitive variables after deployment creation (updated version)
   */
  private storeSensitiveVariablesAfterDeployment(deploymentId: string): void {
    const form = this.sensitiveVariablesForm();

    if (!form || !deploymentId) {
      this.storingSensitiveVariables.set(false);
      this.errorMessages.set([
        'Failed to store sensitive variables: missing form or deployment ID',
      ]);
      return;
    }

    this.storingSensitiveVariables.set(true);
    this.clearErrors();

    // Convert form values to SensitiveVariableValue format
    const sensitiveVariables: SensitiveVariableValue[] = this.currentSensitiveVariables().map(
      (variable) => ({
        key: variable.name,
        value: form.value[variable.name] || '',
        isSecret: variable.sensitive,
      }),
    );

    const request: StoreSensitiveVariablesRequest = {
      sensitiveVariables,
    };

    console.log('Storing sensitive variables:', request);

    this.deploymentService
      .storeSensitiveVariables(this.projectId()!, deploymentId, request)
      .subscribe({
        next: (response) => {
          console.log('Sensitive variables stored successfully:', response);

          // Add success message to chat
          this.chatMessages.update((messages) => [
            ...messages,
            {
              sender: 'ai',
              text: `✅ Successfully stored ${response.storedCount} sensitive variables securely. Your deployment configuration is now complete.`,
              timestamp: new Date(),
            },
          ]);

          this.storingSensitiveVariables.set(false);
          this.sensitiveVariablesReady.set(false);

          // Navigate to deployment detail page
          const deploymentId = this.currentDeploymentId();
          if (deploymentId) {
            this.router.navigate(['/console/project/deployments', deploymentId]);
          } else {
            // Fallback to deployments list if no deployment ID
            this.router.navigate(['/console/project/deployments']);
          }
        },
        error: (error) => {
          console.error('Error storing sensitive variables:', error);
          this.storingSensitiveVariables.set(false);
          this.errorMessages.set([error.message || 'Failed to store sensitive variables securely']);
        },
      });
  }

  /**
   * Requests sensitive variables from AI after architecture acceptance
   */
  private requestSensitiveVariablesFromAI(): void {
    console.log('Requesting sensitive variables from AI after architecture acceptance...');

    const messageText =
      'The architecture has been accepted. Please analyze the components and let me know if any sensitive variables (API keys, passwords, database credentials, etc.) are needed for this deployment.';

    // Create ChatMessage object
    const chatMessage: ChatMessage = {
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    // Add user message to chat
    this.chatMessages.update((messages) => [...messages, chatMessage]);

    // Set thinking state
    this.aiIsThinking.set(true);

    // Send message to backend using DeploymentService
    this.deploymentService.sendChatMessage(chatMessage, this.projectId()!).subscribe({
      next: (response) => {
        // Stop thinking state
        this.aiIsThinking.set(false);

        // Add AI response to chat
        this.chatMessages.update((messages) => [...messages, response]);

        // Handle sensitive variables request
        if (response.isRequestingSensitiveVariables && response.requestedSensitiveVariables) {
          this.currentSensitiveVariables.set(response.requestedSensitiveVariables);
          this.createSensitiveVariablesForm(response.requestedSensitiveVariables);
        }
      },
      error: (error) => {
        // Stop thinking state on error
        this.aiIsThinking.set(false);

        console.error('Error sending message to AI:', error);
        this.errorMessages.set([error.message || 'Failed to communicate with AI assistant']);
      },
    });
  }

  /**
   * Creates deployment first, then submits sensitive variables
   */
  private createDeploymentWithSensitiveVariables(): void {
    console.log('Creating deployment with sensitive variables flow...');

    // Set loading state
    this.storingSensitiveVariables.set(true);
    this.clearErrors();

    // Add info message to chat
    this.chatMessages.update((messages) => [
      ...messages,
      {
        sender: 'ai',
        text: `🔄 Creating deployment and storing sensitive variables securely...`,
        timestamp: new Date(),
      },
    ]);

    // Call the modal save method which will create deployment and store variables
    this.saveDeploymentConfig();
  }

  /**
   * Cancels sensitive variables input
   */
  protected cancelSensitiveVariables(): void {
    this.showSensitiveVariablesDialog.set(false);
  }

  /**
   * Adds initial greeting message with user name
   */
  private addInitialGreeting(): void {
    // Get user name from Firebase Auth
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        const userName = user.displayName || 'there';
        const greetingMessage: ChatMessage = {
          sender: 'ai',
          text: `Hello! ${userName}, I'm IDEM DevOps Assistant. I can generate and deploy your project or infrastructure for you, and manage responsive deployments. How can I help you today?`,
          timestamp: new Date(),
        };

        this.chatMessages.set([greetingMessage]);
      }
    });
  }
}
