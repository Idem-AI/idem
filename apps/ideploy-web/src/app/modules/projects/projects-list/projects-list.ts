import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../../shared/services/api.service';
import { Project } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-projects-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Projects</h1>
    @if (loading()) {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    } @else if (projects().length === 0) {
      <div class="box">No projects yet.</div>
    } @else {
      <div class="space-y-3">
        @for (project of projects(); track project.uuid) {
          <div class="box">
            <div class="font-semibold">{{ project.name }}</div>
            @if (project.description) {
              <div class="text-sm" style="color: var(--color-text-secondary)">
                {{ project.description }}
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ProjectsListComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
