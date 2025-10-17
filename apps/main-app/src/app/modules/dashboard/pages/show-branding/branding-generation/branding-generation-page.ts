import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { BrandingGenerationComponent } from '../components/branding-generation/branding-generation';
import { BrandIdentityModel } from '../../../models/brand-identity.model';

@Component({
  selector: 'app-branding-generation-page',
  standalone: true,
  imports: [BrandingGenerationComponent],
  template: `
    <div class="w-full min-h-screen p-6 rounded-2xl relative">
      @if(projectId()) {
      <app-branding-generation
        (brandingGenerated)="onBrandingGenerated($event)"
      ></app-branding-generation>
      } @else {
      <!-- No project ID available -->
      <div class="text-center py-20">
        <div class="mb-4">
          <svg
            class="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          No Project Selected
        </h3>
        <p class="text-gray-600 mb-4">
          Please select a project first to generate branding.
        </p>
        <button
          (click)="goToProjects()"
          class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
        >
          Select Project
        </button>
      </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingGenerationPage implements OnInit {
  // Injected services
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  // Signals for state management
  protected readonly projectId = signal<string | null>(null);

  ngOnInit(): void {
    // Get project ID from cookies
    const projectIdFromCookie = this.cookieService.get('projectId');
    this.projectId.set(projectIdFromCookie);

    if (!projectIdFromCookie) {
      console.log('No project ID found in cookies');
    }
  }

  /**
   * Handle branding generation completion - redirect to branding display
   */
  protected onBrandingGenerated(branding: BrandIdentityModel): void {
    console.log(
      'Branding generation completed, redirecting to display:',
      branding
    );

    // Redirect to the branding display page
    this.router.navigate(['/console/branding']);
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    this.router.navigate(['/console/projects']);
  }
}
