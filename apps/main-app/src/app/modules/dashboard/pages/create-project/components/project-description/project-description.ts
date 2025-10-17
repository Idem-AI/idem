import { Component, input, output, signal, computed, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProjectModel } from '../../../../models/project.model';
import { environment } from '../../../../../../../environments/environment';
import { AuthService } from '../../../../../auth/services/auth.service';

@Component({
  selector: 'app-project-description',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './project-description.html',
  styleUrl: './project-description.css',
})
export class ProjectDescriptionComponent implements OnInit {
  readonly project = input.required<ProjectModel>();
  readonly nextStep = output<void>();
  readonly projectUpdate = output<Partial<ProjectModel>>();

  private readonly authService = inject(AuthService);

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

  // African project examples
  protected readonly africanProjectExamples = [
    {
      name: 'M-Pesa Clone',
      description: 'A mobile money transfer and microfinancing service for African markets',
      icon: 'pi pi-wallet',
      prompt:
        'A mobile money platform like M-Pesa with secure transactions, agent network management, and financial inclusion features for rural communities in Africa',
    },
    {
      name: 'Agri-Tech Platform',
      description: 'Farm management system for small-scale African farmers',
      icon: 'pi pi-seedling',
      prompt:
        'An agricultural management platform for small-scale African farmers with weather forecasting, crop disease detection using AI, and marketplace for selling produce directly to buyers',
    },
    {
      name: 'Solar Pay-as-you-go',
      description: 'Solar energy payment and management system',
      icon: 'pi pi-sun',
      prompt:
        'A pay-as-you-go solar energy management system for off-grid communities in Africa with mobile payments, usage tracking, and maintenance alerts',
    },
    {
      name: 'Health Passport',
      description: 'Digital health records for underserved communities',
      icon: 'pi pi-heart',
      prompt:
        'A digital health passport app for underserved African communities that works offline, stores vaccination records, and connects patients with local healthcare providers',
    },
    {
      name: 'African Artisan Marketplace',
      description: 'E-commerce platform for African artisans',
      icon: 'pi pi-shopping-bag',
      prompt:
        'An e-commerce platform connecting African artisans directly with global buyers, featuring secure payments, logistics management, and cultural storytelling for each product',
    },
    {
      name: 'EdTech for Low Bandwidth',
      description: 'Educational platform optimized for low connectivity',
      icon: 'pi pi-book',
      prompt:
        'An educational platform designed for low-bandwidth African regions with offline content caching, SMS-based learning modules, and localized curriculum in multiple African languages',
    },
  ];

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
