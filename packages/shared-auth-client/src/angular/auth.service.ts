import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthClient } from '../core/AuthClient';
import { TeamModel, RolePermissions, TeamRole } from '@idem/shared-models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authClient!: AuthClient;

  private teamsSubject = new BehaviorSubject<TeamModel[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(true);
  private errorSubject = new BehaviorSubject<Error | null>(null);

  public teams$ = this.teamsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  initialize(authClient: AuthClient) {
    this.authClient = authClient;
    this.fetchTeams();
  }

  async fetchTeams(): Promise<void> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    try {
      const teams = await this.authClient.getMyTeams();
      this.teamsSubject.next(teams);
    } catch (error) {
      this.errorSubject.next(error as Error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async createTeam(name: string, description?: string): Promise<TeamModel> {
    const team = await this.authClient.createTeam({ name, description });
    await this.fetchTeams();
    return team;
  }

  async inviteUser(
    email: string,
    displayName: string,
    teamId: string,
    role: TeamRole
  ): Promise<void> {
    await this.authClient.createInvitation({
      email,
      displayName,
      invitationType: 'team',
      teamId,
      teamRole: role,
    });
  }

  async addTeamMember(
    teamId: string,
    email: string,
    displayName: string,
    role: TeamRole
  ): Promise<TeamModel> {
    const team = await this.authClient.addTeamMember(teamId, { email, displayName, role });
    await this.fetchTeams();
    return team;
  }

  async removeMember(teamId: string, memberId: string): Promise<TeamModel> {
    const team = await this.authClient.removeMember(teamId, memberId);
    await this.fetchTeams();
    return team;
  }

  getTeams(): TeamModel[] {
    return this.teamsSubject.value;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ProjectPermissionsService {
  private authClient!: AuthClient;

  private permissionsSubject = new BehaviorSubject<RolePermissions | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(true);
  private errorSubject = new BehaviorSubject<Error | null>(null);

  public permissions$ = this.permissionsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  initialize(authClient: AuthClient) {
    this.authClient = authClient;
  }

  async fetchPermissions(projectId: string): Promise<void> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    try {
      const permissions = await this.authClient.getProjectPermissions(projectId);
      this.permissionsSubject.next(permissions);
    } catch (error) {
      this.errorSubject.next(error as Error);
      this.permissionsSubject.next(null);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  hasPermission(permission: keyof RolePermissions): boolean {
    const permissions = this.permissionsSubject.value;
    return permissions ? permissions[permission] : false;
  }

  getPermissions(): RolePermissions | null {
    return this.permissionsSubject.value;
  }
}
