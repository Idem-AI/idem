import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { Project } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-projects-list',
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:#fff;">Projects</h1>
      <button class="button" (click)="creating.set(!creating())">
        {{ creating() ? 'Cancel' : '+ New project' }}
      </button>
    </div>

    @if (creating()) {
      <form class="box mb-6 max-w-lg space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <div>
          <label class="mb-1 block text-sm">Name</label>
          <input class="input" formControlName="name" placeholder="My project" />
        </div>
        <div>
          <label class="mb-1 block text-sm">Description</label>
          <input class="input" formControlName="description" />
        </div>
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Creating…' : 'Create project' }}
        </button>
      </form>
    }

    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    } @else if (projects().length === 0) {
      <div class="box">No projects yet.</div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (project of projects(); track project.uuid) {
          <div class="db-glass p-5">
            <div class="mb-2 flex items-center justify-between">
              <a class="font-semibold hover:underline" style="color:#fff;" [routerLink]="['/projects', project.uuid]">{{ project.name }}</a>
              <button class="text-xs text-red-400" (click)="remove(project)">delete</button>
            </div>
            @if (project.description) {
              <p class="text-sm" style="color: var(--color-text-secondary)">{{ project.description }}</p>
            }
            <div class="mt-3 flex justify-end">
              <a [routerLink]="['/projects', project.uuid]" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#b4c5ff;">
                View details <i class="fa-solid fa-chevron-right text-[10px]"></i>
              </a>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ProjectsListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.createProject(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ name: '', description: '' });
        this.creating.set(false);
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? 'Failed to create project');
        this.saving.set(false);
      },
    });
  }

  protected remove(project: Project): void {
    this.api.deleteProject(project.uuid).subscribe(() => {
      this.projects.update((list) => list.filter((p) => p.uuid !== project.uuid));
    });
  }
}
