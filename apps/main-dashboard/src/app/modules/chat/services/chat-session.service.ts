import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { CurrentProjectService } from '../../../shared/services/current-project.service';

/**
 * Session du mode Chat : le projet ouvert et la liste des projets.
 *
 * Tout est délégué au magasin partagé (`CurrentProjectService`), celui que le
 * mode Avancé utilise déjà. Le chat tenait auparavant sa propre liste et son
 * propre cache de détail : les deux modes lisaient le même cookie mais deux
 * états différents, et un projet créé, choisi ou régénéré d'un côté n'était vu
 * de l'autre qu'après rechargement de la page.
 *
 * Ce service ne garde donc que le vocabulaire du chat (`activeProject`,
 * `loadProjects`…) par-dessus ce magasin.
 */
@Injectable({ providedIn: 'root' })
export class ChatSessionService {
  private readonly current = inject(CurrentProjectService);

  readonly activeProjectId = this.current.selectedId;
  readonly projects = this.current.projects;
  readonly projectsLoaded = this.current.isLoaded;
  readonly isLoadingProjects = signal(false);

  readonly activeProject = computed<ProjectModel | null>(() => this.current.selected());

  /** Charge la liste des projets (une seule fois par session, sauf force). */
  async loadProjects(force = false): Promise<ProjectModel[]> {
    this.isLoadingProjects.set(true);
    try {
      return (await firstValueFrom(this.current.load(force))) ?? [];
    } catch (error) {
      console.error('ChatSession: error loading projects', error);
      return [];
    } finally {
      this.isLoadingProjects.set(false);
    }
  }

  /**
   * Choisit un projet sans quitter le chat. Le cookie `projectId` est partagé
   * avec le mode Avancé et les autres applications IDEM : le projet reste le
   * même d'un mode à l'autre.
   */
  selectProject(projectId: string): void {
    this.current.select(projectId, { navigate: false });
  }

  /** Recharge le détail complet du projet ouvert (`analysisResultModel`). */
  async fetchActiveProjectDetails(): Promise<ProjectModel | null> {
    return (await firstValueFrom(this.current.refreshSelected())) ?? null;
  }

  /** Partage un projet mis à jour avec les deux modes. */
  upsertProject(project: ProjectModel): void {
    this.current.upsert(project);
  }
}
