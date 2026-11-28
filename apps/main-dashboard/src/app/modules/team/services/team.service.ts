import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MemberRoleInput,
  ProjectAccess,
  ProjectPermissions,
  ProjectTeamView,
  ReceivedInvitationView,
  TeamErrorCode,
} from '@idem/shared-models';
import { environment } from '../../../../environments/environment';

export type PendingInvitation = ReceivedInvitationView & { memberId: string };

/**
 * L'équipe d'un projet, côté tableau de bord (`/team/*` de l'API).
 * Toutes les réponses de gestion renvoient l'équipe complète à jour : l'écran
 * remplace son état d'un coup, sans recalcul local qui pourrait diverger.
 */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.services.api.url}/team`;

  access(projectId: string): Observable<ProjectAccess> {
    return this.http.get<ProjectAccess>(`${this.base}/projects/${encodeURIComponent(projectId)}/access`);
  }

  team(projectId: string): Observable<ProjectTeamView> {
    return this.http.get<ProjectTeamView>(this.projectUrl(projectId));
  }

  invite(projectId: string, email: string, role: MemberRoleInput): Observable<ProjectTeamView> {
    return this.http.post<ProjectTeamView>(`${this.projectUrl(projectId)}/invitations`, { email, role });
  }

  resend(projectId: string, memberId: string): Observable<ProjectTeamView> {
    return this.http.post<ProjectTeamView>(`${this.memberUrl(projectId, memberId)}/resend`, {});
  }

  updateMember(projectId: string, memberId: string, role: MemberRoleInput): Observable<ProjectTeamView> {
    return this.http.patch<ProjectTeamView>(this.memberUrl(projectId, memberId), { role });
  }

  removeMember(projectId: string, memberId: string): Observable<ProjectTeamView> {
    return this.http.delete<ProjectTeamView>(this.memberUrl(projectId, memberId));
  }

  createGroup(projectId: string, name: string, permissions: ProjectPermissions): Observable<ProjectTeamView> {
    return this.http.post<ProjectTeamView>(`${this.projectUrl(projectId)}/groups`, { name, permissions });
  }

  updateGroup(
    projectId: string,
    groupId: string,
    changes: { name?: string; permissions?: ProjectPermissions },
  ): Observable<ProjectTeamView> {
    return this.http.patch<ProjectTeamView>(`${this.projectUrl(projectId)}/groups/${encodeURIComponent(groupId)}`, changes);
  }

  deleteGroup(projectId: string, groupId: string): Observable<ProjectTeamView> {
    return this.http.delete<ProjectTeamView>(`${this.projectUrl(projectId)}/groups/${encodeURIComponent(groupId)}`);
  }

  leave(projectId: string): Observable<void> {
    return this.http.post<void>(`${this.projectUrl(projectId)}/leave`, {});
  }

  myInvitations(): Observable<PendingInvitation[]> {
    return this.http.get<PendingInvitation[]>(`${this.base}/invitations`);
  }

  invitation(token: string): Observable<ReceivedInvitationView> {
    return this.http.get<ReceivedInvitationView>(`${this.base}/invitations/${encodeURIComponent(token)}`);
  }

  answer(ref: { token?: string; memberId?: string }, accept: boolean): Observable<{ projectId: string; status: string }> {
    const answer = accept ? 'accept' : 'decline';
    const url = ref.token
      ? `${this.base}/invitations/${encodeURIComponent(ref.token)}/${answer}`
      : `${this.base}/invitations/id/${encodeURIComponent(ref.memberId ?? '')}/${answer}`;
    return this.http.post<{ projectId: string; status: string }>(url, {});
  }

  /** Le code d'erreur de l'API, pour une phrase traduite (`team.errors.<code>`). */
  static errorCode(error: unknown): TeamErrorCode | 'generic' {
    const code = (error as HttpErrorResponse)?.error?.error;
    return typeof code === 'string' ? (code as TeamErrorCode) : 'generic';
  }

  private projectUrl(projectId: string): string {
    return `${this.base}/projects/${encodeURIComponent(projectId)}`;
  }

  private memberUrl(projectId: string, memberId: string): string {
    return `${this.projectUrl(projectId)}/members/${encodeURIComponent(memberId)}`;
  }
}
