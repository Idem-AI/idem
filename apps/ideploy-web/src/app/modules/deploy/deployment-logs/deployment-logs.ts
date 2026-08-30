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
    <a routerLink="/dashboard" class="mb-4 inline-flex items-center gap-2 text-sm transition-colors hover:text-white" style="color:var(--color-text-secondary);">
      <i class="fa-solid fa-chevron-left text-[10px]"></i> {{ 'deploy.backToDashboard' | translate }}
    </a>

    <div class="mx-auto max-w-4xl pb-12">
      @if (deployment()) {
        <!-- Details -->
        <div class="box box-flush mb-4">
          <div class="box-header">
            <div>
              <h1 class="font-mono text-xl font-bold text-white/95">
                {{ deployment().application_name }}
              </h1>
              <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
                {{ 'deploy.branch' | translate }}
                <span class="rounded px-1.5 py-0.5 font-mono text-xs" style="background:var(--color-surface-2);">
                  <i class="fa-solid fa-code-branch mr-1" aria-hidden="true"></i>{{ deployment().application_git_branch || 'main' }}
                </span>
              </p>
            </div>

            <div class="flex items-center gap-3">
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

              @if (deployment().status === 'finished' && deployment().application_url) {
                <a [href]="deployment().application_url" target="_blank" rel="noopener noreferrer"
                   class="button inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs transition-transform hover:scale-[1.02]">
                  {{ 'deploy.visitApp' | translate }} <i class="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i>
                </a>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="box box-flush mb-4 dbpulse">
          <div class="box-header">
            <div>
              <div class="mb-2 h-6 w-48 rounded bg-white/10"></div>
              <div class="h-4 w-32 rounded bg-white/10"></div>
            </div>
          </div>
        </div>
      }

      <!-- Terminal -->
      <div class="box box-flush">
        <div class="box-header">
          <div class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-full bg-[#ff5f56]"></span>
            <span class="h-3 w-3 rounded-full bg-[#ffbd2e]"></span>
            <span class="h-3 w-3 rounded-full bg-[#27c93f]"></span>
            <span class="ml-2 font-mono text-xs text-white/40">build-console</span>
          </div>
          <button class="icon-button" (click)="copyLogs()" [title]="'deploy.copyLogsTitle' | translate">
            <i class="fa-solid fa-copy text-xs" aria-hidden="true"></i>
          </button>
        </div>

        <pre
          class="overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-[#c9d1d9]"
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
