import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { BUILDERS_PROGRAM, BuilderSignals, BuilderStatus } from '@idem/shared-models/builders/program';
import { environment } from '../../../../environments/environment';

export interface BuilderApplicationView {
  id: string;
  projectId: string;
  projectName: string;
  pitch: string;
  publicUrl?: string;
  status: BuilderStatus;
  decidedAt?: string;
  decisionNote?: string;
  welcomeBonusXaf?: number;
  showcase: { visible: boolean };
  /** Adresse de la fiche publique, une fois la candidature acceptée. */
  slug?: string;
  publication?: { showTeam: boolean };
  createdAt: string;
}

export interface BuildersMe {
  applications: BuilderApplicationView[];
  isBuilder: boolean;
  program: typeof BUILDERS_PROGRAM;
}

export interface BuilderEligibility {
  project: { id: string; name: string; description?: string; country?: string };
  signals: BuilderSignals;
  eligible: boolean;
  suggestedUrl?: string;
  current?: BuilderApplicationView;
}

/** Idem Builders, côté candidat : ses candidatures, l'éligibilité d'un projet, le dépôt. */
@Injectable({ providedIn: 'root' })
export class BuildersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.services?.api?.url || 'http://localhost:3001'}/builders`;

  me(): Observable<BuildersMe> {
    return this.http.get<BuildersMe>(`${this.base}/me`, { withCredentials: true });
  }

  eligibility(projectId: string): Observable<BuilderEligibility> {
    return this.http.get<BuilderEligibility>(`${this.base}/eligibility/${encodeURIComponent(projectId)}`, {
      withCredentials: true,
    });
  }

  /** Envoie une couverture ; l'API la redimensionne et rend son adresse. */
  uploadCover(file: File): Observable<{ url: string; width: number; height: number }> {
    const body = new FormData();
    body.append('cover', file);
    return this.http.post<{ url: string; width: number; height: number }>(`${this.base}/covers`, body, {
      withCredentials: true,
    });
  }

  apply(input: {
    projectId: string;
    pitch: string;
    publicUrl?: string;
    showTeam: boolean;
    coverUrl?: string;
    acceptTerms: boolean;
    termsVersion: string;
  }): Observable<{ application: BuilderApplicationView }> {
    return this.http.post<{ application: BuilderApplicationView }>(`${this.base}/applications`, input, {
      withCredentials: true,
    });
  }
}
