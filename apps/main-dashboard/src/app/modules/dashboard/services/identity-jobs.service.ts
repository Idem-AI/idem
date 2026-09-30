import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, of, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ColorModel, TypographyModel } from '../models/brand-identity.model';
import { LogoModel, LogoType } from '../models/logo.model';

export type IdentityJobKind = 'logos' | 'colors' | 'typography';

export interface IdentityJob {
  kind: IdentityJobKind;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  logos?: LogoModel[];
  colors?: ColorModel[];
  typography?: TypographyModel[];
  improvementBrief?: string;
  error?: 'generation_failed' | 'analysis_failed';
}

export type IdentityJobs = Partial<Record<IdentityJobKind, IdentityJob>>;

export interface LogoJobRequest {
  preferences?: { type?: LogoType; customDescription?: string };
  /** Améliorer le logo actuel, ou un logo tout juste importé. */
  improve?: 'current' | { svg: string };
}

const POLL_MS = 2000;

/**
 * Régénérations du panneau « Identité visuelle », suivies HORS du panneau.
 *
 * Les tâches tournent côté serveur et ne s'arrêtent que sur `cancel`. Ce
 * service racine en suit l'état tant qu'une tâche tourne : fermer le panneau,
 * changer de page ou le rouvrir ne perd rien, et après un rechargement
 * `track` retrouve la tâche en cours.
 */
@Injectable({ providedIn: 'root' })
export class IdentityJobsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/project/brandings`;

  private readonly state = signal<Record<string, IdentityJobs>>({});
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Une tâche vient de se terminer avec des résultats : la marque en base a changé. */
  readonly finished = new Subject<{ projectId: string; kind: IdentityJobKind }>();

  jobsFor(projectId: string): IdentityJobs {
    return this.state()[projectId] ?? {};
  }

  /** À appeler à l'ouverture : retrouve une tâche lancée avant un rechargement. */
  track(projectId: string): void {
    this.refresh(projectId);
  }

  start(projectId: string, kind: IdentityJobKind, body: LogoJobRequest = {}): Observable<IdentityJob> {
    return this.http.post<IdentityJob>(`${this.apiUrl}/${projectId}/identity/jobs/${kind}`, body).pipe(
      tap((job) => {
        this.set(projectId, kind, job);
        this.schedule(projectId);
      }),
    );
  }

  cancel(projectId: string, kind: IdentityJobKind): Observable<{ cancelled: boolean }> {
    return this.http
      .post<{ cancelled: boolean }>(`${this.apiUrl}/${projectId}/identity/jobs/${kind}/cancel`, {})
      .pipe(tap(() => this.refresh(projectId)));
  }

  private set(projectId: string, kind: IdentityJobKind, job: IdentityJob): void {
    this.state.update((all) => ({ ...all, [projectId]: { ...all[projectId], [kind]: job } }));
  }

  private refresh(projectId: string): void {
    this.http
      .get<IdentityJobs>(`${this.apiUrl}/${projectId}/identity/jobs`)
      .pipe(catchError(() => of(null)))
      .subscribe((jobs) => {
        if (!jobs) {
          // Réseau coupé un instant : on retente tant qu'une tâche était en cours.
          if (this.hasRunning(projectId)) this.schedule(projectId);
          return;
        }
        const previous = this.jobsFor(projectId);
        for (const kind of Object.keys(jobs) as IdentityJobKind[]) {
          const wasRunning = previous[kind]?.status === 'running';
          if (wasRunning && jobs[kind]?.status === 'done') this.finished.next({ projectId, kind });
        }
        this.state.update((all) => ({ ...all, [projectId]: jobs }));
        if (this.hasRunning(projectId)) this.schedule(projectId);
      });
  }

  private hasRunning(projectId: string): boolean {
    return Object.values(this.jobsFor(projectId)).some((job) => job?.status === 'running');
  }

  private schedule(projectId: string): void {
    clearTimeout(this.timers.get(projectId));
    this.timers.set(
      projectId,
      setTimeout(() => this.refresh(projectId), POLL_MS),
    );
  }
}
