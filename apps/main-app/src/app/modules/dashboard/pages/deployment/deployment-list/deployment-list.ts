import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { DeploymentModel } from '../../../models/deployment.model';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { DeploymentService } from '../../../services/deployment.service';
import { Loader } from '../../../../../components/loader/loader';

@Component({
  selector: 'app-deployment-list',
  standalone: true,
  imports: [CommonModule, RouterLink, Loader],
  templateUrl: './deployment-list.html',
  styleUrl: './deployment-list.css',
})
export class DeploymentList implements OnInit {
  // Angular-initialized properties
  protected readonly deployments = signal<DeploymentModel[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);

  // Services
  private readonly deploymentService = inject(DeploymentService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    // Get project ID from cookie
    const projectId = this.cookieService.get('projectId');
    this.projectId.set(projectId);

    if (projectId) {
      this.fetchDeployments(projectId);
    } else {
      this.loading.set(false);
      this.error.set('No active project selected');
    }
  }

  DEPLOYMENTS_DATAS: DeploymentModel[] = [
    {
      id: '1',
      name: 'Deployment 1',
      status: 'deployed',
      environment: 'production',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      projectId: '1',
      mode: 'beginner',
      frameworkType: 'angular',
    },
    {
      id: '2',
      name: 'Deployment 2',
      status: 'deployed',
      environment: 'production',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      projectId: '1',
      mode: 'beginner',
      frameworkType: 'angular',
    },
    {
      id: '3',
      name: 'Deployment 3',
      status: 'deployed',
      environment: 'production',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      projectId: '1',
      mode: 'beginner',
      frameworkType: 'angular',
    },
  ];

  protected fetchDeployments(projectId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.deploymentService
      .getProjectDeployments(projectId)
      .pipe(
        tap((deployments) => {
          console.log('Deployments received:', deployments);
          this.deployments.set(deployments);
          this.loading.set(false);
        }),
        catchError((error) => {
          console.error('Error fetching deployments', error);
          this.error.set('Failed to load deployments');
          this.loading.set(false);

          // Fallback to mock data in development
          if (environment.environment === 'dev') {
            console.warn('Using mock deployment data in development mode');
            this.deployments.set(this.DEPLOYMENTS_DATAS);
          }

          return of([]);
        })
      )
      .subscribe();
  }

  protected getStatusClass(status: string): string {
    const base = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm whitespace-nowrap';
    switch (status) {
      case 'deployed':
        return `${base} bg-green-500/15 text-green-400`;
      case 'building':
      case 'infrastructure-provisioning':
      case 'deploying':
        return `${base} bg-blue-500/15 text-blue-400`;
      case 'failed':
      case 'cancelled':
        return `${base} bg-red-500/15 text-red-400`;
      case 'configuring':
      case 'pending':
        return `${base} bg-gray-500/15 text-gray-300`;
      case 'rollback':
        return `${base} bg-yellow-500/15 text-yellow-400`;
      default:
        return `${base} bg-white/10 text-gray-200`;
    }
  }

  protected getStatusIndicatorClass(status: string): string {
    const base = 'inline-block w-2 h-2 rounded-full';
    switch (status) {
      case 'deployed':
        return `${base} bg-green-400`;
      case 'building':
      case 'infrastructure-provisioning':
      case 'deploying':
        return `${base} bg-blue-400`;
      case 'failed':
      case 'cancelled':
        return `${base} bg-red-400`;
      case 'configuring':
      case 'pending':
        return `${base} bg-gray-400`;
      case 'rollback':
        return `${base} bg-yellow-400`;
      default:
        return `${base} bg-white/40`;
    }
  }

  protected getEnvClass(env: string): string {
    const base = 'inline-block px-3 py-1 rounded-full text-sm capitalize';
    switch (env) {
      case 'development':
        return `${base} bg-blue-500/15 text-blue-400`;
      case 'staging':
        return `${base} bg-yellow-500/15 text-yellow-400`;
      case 'production':
        return `${base} bg-green-500/15 text-green-400`;
      default:
        return `${base} bg-white/10 text-gray-200`;
    }
  }

  /**
   * Navigates to the deployment details page for the selected deployment
   */
  protected viewDeploymentDetails(deploymentId: string, event: MouseEvent): void {
    // Don't trigger if clicking on an interactive element (links, buttons)
    const target = event.target as HTMLElement;
    if (
      target.closest('a') ||
      target.closest('button') ||
      target.tagName.toLowerCase() === 'a' ||
      target.tagName.toLowerCase() === 'button'
    ) {
      return;
    }

    // Navigate to the deployment details page
    this.router.navigate(['/console/deployments', deploymentId]);
  }

  protected formatDate(date: Date): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }

  protected truncateUrl(url: string): string {
    if (!url) return 'N/A';
    return url.replace(/^https?:\/\/(www\.)?/, '');
  }
}
