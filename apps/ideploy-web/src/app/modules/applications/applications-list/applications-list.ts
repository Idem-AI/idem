import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { Application } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-applications-list',
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Applications</h1>
      <button class="button" (click)="creating.set(!creating())">{{ creating() ? 'Cancel' : '+ New application' }}</button>
    </div>

    @if (creating()) {
      <form class="box mb-6 max-w-2xl space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-sm">Name</label>
            <input class="input" formControlName="name" />
          </div>
          <div class="w-40">
            <label class="mb-1 block text-sm">Environment ID</label>
            <input class="input" type="number" formControlName="environment_id" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm">Git repository URL</label>
          <input class="input" formControlName="git_repository" placeholder="https://github.com/org/repo" />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-sm">Branch</label>
            <input class="input" formControlName="git_branch" />
          </div>
          <div class="w-40">
            <label class="mb-1 block text-sm">Destination ID</label>
            <input class="input" type="number" formControlName="destination_id" />
          </div>
        </div>
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Creating…' : 'Create application' }}
        </button>
      </form>
    }

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
            <div class="flex items-center gap-2">
              @if (app.link) {
                <a class="button-secondary" [href]="app.link" target="_blank" rel="noopener">
                  <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open
                </a>
              }
              <button class="button" [disabled]="deploying() === app.uuid" (click)="deploy(app)">
                {{ deploying() === app.uuid ? 'Queuing…' : 'Deploy' }}
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ApplicationsListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  protected readonly applications = signal<Application[]>([]);
  protected readonly loading = signal(true);
  protected readonly deploying = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    environment_id: [0, Validators.required],
    git_repository: ['', Validators.required],
    git_branch: ['main'],
    destination_id: [0],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listApplications().subscribe({
      next: (apps) => {
        this.applications.set(apps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.api
      .createApplication({
        name: raw.name,
        environment_id: raw.environment_id,
        git_repository: raw.git_repository,
        git_branch: raw.git_branch || 'main',
        destination_id: raw.destination_id || undefined,
        destination_type: raw.destination_id ? 'App\\Models\\StandaloneDocker' : undefined,
      })
      .subscribe({
        next: () => {
          this.form.reset({ name: '', environment_id: 0, git_repository: '', git_branch: 'main', destination_id: 0 });
          this.creating.set(false);
          this.saving.set(false);
          this.load();
        },
        error: (e) => {
          this.error.set(e?.error?.error?.message ?? 'Failed to create application');
          this.saving.set(false);
        },
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
