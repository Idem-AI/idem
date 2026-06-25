import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { Application, Project } from '../../../shared/models/ideploy.models';

interface EnvRow {
  id: number;
  uuid: string;
  name: string;
}

/**
 * Project detail — environments + resources + new-application form, mirroring
 * the Laravel project show / environment / new-resource flow.
 */
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (project(); as p) {
      <div class="mb-6 flex items-center gap-2">
        <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i>
        <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:#fff;">{{ p.name }}</h1>
      </div>

      @for (env of environments(); track env.id) {
        <section class="box mb-6">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold">Environment: {{ env.name }}</h2>
            <span class="text-xs" style="color: var(--color-text-secondary)">env #{{ env.id }}</span>
          </div>

          <!-- Applications in this environment -->
          @for (app of appsByEnv()[env.id] ?? []; track app.uuid) {
            <div class="mb-1 flex items-center gap-3 text-sm">
              <i class="fa-solid fa-cube" style="color:#60a5fa;"></i>
              <a class="font-semibold hover:underline" [routerLink]="['/applications', app.uuid]">{{ app.name }}</a>
              <span style="color: var(--color-text-secondary)">{{ app.git_repository }} · {{ app.status }}</span>
            </div>
          }

          <!-- New application -->
          <form class="mt-3 flex flex-wrap gap-2" [formGroup]="newAppForm(env.id)" (ngSubmit)="createApp(env.id)">
            <input class="input flex-1" placeholder="app name" [formControl]="newAppForm(env.id).controls.name" />
            <input class="input flex-1" placeholder="git repository URL" [formControl]="newAppForm(env.id).controls.git_repository" />
            <input class="input w-28" placeholder="branch" [formControl]="newAppForm(env.id).controls.git_branch" />
            <input class="input w-36" type="number" placeholder="destination id" [formControl]="newAppForm(env.id).controls.destination_id" />
            <button class="button" type="submit" [disabled]="newAppForm(env.id).invalid">New application</button>
          </form>
        </section>
      }
    } @else {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    }
  `,
})
export class ProjectDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  protected readonly project = signal<Project | null>(null);
  protected readonly environments = signal<EnvRow[]>([]);
  protected readonly appsByEnv = signal<Record<number, Application[]>>({});

  private uuid = '';
  private forms = new Map<number, ReturnType<ProjectDetailComponent['buildForm']>>();

  private buildForm() {
    return this.fb.nonNullable.group({
      name: ['', Validators.required],
      git_repository: ['', Validators.required],
      git_branch: ['main'],
      destination_id: [0],
    });
  }

  protected newAppForm(envId: number) {
    let f = this.forms.get(envId);
    if (!f) {
      f = this.buildForm();
      this.forms.set(envId, f);
    }
    return f;
  }

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.api.getProject(this.uuid).subscribe((p) => this.project.set(p));
    this.api.listEnvironments(this.uuid).subscribe((envs) => {
      this.environments.set(envs);
      for (const env of envs) {
        this.api.listApplications(env.id).subscribe((apps) => {
          this.appsByEnv.update((m) => ({ ...m, [env.id]: apps }));
        });
      }
    });
  }

  protected createApp(envId: number): void {
    const form = this.newAppForm(envId);
    if (form.invalid) return;
    const raw = form.getRawValue();
    this.api
      .createApplication({
        name: raw.name,
        environment_id: envId,
        git_repository: raw.git_repository,
        git_branch: raw.git_branch || 'main',
        destination_id: raw.destination_id || undefined,
        destination_type: raw.destination_id ? 'App\\Models\\StandaloneDocker' : undefined,
      })
      .subscribe(() => {
        form.reset({ name: '', git_repository: '', git_branch: 'main', destination_id: 0 });
        this.api.listApplications(envId).subscribe((apps) => {
          this.appsByEnv.update((m) => ({ ...m, [envId]: apps }));
        });
      });
  }
}
