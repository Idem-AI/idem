/**
 * Exemple d'intégration Angular pour main-app
 *
 * Installation:
 * npm install @idem/shared-auth-client firebase
 */

// 1. app.config.ts - Configuration de l'application
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService, ProjectPermissionsService } from '@idem/shared-auth-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    AuthService,
    ProjectPermissionsService,
  ],
};

// 2. auth-client.service.ts - Service pour initialiser AuthClient
import { Injectable } from '@angular/core';
import { AuthClient } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthClientService {
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient({
      apiBaseUrl: 'http://localhost:3001',
      getAuthToken: async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          return await user.getIdToken();
        }
        return null;
      },
    });
  }

  getClient(): AuthClient {
    return this.authClient;
  }
}

// 3. team-management.component.ts - Composant de gestion des équipes
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@idem/shared-auth-client';
import { AuthClientService } from './auth-client.service';
import type { TeamModel } from '@idem/shared-auth-client';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="team-management">
      <div class="header">
        <h1>My Teams</h1>
        <button (click)="showCreateModal = true">Create Team</button>
      </div>

      <div *ngIf="loading$ | async" class="loading">Loading teams...</div>

      <div *ngIf="error$ | async as error" class="error">Error: {{ error.message }}</div>

      <div *ngIf="!(loading$ | async) && !(error$ | async)" class="teams-grid">
        <div *ngFor="let team of teams$ | async" class="team-card">
          <h2>{{ team.name }}</h2>
          <p>{{ team.description }}</p>
          <p class="members-count">
            {{ team.members.length }} member{{ team.members.length !== 1 ? 's' : '' }}
          </p>

          <div class="members-list">
            <div *ngFor="let member of team.members" class="member">
              <span>{{ member.displayName }}</span>
              <span class="role">{{ member.role }}</span>
            </div>
          </div>

          <button (click)="openInviteModal(team.id!)">Invite User</button>
        </div>
      </div>

      <!-- Create Team Modal -->
      <div *ngIf="showCreateModal" class="modal">
        <div class="modal-content">
          <h2>Create Team</h2>
          <form (ngSubmit)="handleCreateTeam()">
            <input
              type="text"
              [(ngModel)]="newTeam.name"
              name="name"
              placeholder="Team name"
              required
            />
            <textarea
              [(ngModel)]="newTeam.description"
              name="description"
              placeholder="Description"
            ></textarea>
            <div class="actions">
              <button type="button" (click)="showCreateModal = false">Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Invite User Modal -->
      <div *ngIf="showInviteModal" class="modal">
        <div class="modal-content">
          <h2>Invite User</h2>
          <form (ngSubmit)="handleInviteUser()">
            <input
              type="email"
              [(ngModel)]="newInvite.email"
              name="email"
              placeholder="Email"
              required
            />
            <input
              type="text"
              [(ngModel)]="newInvite.displayName"
              name="displayName"
              placeholder="Display Name"
              required
            />
            <select [(ngModel)]="newInvite.role" name="role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <div class="actions">
              <button type="button" (click)="showInviteModal = false">Cancel</button>
              <button type="submit">Send Invitation</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .team-management {
        padding: 2rem;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
      }

      .teams-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
      }

      .team-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 1.5rem;
        background: white;
      }

      .modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-content {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        min-width: 400px;
      }

      input,
      textarea,
      select {
        width: 100%;
        padding: 0.5rem;
        margin: 0.5rem 0;
        border: 1px solid #ddd;
        border-radius: 4px;
      }

      button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        background: #007bff;
        color: white;
        cursor: pointer;
        margin: 0.25rem;
      }

      button:hover {
        background: #0056b3;
      }
    `,
  ],
})
export class TeamManagementComponent implements OnInit {
  teams$ = this.authService.teams$;
  loading$ = this.authService.loading$;
  error$ = this.authService.error$;

  showCreateModal = false;
  showInviteModal = false;
  selectedTeamId: string | null = null;

  newTeam = { name: '', description: '' };
  newInvite = { email: '', displayName: '', role: 'member' };

  constructor(
    private authService: AuthService,
    private authClientService: AuthClientService
  ) {
    // Initialiser le service avec le client
    this.authService.initialize(this.authClientService.getClient());
  }

  ngOnInit() {
    this.authService.fetchTeams();
  }

  async handleCreateTeam() {
    await this.authService.createTeam(this.newTeam.name, this.newTeam.description);
    this.showCreateModal = false;
    this.newTeam = { name: '', description: '' };
  }

  openInviteModal(teamId: string) {
    this.selectedTeamId = teamId;
    this.showInviteModal = true;
  }

  async handleInviteUser() {
    if (this.selectedTeamId) {
      await this.authService.inviteUser(
        this.newInvite.email,
        this.newInvite.displayName,
        this.selectedTeamId,
        this.newInvite.role
      );
      alert('Invitation sent!');
      this.showInviteModal = false;
      this.newInvite = { email: '', displayName: '', role: 'member' };
    }
  }
}

// 4. project-actions.component.ts - Composant avec permissions
@Component({
  selector: 'app-project-actions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="project-actions">
      <div *ngIf="loading$ | async">Loading permissions...</div>

      <div *ngIf="!(loading$ | async) && (permissions$ | async) as permissions">
        <button *ngIf="permissions.canEdit" (click)="editProject()">Edit Project</button>

        <button *ngIf="permissions.canDeploy" (click)="deployProject()">Deploy</button>

        <button *ngIf="permissions.canDelete" (click)="deleteProject()" class="danger">
          Delete Project
        </button>

        <button *ngIf="permissions.canManageTeams" (click)="manageTeams()">Manage Teams</button>
      </div>

      <div *ngIf="!(loading$ | async) && !(permissions$ | async)" class="no-access">
        You don't have access to this project
      </div>
    </div>
  `,
})
export class ProjectActionsComponent implements OnInit {
  permissions$ = this.permissionsService.permissions$;
  loading$ = this.permissionsService.loading$;

  constructor(
    private permissionsService: ProjectPermissionsService,
    private authClientService: AuthClientService
  ) {
    this.permissionsService.initialize(this.authClientService.getClient());
  }

  ngOnInit() {
    // Récupérer projectId depuis la route ou l'input
    const projectId = 'your-project-id';
    this.permissionsService.fetchPermissions(projectId);
  }

  editProject() {
    console.log('Edit project');
  }

  deployProject() {
    console.log('Deploy project');
  }

  deleteProject() {
    if (confirm('Are you sure?')) {
      console.log('Delete project');
    }
  }

  manageTeams() {
    console.log('Manage teams');
  }
}

// 5. Route Guard pour protéger les routes
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ProjectPermissionsService } from '@idem/shared-auth-client';

export const projectEditGuard: CanActivateFn = async (route) => {
  const permissionsService = inject(ProjectPermissionsService);
  const router = inject(Router);

  const projectId = route.params['projectId'];
  await permissionsService.fetchPermissions(projectId);

  if (permissionsService.hasPermission('canEdit')) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

// Utilisation dans les routes:
// {
//   path: 'project/:projectId/edit',
//   component: ProjectEditComponent,
//   canActivate: [projectEditGuard]
// }
