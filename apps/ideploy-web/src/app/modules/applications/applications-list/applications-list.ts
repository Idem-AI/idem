import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { Application } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-applications-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Applications</h1>
    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    } @else if (applications().length === 0) {
      <div class="box">No applications yet.</div>
    } @else {
      <div class="space-y-3">
        @for (app of applications(); track app.uuid) {
          <div class="box flex items-center justify-between">
            <div>
              <a class="font-semibold hover:underline" [routerLink]="['/applications', app.uuid]">{{ app.name }}</a>
              <div class="text-sm" style="color: var(--color-text-secondary)">
                {{ app.git_repository }} ({{ app.git_branch }}) · {{ app.build_pack }}
              </div>
              <div class="text-xs" style="color: var(--color-text-tertiary)">
                status: {{ app.status }}
              </div>
            </div>
            <button class="button" [disabled]="deploying() === app.uuid" (click)="deploy(app)">
              {{ deploying() === app.uuid ? 'Queuing…' : 'Deploy' }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class ApplicationsListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  protected readonly applications = signal<Application[]>([]);
  protected readonly loading = signal(true);
  protected readonly deploying = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listApplications().subscribe({
      next: (apps) => {
        this.applications.set(apps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected deploy(app: Application): void {
    this.deploying.set(app.uuid);
    this.api.deploy(app.uuid).subscribe({
      next: (res) => this.router.navigate(['/deployments', res.deploymentUuid]),
      error: () => this.deploying.set(null),
    });
  }
}
