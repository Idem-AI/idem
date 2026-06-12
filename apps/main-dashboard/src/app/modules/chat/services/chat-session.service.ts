import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../dashboard/services/project.service';
import { CookieService } from '../../../shared/services/cookie.service';

/**
 * Session du mode Chat : projet actif (partagé avec le mode Avancé via le
 * cookie `projectId`) et liste des projets affichée dans la sidebar.
 */
@Injectable({ providedIn: 'root' })
export class ChatSessionService {
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);

  readonly activeProjectId = signal<string | null>(this.cookieService.get('projectId'));
  readonly projects = signal<ProjectModel[]>([]);
  readonly projectsLoaded = signal(false);
  readonly isLoadingProjects = signal(false);

  readonly activeProject = computed<ProjectModel | null>(() => {
    const id = this.activeProjectId();
    if (!id) return null;
    return this.projects().find((p) => p.id === id) ?? null;
  });

  /** Charge la liste des projets (une seule fois, sauf force). */
  async loadProjects(force = false): Promise<ProjectModel[]> {
    if (this.projectsLoaded() && !force) return this.projects();
    this.isLoadingProjects.set(true);
    try {
      const projects = (await firstValueFrom(this.projectService.getProjects())) ?? [];
      this.projects.set(projects);
      this.projectsLoaded.set(true);

      // Réconcilie le projet actif avec la liste réelle
      const currentId = this.activeProjectId();
      const exists = currentId && projects.some((p) => p.id === currentId);
      if (!exists) {
        const fallback = projects[0]?.id ?? null;
        if (fallback) {
          this.selectProject(fallback);
        } else {
          this.activeProjectId.set(null);
        }
      }
      return projects;
    } catch (error) {
      console.error('ChatSession: error loading projects', error);
      this.projects.set([]);
      this.projectsLoaded.set(true);
      return [];
    } finally {
      this.isLoadingProjects.set(false);
    }
  }

  /** Sélectionne un projet : même cookie que le mode Avancé (état partagé). */
  selectProject(projectId: string): void {
    this.cookieService.set('projectId', projectId);
    this.activeProjectId.set(projectId);
  }

  /** Recharge le détail complet du projet actif (analysisResultModel inclus). */
  async fetchActiveProjectDetails(): Promise<ProjectModel | null> {
    const id = this.activeProjectId();
    if (!id) return null;
    try {
      const project = await firstValueFrom(this.projectService.getProjectById(id));
      if (project) {
        this.upsertProject(project);
      }
      return project ?? null;
    } catch (error) {
      console.error('ChatSession: error fetching project details', error);
      return null;
    }
  }

  /** Met à jour (ou ajoute) un projet dans la liste locale. */
  upsertProject(project: ProjectModel): void {
    if (!project.id) return;
    this.projects.update((list) => {
      const index = list.findIndex((p) => p.id === project.id);
      if (index === -1) return [...list, project];
      const next = [...list];
      next[index] = project;
      return next;
    });
  }
}
