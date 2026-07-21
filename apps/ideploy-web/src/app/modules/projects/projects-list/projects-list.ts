import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Project } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-projects-list',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center justify-between">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">{{ 'projects.list.title' | translate }}</h1>
      <button class="button" (click)="creating.set(!creating())">
        {{ (creating() ? 'projects.common.cancel' : 'projects.list.newProject') | translate }}
      </button>
    </div>

    @if (creating()) {
      <form class="box mb-6 max-w-lg space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <div>
          <label class="mb-1 block text-sm">{{ 'projects.list.name' | translate }}</label>
          <input class="input" formControlName="name" [placeholder]="'projects.list.namePlaceholder' | translate" />
        </div>
        <div>
          <label class="mb-1 block text-sm">{{ 'projects.list.description' | translate }}</label>
          <input class="input" formControlName="description" />
        </div>
        @if (error()) {
          <p class="text-sm" style="color:var(--color-danger);">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ (saving() ? 'projects.list.creating' : 'projects.list.createProject') | translate }}
        </button>
      </form>
    }

    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'projects.common.loading' | translate }}</p>
    } @else if (projects().length === 0) {
      <div class="box">{{ 'projects.list.noProjects' | translate }}</div>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (project of projects(); track project.uuid) {
          <div class="db-glass p-5">
            <div class="mb-2 flex items-center justify-between">
              <a class="font-semibold hover:underline" style="color:var(--color-text-primary);" [routerLink]="['/projects', project.uuid]">{{ project.name }}</a>
              <button class="text-xs" style="color:var(--color-danger);" (click)="remove(project)">{{ 'projects.list.delete' | translate }}</button>
            </div>
            @if (project.description) {
              <p class="text-sm" style="color: var(--color-text-secondary)">{{ project.description }}</p>
            }
            <div class="mt-3 flex justify-end">
              <a [routerLink]="['/projects', project.uuid]" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--color-primary-400);">
                {{ 'projects.list.viewDetails' | translate }} <i class="fa-solid fa-chevron-right text-[10px]"></i>
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
  private translate = inject(TranslateService);

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
        this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.errCreateProject'));
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
