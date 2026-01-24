import { Component, OnInit, input, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { DeploymentModel } from '../../../models/deployment.model';
import { DeploymentService, DeploymentExecutionEvent } from '../../../services/deployment.service';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { TerraformFiles } from '../create-deployment/components/terraform-files/terraform-files';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
// PrimeNG Components
import { AccordionModule } from 'primeng/accordion';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-deployment-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TerraformFiles,
    Loader,
    AccordionModule,
    DialogModule,
    ButtonModule,
    ScrollPanelModule,
    TranslateModule,
  ],
  templateUrl: './deployment-details.html',
})
export class DeploymentDetails implements OnInit, OnDestroy {
  // Angular-specific properties
  protected readonly deploymentId = input<string>('');

  // Component state
  protected readonly deployment = signal<DeploymentModel | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);
  protected readonly showExecutionModal = signal<boolean>(false);

  // Execution modal state
  protected readonly executionLogs = signal<string[]>([]);
  protected readonly isExecuting = signal<boolean>(false);
  protected readonly executionStatus = signal<'idle' | 'executing' | 'completed' | 'error'>('idle');
  protected readonly executionStartTime = signal<string | null>(null);
  protected readonly executionEndTime = signal<string | null>(null);

  // Computed properties
  protected readonly hasDeployment = computed(() => !!this.deployment());
  protected readonly isCompleted = computed(
    () =>
      this.deployment()?.status === 'deployed' ||
      this.deployment()?.status === 'failed' ||
      this.deployment()?.status === 'cancelled',
  );
  protected readonly showTerraformFiles = computed(
    () =>
      this.hasDeployment() && this.deployment()?.generatedTerraformTfvarsFileContent !== undefined,
  );
  protected readonly currentDeploymentId = computed(
    () => this.deploymentId() || this.route.snapshot.paramMap.get('id') || '',
  );

  // Services
  private readonly deploymentService = inject(DeploymentService);
  private readonly cookieService = inject(CookieService);
  protected readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly translate = inject(TranslateService);
  private sseSubscription: any = null;

  ngOnInit(): void {
    this.fetchDeploymentData();
  }

  protected fetchDeploymentData(): void {
    // Use route params if input is not provided through router binding
    const deploymentId = this.deploymentId() || this.route.snapshot.paramMap.get('id');
    const projectId = this.cookieService.get('projectId');

    if (!deploymentId || !projectId) {
      this.error.set(this.translate.instant('dashboard.deploymentDetails.errors.missingIds'));
      this.loading.set(false);
      return;
    }

    this.projectId.set(projectId);
    this.loading.set(true);
    this.error.set(null);

    this.deploymentService.getDeploymentById(projectId, deploymentId).subscribe({
      next: (deployment) => {
        console.log('Fetched deployment details:', deployment);
        this.deployment.set(deployment);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error fetching deployment details:', error);
        this.error.set(this.translate.instant('dashboard.deploymentDetails.errors.failedToLoad'));
        this.loading.set(false);
      },
    });
  }

  protected redeployDeployment(): void {
    const deploymentId = this.deploymentId() || this.route.snapshot.paramMap.get('id');
    const projectId = this.projectId();

    if (!deploymentId || !projectId) {
      this.error.set(
        this.translate.instant('dashboard.deploymentDetails.errors.redeployMissingIds'),
      );
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.deploymentService.redeployDeployment(projectId, deploymentId).subscribe({
      next: (updatedDeployment) => {
        console.log('Redeployed successfully:', updatedDeployment);
        this.deployment.set(updatedDeployment);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error redeploying:', error);
        this.error.set(
          this.translate.instant('dashboard.deploymentDetails.errors.failedToRedeploy'),
        );
        this.loading.set(false);
      },
    });
  }

  protected cancelDeployment(): void {
    const deploymentId = this.deploymentId() || this.route.snapshot.paramMap.get('id');
    const projectId = this.projectId();

    if (!deploymentId || !projectId) {
      this.error.set(this.translate.instant('dashboard.deploymentDetails.errors.cancelMissingIds'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.deploymentService.cancelDeployment(projectId, deploymentId).subscribe({
      next: (updatedDeployment) => {
        console.log('Cancelled successfully:', updatedDeployment);
        this.deployment.set(updatedDeployment);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cancelling deployment:', error);
        this.error.set(this.translate.instant('dashboard.deploymentDetails.errors.failedToCancel'));
        this.loading.set(false);
      },
    });
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return this.translate.instant('common.notAvailable');
    return new Date(date).toLocaleString();
  }

  /**
   * Generates a deployment pipeline for the current deployment
   */
  protected generatePipeline(): void {
    const deploymentId = this.deploymentId() || this.route.snapshot.paramMap.get('id');
    const projectId = this.projectId();

    if (!deploymentId || !projectId) {
      this.error.set(
        this.translate.instant('dashboard.deploymentDetails.errors.pipelineMissingIds'),
      );
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.deploymentService.generatePipeline(projectId, deploymentId).subscribe({
      next: (updatedDeployment: DeploymentModel) => {
        console.log('Pipeline generated successfully:', updatedDeployment);
        this.deployment.set(updatedDeployment);
        this.loading.set(false);
      },
      error: (error: Error) => {
        console.error('Error generating pipeline:', error);
        this.error.set(
          this.translate.instant('dashboard.deploymentDetails.errors.failedToGeneratePipeline'),
        );
        this.loading.set(false);
      },
    });
  }

  /**
   * Generates Terraform files for the current deployment
   */
  protected generateTerraformFiles(): void {
    const deploymentId = this.deploymentId() || this.route.snapshot.paramMap.get('id');
    const projectId = this.projectId();

    if (!deploymentId || !projectId) {
      this.error.set(
        this.translate.instant('dashboard.deploymentDetails.errors.terraformMissingIds'),
      );
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.deploymentService.generateTerraformFiles(projectId, deploymentId).subscribe({
      next: (updatedDeployment: DeploymentModel) => {
        console.log('Terraform files generated successfully:', updatedDeployment);
        this.deployment.set(updatedDeployment);
        this.loading.set(false);
      },
      error: (error: Error) => {
        console.error('Error generating Terraform files:', error);
        this.error.set(
          this.translate.instant('dashboard.deploymentDetails.errors.failedToGenerateTerraform'),
        );
        this.loading.set(false);
      },
    });
  }

  /**
   * Opens the deployment execution modal and starts execution
   */
  protected openExecutionModal(): void {
    this.showExecutionModal.set(true);
    this.executionLogs.set([]);
    this.executionStatus.set('idle');
    // Start execution after modal is visible
    setTimeout(() => {
      this.startExecution();
    }, 200);
  }

  /**
   * Closes the deployment execution modal
   */
  protected closeExecutionModal(): void {
    if (this.isExecuting()) return;
    this.showExecutionModal.set(false);
    this.executionLogs.set([]);
  }

  /**
   * Handles deployment execution completion
   */
  protected onExecutionCompleted(): void {
    console.log('Deployment execution completed, refreshing deployment data');
    // Refresh deployment data to get updated status
    this.fetchDeploymentData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Starts the deployment execution
   */
  protected startExecution(): void {
    const deploymentId = this.currentDeploymentId();
    if (!deploymentId) {
      this.addExecutionLog(
        'error',
        this.translate.instant('dashboard.deploymentDetails.execution.noId'),
      );
      return;
    }

    this.isExecuting.set(true);
    this.executionStatus.set('executing');
    this.executionStartTime.set(new Date().toISOString());
    this.executionEndTime.set(null);

    this.addExecutionLog(
      'info',
      this.translate.instant('dashboard.deploymentDetails.execution.starting', { deploymentId }),
    );
    this.addExecutionLog(
      'info',
      this.translate.instant('dashboard.deploymentDetails.execution.connecting'),
    );

    this.sseSubscription = this.deploymentService
      .executeDeploymentStream(deploymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: DeploymentExecutionEvent) => {
          this.handleSSEEvent(event);
        },
        error: (error) => {
          console.error('SSE Error:', error);
          this.addExecutionLog(
            'error',
            this.translate.instant('dashboard.deploymentDetails.execution.connectionError', {
              error: error.message || 'Unknown error',
            }),
          );
          this.isExecuting.set(false);
          this.executionStatus.set('error');
          this.executionEndTime.set(new Date().toISOString());
        },
        complete: () => {
          console.log('SSE stream completed');
          if (this.executionStatus() === 'executing') {
            // Stream completed without explicit success/error
            this.addExecutionLog(
              'info',
              this.translate.instant('dashboard.deploymentDetails.execution.streamCompleted'),
            );
            this.isExecuting.set(false);
            this.executionEndTime.set(new Date().toISOString());
          }
        },
      });
  }

  /**
   * Stops the deployment execution
   */
  protected stopExecution(): void {
    // Fermer la connexion SSE
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
      this.sseSubscription = null;
    }

    // Mettre à jour l'état
    this.isExecuting.set(false);
    this.executionEndTime.set(new Date().toISOString());
    this.executionStatus.set('error'); // Marquer comme annulé

    // Ajouter un log d'annulation
    this.addExecutionLog(
      'error',
      this.translate.instant('dashboard.deploymentDetails.execution.cancelledByUser'),
    );

    console.log('Deployment execution stopped by user');
  }

  /**
   * Handles SSE events
   */
  private handleSSEEvent(event: DeploymentExecutionEvent): void {
    console.log('SSE Event received:', event);

    // Format message with step information if available
    let formattedMessage = event.message;
    if (event.step) {
      formattedMessage = `[${event.step}] ${event.message}`;
    }

    this.addExecutionLog(event.type, formattedMessage);

    // Handle completion events
    if (
      event.type === 'completed' ||
      event.type === 'success' ||
      (event.type === 'end' && event.status === 'finished')
    ) {
      this.isExecuting.set(false);
      this.executionStatus.set('completed');
      this.executionEndTime.set(new Date().toISOString());
      this.onExecutionCompleted();
      return;
    }

    // Handle error events
    if (event.type === 'error' || event.status === 'failed') {
      this.isExecuting.set(false);
      this.executionStatus.set('error');
      this.executionEndTime.set(new Date().toISOString());

      // Add error code if available
      if (event.errorCode) {
        this.addExecutionLog(
          'error',
          this.translate.instant('dashboard.deploymentDetails.execution.errorCode', {
            code: event.errorCode,
          }),
        );
      }
      return;
    }

    // Handle status updates
    if (event.type === 'status') {
      // Don't change execution status for regular status updates
      // unless it's a completion status
      if (event.message.includes('completed successfully')) {
        this.executionStatus.set('completed');
      }
    }
  }

  /**
   * Adds a log entry with modern formatting
   */
  private addExecutionLog(type: string, message: string): void {
    const timestamp = new Date().toISOString();

    // Create structured log entry for modern display
    const logEntry = {
      timestamp,
      type: type.toLowerCase(),
      message,
      id: Date.now() + Math.random(), // Unique ID for tracking
    };

    this.executionLogs.update((logs) => [...logs, JSON.stringify(logEntry)]);
  }

  /**
   * Parses a log entry for display
   */
  protected parseLogEntry(logString: string): any {
    try {
      return JSON.parse(logString);
    } catch {
      // Fallback for old format logs
      return {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: logString,
        id: Date.now(),
      };
    }
  }

  /**
   * Gets the PrimeIcon class for a log type
   */
  protected getLogIcon(type: string): string {
    switch (type) {
      case 'info':
        return 'pi pi-info-circle';
      case 'status':
        return 'pi pi-sync';
      case 'stdout':
        return 'pi pi-arrow-up';
      case 'stderr':
        return 'pi pi-exclamation-triangle';
      case 'error':
        return 'pi pi-times-circle';
      case 'success':
      case 'completed':
        return 'pi pi-check-circle';
      default:
        return 'pi pi-file';
    }
  }

  /**
   * Gets the CSS class for a log type
   */
  protected getLogClass(type: string): string {
    switch (type) {
      case 'info':
        return 'log-info';
      case 'status':
        return 'log-status';
      case 'stdout':
        return 'log-output';
      case 'stderr':
        return 'log-warning';
      case 'error':
        return 'log-error';
      case 'success':
      case 'completed':
        return 'log-success';
      default:
        return 'log-default';
    }
  }

  /**
   * Formats timestamp for display
   */
  protected formatLogTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return new Date().toLocaleTimeString();
    }
  }

  /**
   * Formats execution start time for display
   */
  protected formatExecutionStartTime(): string {
    const startTime = this.executionStartTime();
    return startTime ? new Date(startTime).toLocaleTimeString() : '';
  }

  /**
   * Gets execution duration for display
   */
  protected getExecutionDuration(): string {
    const startTime = this.executionStartTime();
    const endTime = this.executionEndTime();

    if (!startTime) return '';

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (duration < 60) {
      return `${duration}s`;
    } else {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Clears execution logs
   */
  protected clearExecutionLogs(): void {
    if (this.isExecuting()) return;
    this.executionLogs.set([]);
    this.executionStatus.set('idle');
    this.executionStartTime.set(null);
    this.executionEndTime.set(null);
  }

  /**
   * Gets log statistics for display
   */
  protected getLogStats(): { total: number; errors: number; warnings: number; success: number } {
    const logs = this.executionLogs();
    let errors = 0,
      warnings = 0,
      success = 0;

    logs.forEach((logString) => {
      const log = this.parseLogEntry(logString);
      switch (log.type) {
        case 'error':
          errors++;
          break;
        case 'stderr':
          warnings++;
          break;
        case 'success':
        case 'completed':
          success++;
          break;
      }
    });

    return { total: logs.length, errors, warnings, success };
  }
}
