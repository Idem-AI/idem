import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Un projet IDEM partagé avec ce compte, vu d'iDeploy. */
export interface SharedSpace {
  teamId: number;
  projectId: string;
  projectName: string;
  ownerName: string;
  level: 'read' | 'write';
  appCount: number;
}

const STORAGE_KEY = 'ideploy:shared-team';

/**
 * L'espace dans lequel on travaille : le sien, ou celui d'un projet IDEM dont
 * on est membre (équipe du projet, espace « Mise en ligne »).
 *
 * Dans un espace partagé, chaque requête porte `X-Current-Team` (l'équipe du
 * propriétaire) et l'API n'ouvre que les applications du projet ; l'interface,
 * elle, ne montre que les applications. Le choix est retenu sur ce navigateur.
 */
@Injectable({ providedIn: 'root' })
export class SharedSpaceService {
  private readonly http = inject(HttpClient);

  readonly spaces = signal<SharedSpace[]>([]);
  /** Équipe du propriétaire quand on est dans un espace partagé, sinon `null`. */
  readonly activeTeamId = signal<number | null>(readStored());

  readonly active = computed(() => {
    const teamId = this.activeTeamId();
    return teamId === null ? null : (this.spaces().find((space) => space.teamId === teamId) ?? null);
  });
  readonly isShared = computed(() => this.activeTeamId() !== null);

  load(): void {
    // Sans l'en-tête de l'espace partagé : la liste vient de son propre compte.
    this.http
      .get<{ data: SharedSpace[] }>(`${environment.api.url}/api/${environment.api.version}/team/shared`, {
        headers: { 'X-Ideploy-Own-Space': '1' },
      })
      .subscribe({
        next: (response) => {
          const spaces = response?.data ?? [];
          this.spaces.set(spaces);
          // Arrivée depuis le tableau de bord (« Ouvrir dans iDeploy » d'un projet
          // partagé) : on entre directement dans l'espace de ce projet.
          const wanted = new URLSearchParams(window.location.search).get('idemProject');
          const target = wanted ? spaces.find((space) => space.projectId === wanted) : undefined;
          if (target && target.teamId !== this.activeTeamId()) {
            this.switchTo(target.teamId);
            return;
          }
          // L'accès a été retiré entre-temps : retour à son espace.
          const teamId = this.activeTeamId();
          if (teamId !== null && !spaces.some((space) => space.teamId === teamId)) this.leave();
        },
        error: () => this.spaces.set([]),
      });
  }

  /** Entrer dans l'espace partagé `teamId`, ou revenir au sien avec `null`. Recharge l'application. */
  switchTo(teamId: number | null): void {
    if (teamId === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(teamId));
    // Toutes les données en mémoire (applications, compteurs) appartiennent à l'autre espace.
    window.location.assign(teamId === null ? '/dashboard' : '/applications');
  }

  private leave(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.activeTeamId.set(null);
    window.location.assign('/dashboard');
  }
}

function readStored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** L'équipe à annoncer à l'API, lue sans injection (utilisée par l'intercepteur). */
export function storedSharedTeam(): number | null {
  return readStored();
}
