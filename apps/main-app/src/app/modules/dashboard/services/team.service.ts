import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  TeamModel,
  TeamMemberModel,
  ProjectTeamModel,
  UserPermissions,
  UserAccessResponse,
  ProjectRole,
} from '../models/team.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TeamService {
  private apiUrl = `${environment.services.api.url}`;
  private http = inject(HttpClient);

  /**
   * Creates a new team
   * @param teamData Team data to create
   * @returns Observable of the created team
   */
  createTeam(teamData: {
    name: string;
    description?: string;
    members?: TeamMemberModel[];
  }): Observable<TeamModel> {
    return this.http.post<ApiResponse<TeamModel>>(`${this.apiUrl}/teams`, teamData).pipe(
      map((response) => response.data),
      tap((data) => console.log('createTeam response:', data)),
      catchError((error) => {
        console.error('Error in createTeam:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets all teams for the authenticated user
   * @returns Observable of team array
   */
  getUserTeams(): Observable<TeamModel[]> {
    return this.http.get<ApiResponse<TeamModel[]>>(`${this.apiUrl}/teams/my-teams`).pipe(
      map((response) => response.data),
      tap((data) => console.log('getUserTeams response:', data)),
      catchError((error) => {
        console.error('Error in getUserTeams:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets a team by ID
   * @param teamId ID of the team to retrieve
   * @returns Observable of the team
   */
  getTeam(teamId: string): Observable<TeamModel> {
    return this.http.get<ApiResponse<TeamModel>>(`${this.apiUrl}/teams/${teamId}`).pipe(
      map((response) => response.data),
      tap((data) => console.log(`getTeam response for ${teamId}:`, data)),
      catchError((error) => {
        console.error(`Error in getTeam for ${teamId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds a member to a team
   * @param teamId Team ID
   * @param member Member data
   * @returns Observable of the updated team
   */
  addTeamMember(
    teamId: string,
    member: { email: string; displayName: string; role: string }
  ): Observable<TeamModel> {
    return this.http
      .post<ApiResponse<TeamModel>>(`${this.apiUrl}/teams/${teamId}/members`, member)
      .pipe(
        map((response) => response.data),
        tap((data) => console.log(`addTeamMember response for ${teamId}:`, data)),
        catchError((error) => {
          console.error(`Error in addTeamMember for ${teamId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Updates a member's role in a team
   * @param teamId Team ID
   * @param userId User ID
   * @param role New role
   * @returns Observable of the updated team
   */
  updateMemberRole(teamId: string, userId: string, role: string): Observable<TeamModel> {
    return this.http
      .put<TeamModel>(`${this.apiUrl}/teams/${teamId}/members/role`, { userId, role })
      .pipe(
        tap((response) => console.log(`updateMemberRole response for ${teamId}:`, response)),
        catchError((error) => {
          console.error(`Error in updateMemberRole for ${teamId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Removes a member from a team
   * @param teamId Team ID
   * @param memberId Member ID
   * @returns Observable of void
   */
  removeMember(teamId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/teams/${teamId}/members/${memberId}`).pipe(
      tap((response) => console.log(`removeMember response for ${teamId}:`, response)),
      catchError((error) => {
        console.error(`Error in removeMember for ${teamId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds a team to a project
   * @param projectId Project ID
   * @param teamId Team ID
   * @param roles Project roles for the team
   * @returns Observable of the project team
   */
  addTeamToProject(
    projectId: string,
    teamId: string,
    roles: ProjectRole[]
  ): Observable<ProjectTeamModel> {
    return this.http
      .post<
        ApiResponse<ProjectTeamModel>
      >(`${this.apiUrl}/projects/${projectId}/teams`, { teamId, roles })
      .pipe(
        map((response) => response.data),
        tap((data) => console.log(`addTeamToProject response for ${projectId}:`, data)),
        catchError((error) => {
          console.error(`Error in addTeamToProject for ${projectId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Gets all teams for a project
   * @param projectId Project ID
   * @returns Observable of project teams array
   */
  getProjectTeams(projectId: string): Observable<ProjectTeamModel[]> {
    return this.http
      .get<ApiResponse<ProjectTeamModel[]>>(`${this.apiUrl}/projects/${projectId}/teams`)
      .pipe(
        map((response) => response.data),
        tap((data) => console.log(`getProjectTeams response for ${projectId}:`, data)),
        catchError((error) => {
          console.error(`Error in getProjectTeams for ${projectId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Updates team roles in a project
   * @param projectId Project ID
   * @param teamId Team ID
   * @param roles New roles
   * @returns Observable of the updated project team
   */
  updateTeamRoles(
    projectId: string,
    teamId: string,
    roles: ProjectRole[]
  ): Observable<ProjectTeamModel> {
    return this.http
      .put<ProjectTeamModel>(`${this.apiUrl}/projects/${projectId}/teams/roles`, {
        teamId,
        roles,
      })
      .pipe(
        tap((response) => console.log(`updateTeamRoles response for ${projectId}:`, response)),
        catchError((error) => {
          console.error(`Error in updateTeamRoles for ${projectId}:`, error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Removes a team from a project
   * @param projectId Project ID
   * @param teamId Team ID
   * @returns Observable of void
   */
  removeTeamFromProject(projectId: string, teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}/teams/${teamId}`).pipe(
      tap((response) => console.log(`removeTeamFromProject response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in removeTeamFromProject for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets user permissions for a project
   * @param projectId Project ID
   * @returns Observable of user permissions
   */
  getUserPermissions(projectId: string): Observable<UserPermissions> {
    return this.http.get<UserPermissions>(`${this.apiUrl}/projects/${projectId}/permissions`).pipe(
      tap((response) => console.log(`getUserPermissions response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in getUserPermissions for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Checks if user has access to a project
   * @param projectId Project ID
   * @returns Observable of user access response
   */
  checkUserAccess(projectId: string): Observable<UserAccessResponse> {
    return this.http.get<UserAccessResponse>(`${this.apiUrl}/projects/${projectId}/access`).pipe(
      tap((response) => console.log(`checkUserAccess response for ${projectId}:`, response)),
      catchError((error) => {
        console.error(`Error in checkUserAccess for ${projectId}:`, error);
        return throwError(() => error);
      })
    );
  }
}
