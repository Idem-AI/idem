import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RealtimeService } from '../../../shared/services/realtime.service';

/**
 * Live deployment log viewer — subscribes to the `deployment.{uuid}` Soketi
 * channel and appends each streamed line. This is the end-to-end showcase:
 * BullMQ worker → SSH/Docker → Soketi → here, in real time.
 */
@Component({
  selector: 'app-deployment-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-2 text-2xl font-bold">Deployment</h1>
    <p class="mb-4 text-sm" style="color: var(--color-text-secondary)">{{ deploymentUuid() }}</p>

    <pre
      class="box overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed"
      style="max-height: 70vh; background-color: var(--color-bg-dark)"
    >@for (line of lines(); track $index) {<span>{{ line }}
</span>}@if (lines().length === 0) {<span style="color: var(--color-text-tertiary)">Waiting for logs…</span>}</pre>
  `,
})
export class DeploymentLogsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private realtime = inject(RealtimeService);

  protected readonly deploymentUuid = signal('');
  protected readonly lines = signal<string[]>([]);
  private unsubscribe?: () => void;

  ngOnInit(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.deploymentUuid.set(uuid);
    this.unsubscribe = this.realtime.subscribeToDeployment(uuid, (line) => {
      this.lines.update((current) => [...current, line]);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
