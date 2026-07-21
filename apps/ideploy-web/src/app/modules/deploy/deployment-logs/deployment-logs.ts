import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { RealtimeService } from '../../../shared/services/realtime.service';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap, takeWhile } from 'rxjs/operators';

/**
 * Live deployment log viewer — subscribes to the `deployment.{uuid}` Soketi
 * channel and appends each streamed line. Shows the application FQDN/port
 * live link once successfully deployed.
 */
@Component({
  selector: 'app-deployment-logs',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header -->
    <div class="flex h-16 items-center justify-between border-b px-6 mb-8" style="border-color:var(--color-surface-2);">
      <a routerLink="/dashboard" class="flex items-center gap-2 text-sm transition-colors hover:text-white" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> {{ 'deploy.backToDashboard' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono text-white/90">{{ 'deploy.deploymentLogs' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-4xl px-6 pb-12">
      @if (deployment()) {
        <!-- Details Card -->
        <div class="db-glass mb-6 p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold font-mono text-white/95">
                {{ deployment().application_name }}
              </h1>
              <p class="text-sm mt-1" style="color:var(--color-text-secondary);">
                {{ 'deploy.branch' | translate }} <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/80"><i class="fa-solid fa-code-branch mr-1"></i>{{ deployment().application_git_branch || 'main' }}</span>
              </p>
            </div>
            
            <div class="flex items-center gap-3">
              <!-- Status Badge -->
              @switch (deployment().status) {
                @case ('queued') {
                  <span class="status-badge bg-white/5 text-white/70 border border-white/10">
                    <i class="fa-solid fa-circle-notch fa-spin text-xs"></i> {{ 'deploy.statusQueued' | translate }}
                  </span>
                }
                @case ('in_progress') {
                  <span class="status-badge bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <i class="fa-solid fa-circle-notch fa-spin text-xs"></i> {{ 'deploy.statusInProgress' | translate }}
                  </span>
                }
                @case ('finished') {
                  <span class="status-badge bg-green-500/10 text-green-400 border border-green-500/20">
                    ✓ {{ 'deploy.statusSuccess' | translate }}
                  </span>
                }
                @case ('failed') {
                  <span class="status-badge bg-red-500/10 text-red-400 border border-red-500/20">
                    ✗ {{ 'deploy.statusFailed' | translate }}
                  </span>
                }
              }

              <!-- Live URL Button -->
              @if (deployment().status === 'finished' && deployment().application_url) {
                <a [href]="deployment().application_url" target="_blank" rel="noopener noreferrer"
                   class="button cursor-pointer text-xs px-3 py-1.5 inline-flex items-center gap-1.5 shadow-lg shadow-blue-500/10 transition-transform hover:scale-[1.02]">
                  {{ 'deploy.visitApp' | translate }} <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
              }
            </div>
          </div>
        </div>
      } @else {
        <!-- Skeleton Card -->
        <div class="db-glass mb-6 p-6 dbpulse">
          <div class="h-6 w-48 rounded bg-white/10 mb-2"></div>
          <div class="h-4 w-32 rounded bg-white/10"></div>
        </div>
      }

      <!-- Terminal Window -->
      <div class="rounded-xl overflow-hidden border border-white/10 shadow-2xl" style="background-color: #0b0f19;">
        <!-- Terminal Header -->
        <div class="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/5">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
            <span class="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
            <span class="w-3 h-3 rounded-full bg-[#27c93f]"></span>
            <span class="text-xs font-mono ml-2 text-white/40">build-console</span>
          </div>
          
          <button (click)="copyLogs()" class="text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer inline-flex items-center gap-1" [title]="'deploy.copyLogsTitle' | translate">
            <i class="fa-solid fa-copy"></i> {{ 'deploy.copyLogs' | translate }}
          </button>
        </div>

        <!-- Terminal Logs -->
        <pre
          class="p-4 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#c9d1d9]"
          style="max-height: 65vh; min-height: 250px; background-color: #080b12;"
        >@for (line of lines(); track $index) {<span>{{ line }}</span>
}@if (lines().length === 0) {<span style="color: var(--color-text-tertiary)">{{ 'deploy.waitingForLogs' | translate }}</span>}</pre>
      </div>
    </div>
  `,
})
export class DeploymentLogsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private realtime = inject(RealtimeService);

  protected readonly deploymentUuid = signal('');
  protected readonly deployment = signal<any>(null);
  protected readonly lines = signal<string[]>([]);
  private unsubscribe?: () => void;
  private pollSub?: Subscription;

  ngOnInit(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.deploymentUuid.set(uuid);

    // Subscribe to live WebSockets logs
    this.unsubscribe = this.realtime.subscribeToDeployment(uuid, (line) => {
      this.lines.update((current) => [...current, line]);
    });

    // Poll deployment information periodically until it settles
    this.pollSub = interval(4000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.getDeployment(uuid)),
        takeWhile(
          (d) => d && (d.status === 'queued' || d.status === 'in_progress'),
          true
        )
      )
      .subscribe({
        next: (d) => {
          if (d) this.deployment.set(d);
        },
        error: () => {},
      });
  }

  protected copyLogs(): void {
    const text = this.lines().join('\n');
    navigator.clipboard.writeText(text);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.pollSub?.unsubscribe();
  }
}
