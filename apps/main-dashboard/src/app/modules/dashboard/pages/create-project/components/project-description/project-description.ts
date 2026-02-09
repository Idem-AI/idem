import { Component, input, output, signal, computed, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { ProjectModel } from '../../../../models/project.model';
import { environment } from '../../../../../../../environments/environment';
import { AuthService } from '../../../../../auth/services/auth.service';

@Component({
  selector: 'app-project-description',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslateModule],
  templateUrl: './project-description.html',
  styleUrl: './project-description.css',
})
export class ProjectDescriptionComponent implements OnInit {
  readonly project = input.required<ProjectModel>();
  readonly nextStep = output<void>();
  readonly projectUpdate = output<Partial<ProjectModel>>();

  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  protected isTextareaFocused = signal(false);
  protected characterCount = signal(0);
  protected textareaContent = signal('');
  protected userName = signal<string>('User');

  // Expose Math and environment to template
  protected readonly Math = Math;
  protected readonly environment = environment;

  // Character limits based on beta status
  protected readonly maxCharacters = environment.isBeta ? 500 : 2000;

  // Computed properties for character limit styling
  protected readonly characterProgress = computed(() => {
    const count = this.characterCount();
    return (count / this.maxCharacters) * 100;
  });

  protected readonly isNearLimit = computed(() => {
    return this.characterProgress() >= 80;
  });

  protected readonly isOverLimit = computed(() => {
    return this.characterCount() > this.maxCharacters;
  });

  protected readonly counterColor = computed(() => {
    const progress = this.characterProgress();
    if (progress >= 100) return 'text-red-400';
    if (progress >= 80) return 'text-yellow-400';
    return 'text-gray-400';
  });

  protected readonly progressBarColor = computed(() => {
    const progress = this.characterProgress();
    if (progress >= 100) return 'bg-red-500';
    if (progress >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  });

  // Check if textarea has content (user started typing)
  protected readonly hasContent = computed(() => {
    return this.textareaContent().trim().length > 0;
  });

  protected autoResize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;

    // Update both character count and content signal
    this.characterCount.set(textarea.value.length);
    this.textareaContent.set(textarea.value);

    // Update project description via output
    this.projectUpdate.emit({ description: textarea.value });

    // Prevent typing if over limit
    if (textarea.value.length > this.maxCharacters) {
      const truncatedValue = textarea.value.substring(0, this.maxCharacters);
      textarea.value = truncatedValue;
      this.characterCount.set(this.maxCharacters);
      this.textareaContent.set(truncatedValue);
      this.projectUpdate.emit({ description: truncatedValue });
    }

    // Auto-resize with mobile-optimized height limits
    textarea.style.height = 'auto';

    // Different max heights for mobile vs desktop
    const isMobile = window.innerWidth < 640; // sm breakpoint
    const maxHeight = isMobile ? 200 : 400; // Smaller max height on mobile
    const minHeight = isMobile ? 120 : 140; // Match CSS min-height

    const newHeight = Math.max(Math.min(textarea.scrollHeight, maxHeight), minHeight);
    textarea.style.height = newHeight + 'px';
  }

  protected onTextareaFocus(): void {
    this.isTextareaFocused.set(true);
  }

  protected onTextareaBlur(): void {
    this.isTextareaFocused.set(false);
  }

  // Initialize character count and user name when component loads
  ngOnInit(): void {
    const currentProject = this.project();
    if (currentProject?.description) {
      this.characterCount.set(currentProject.description.length);
      this.textareaContent.set(currentProject.description);
    }

    // Get current user name
    this.loadUserName();
  }

  private loadUserName(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const displayName = currentUser.displayName;
      const email = currentUser.email;

      if (displayName) {
        const nameWords = displayName.trim().split(' ');
        const firstName = nameWords[0] || '';
        const shortName = firstName.split(' ')[0];
        this.userName.set(shortName);
      } else if (email) {
        const emailName = email.split('@')[0];
        const formattedName = emailName
          .replace(/[._]/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .slice(0, 2) // Take only first two words
          .join(' ');
        this.userName.set(formattedName);
      } else {
        this.userName.set('User');
      }
    } else {
      // Subscribe to user changes in case user is not immediately available
      this.authService.user$.subscribe((user) => {
        if (user) {
          const displayName = user.displayName;
          const email = user.email;

          if (displayName) {
            // Split name and take only first two words
            const nameWords = displayName.trim().split(' ');
            const firstName = nameWords[0] || '';
            const secondName = nameWords[1] || '';
            const shortName = secondName ? `${firstName} ${secondName}` : firstName;
            this.userName.set(shortName);
          } else if (email) {
            const emailName = email.split('@')[0];
            const formattedName = emailName
              .replace(/[._]/g, ' ')
              .split(' ')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .slice(0, 2) // Take only first two words
              .join(' ');
            this.userName.set(formattedName);
          } else {
            this.userName.set('User');
          }
        }
      });
    }
  }

  protected get africanProjectExamples() {
    return [
      {
        name: this.translate.instant('dashboard.projectDescription.examples.mpesa.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.mpesa.description',
        ),
        icon: 'pi pi-wallet',
        prompt: this.translate.instant('dashboard.projectDescription.examples.mpesa.prompt'),
      },
      {
        name: this.translate.instant('dashboard.projectDescription.examples.agritech.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.agritech.description',
        ),
        icon: 'pi pi-seedling',
        prompt: this.translate.instant('dashboard.projectDescription.examples.agritech.prompt'),
      },
      {
        name: this.translate.instant('dashboard.projectDescription.examples.solar.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.solar.description',
        ),
        icon: 'pi pi-sun',
        prompt: this.translate.instant('dashboard.projectDescription.examples.solar.prompt'),
      },
      {
        name: this.translate.instant('dashboard.projectDescription.examples.health.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.health.description',
        ),
        icon: 'pi pi-heart',
        prompt: this.translate.instant('dashboard.projectDescription.examples.health.prompt'),
      },
      {
        name: this.translate.instant('dashboard.projectDescription.examples.artisan.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.artisan.description',
        ),
        icon: 'pi pi-shopping-bag',
        prompt: this.translate.instant('dashboard.projectDescription.examples.artisan.prompt'),
      },
      {
        name: this.translate.instant('dashboard.projectDescription.examples.edtech.name'),
        description: this.translate.instant(
          'dashboard.projectDescription.examples.edtech.description',
        ),
        icon: 'pi pi-book',
        prompt: this.translate.instant('dashboard.projectDescription.examples.edtech.prompt'),
      },
    ];
  }

  protected selectExample(example: string): void {
    const currentProject = this.project();
    if (currentProject) {
      // Truncate example if it exceeds character limit
      const truncatedExample =
        example.length > this.maxCharacters ? example.substring(0, this.maxCharacters) : example;

      // Update project description
      currentProject.description = truncatedExample;
      this.characterCount.set(truncatedExample.length);
      this.textareaContent.set(truncatedExample);

      // Update the textarea value in the DOM and trigger change detection
      setTimeout(() => {
        const textarea = document.getElementById('projectDescription') as HTMLTextAreaElement;
        if (textarea) {
          // Set the textarea value
          textarea.value = truncatedExample;

          // Trigger input event to update ngModel and signals
          const inputEvent = new Event('input', { bubbles: true });
          textarea.dispatchEvent(inputEvent);

          // Auto-resize the textarea
          textarea.style.height = 'auto';
          const newHeight = Math.min(textarea.scrollHeight, 400);
          textarea.style.height = newHeight + 'px';
        }
      }, 0);

      // Emit the project update
      this.projectUpdate.emit({ description: truncatedExample });
    }
  }

  protected goToNextStep(): void {
    this.nextStep.emit();
  }
}
