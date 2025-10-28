import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { BusinessPlanGenerationComponent } from '../components/business-plan-generation/business-plan-generation';

@Component({
  selector: 'app-business-plan-generation-page',
  standalone: true,
  imports: [BusinessPlanGenerationComponent],
  template: `
    <div class="w-full min-h-screen sm:p-6 rounded-2xl relative">
      @if (projectId()) {
        <app-business-plan-generation
          (businessPlanGenerated)="onBusinessPlanGenerated($event)"
        ></app-business-plan-generation>
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
          <h3 class="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
          <p class="text-gray-600 mb-4">Please select a project first to generate business plan.</p>
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
export class BusinessPlanGenerationPage implements OnInit {
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
   * Handle business plan generation completion - redirect to business plan display
   */
  protected onBusinessPlanGenerated(businessPlan: any): void {
    console.log('Business plan generation completed, redirecting to display:', businessPlan);

    // Redirect to the business plan display page
    this.router.navigate(['/console/project/business-plan']);
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    this.router.navigate(['/console/projects']);
  }
}
