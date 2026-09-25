import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ProjectModel } from '@idem/shared-models';
import { ProjectService } from '../../modules/dashboard/services/project.service';
import { CookieService } from './cookie.service';

/**
 * Le projet en cours de consultation.
 *
 * Extrait de la barre latérale, où il vivait en même temps que la navigation du
 * projet et la barre du haut. Le sélecteur est visuellement dans la barre du
 * haut, la redirection « aucun projet » concerne la barre latérale : les deux
 * composants ont besoin de la même liste, et la charger deux fois donnerait
 * deux appels réseau et deux vérités possibles.
 *
 * L'identifiant retenu vit dans un cookie partagé entre les applications IDEM :
 * passer d'iCode au tableau de bord ne doit pas faire perdre le projet ouvert.
 */
@Injectable({ providedIn: 'root' })
export class CurrentProjectService {
  private readonly projectService = inject(ProjectService);
  private readonly cookies = inject(CookieService);
  private readonly router = inject(Router);

  private readonly _projects = signal<ProjectModel[]>([]);
  private readonly _selectedId = signal<string | null>(null);
  private readonly _isLoaded = signal(false);

  readonly projects = this._projects.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();
  /**
   * Identifiant du projet ouvert. Lu par les modes qui travaillent avec
   * l'identifiant plutôt qu'avec l'objet (le chat interroge l'API par id avant
   * même que la liste soit revenue).
   */
  readonly selectedId = this._selectedId.asReadonly();

  /** Le projet ouvert, ou `null` si aucun n'est retenu. */
  readonly selected = computed(() => {
    const id = this._selectedId();
    if (!id) return null;
    return this._projects().find((project) => project.id === id) ?? null;
  });

  readonly hasProjects = computed(() => this._projects().length > 0);

  constructor() {
    // Le cookie est lu d'emblée : l'écran peut afficher le bon nom dès que la
    // liste arrive, sans attendre un second tour.
    this._selectedId.set(this.cookies.get('projectId'));
  }

  /**
   * Charge la liste une fois par session.
   *
   * Les appelants suivants reçoivent l'état déjà chargé : la barre du haut et
   * la barre latérale s'initialisent l'une après l'autre, et un second appel
   * réseau n'apprendrait rien.
   *
   * Seule une liste non vide est tenue pour acquise. Une liste vide chargée
   * avant la création du premier projet, ou un appel en échec, restait sinon
   * en cache toute la session : ouvrir ensuite un projet renvoyait vers la
   * création, la barre latérale croyant le compte sans projet.
   */
  load(force = false): Observable<ProjectModel[]> {
    if (this._isLoaded() && this._projects().length > 0 && !force) {
      return of(this._projects());
    }

    return this.projectService.getProjects().pipe(
      tap((projects) => this.replaceAll(projects)),
    );
  }

  /**
   * Remplace la liste par une version fraîche venue d'ailleurs.
   *
   * La page « Mes projets » charge sa propre liste : la reverser ici évite que
   * le projet cliqué soit inconnu de la barre latérale.
   */
  replaceAll(projects: ProjectModel[]): void {
    this._projects.set(projects);
    this._isLoaded.set(true);
    this.reconcileSelection(projects);
  }

  /**
   * Aligne le projet retenu sur ce qui existe réellement.
   *
   * Un cookie peut désigner un projet supprimé, ou appartenir à un autre
   * compte après un changement de session. Plutôt que de laisser l'interface
   * afficher un nom introuvable, on retombe sur le premier projet.
   */
  private reconcileSelection(projects: ProjectModel[]): void {
    if (projects.length === 0) {
      this._selectedId.set(null);
      return;
    }

    const current = this._selectedId();
    if (current && projects.some((project) => project.id === current)) return;

    const first = projects[0];
    if (first?.id) this.select(first.id, { navigate: false });
  }

  /**
   * Remplace (ou ajoute) un projet dans la liste.
   *
   * Le détail complet d'un projet — `analysisResultModel`, donc l'état réel de
   * chaque livrable — n'arrive qu'à la demande. Quel que soit le mode qui le
   * demande, il est reversé ici : sans cela, générer un business plan dans le
   * chat laissait le tableau de bord afficher l'ancien état jusqu'au prochain
   * rechargement.
   */
  upsert(project: ProjectModel): void {
    if (!project?.id) return;
    this._projects.update((projects) => {
      const index = projects.findIndex((existing) => existing.id === project.id);
      if (index === -1) return [...projects, project];
      const next = [...projects];
      next[index] = project;
      return next;
    });
  }

  /** Recharge le détail complet du projet ouvert et le partage. */
  refreshSelected(): Observable<ProjectModel | null> {
    const id = this._selectedId();
    if (!id) return of(null);
    return this.projectService.getProjectById(id).pipe(
      tap((project) => {
        if (project) this.upsert(project);
      }),
      catchError((error) => {
        console.error('CurrentProject: error refreshing the open project', error);
        return of(null);
      }),
    );
  }

  /** Retient un projet. La navigation est le cas courant, pas une fatalité. */
  select(projectId: string, options: { navigate?: boolean } = {}): void {
    this._selectedId.set(projectId);
    this.cookies.set('projectId', projectId);

    if (options.navigate !== false) {
      void this.router.navigate(['/project/dashboard']);
    }
  }
}
