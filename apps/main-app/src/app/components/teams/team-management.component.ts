import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@idem/shared-auth-client';
import { AuthClientService } from '../../services/auth-client.service';
import { TeamRole } from '@idem/shared-models';
import { Observable } from 'rxjs';
import type { TeamModel } from '@idem/shared-models';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">My Teams</h1>
        <button
          (click)="showCreateModal = true"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + Create Team
        </button>
      </div>

      <div *ngIf="loading$ | async" class="flex items-center justify-center min-h-[400px]">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading teams...</p>
        </div>
      </div>

      <div *ngIf="error$ | async as error" class="flex items-center justify-center min-h-[400px]">
        <div class="text-center">
          <div class="text-red-500 text-xl mb-4">⚠️</div>
          <p class="text-red-600">Error: {{ error.message }}</p>
          <button
            (click)="authService.fetchTeams()"
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>

      <div *ngIf="!(loading$ | async) && !(error$ | async)">
        <div *ngIf="(teams$ | async)?.length === 0" class="text-center py-12">
          <p class="text-gray-500 mb-4">You don't have any teams yet.</p>
          <button
            (click)="showCreateModal = true"
            class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Create Your First Team
          </button>
        </div>

        <div
          *ngIf="(teams$ | async)?.length! > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <div
            *ngFor="let team of teams$ | async"
            class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-xl font-semibold text-gray-900">{{ team.name }}</h2>
              <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {{ team.members.length }} {{ team.members.length === 1 ? 'member' : 'members' }}
              </span>
            </div>

            <p *ngIf="team.description" class="text-gray-600 text-sm mb-4">
              {{ team.description }}
            </p>

            <div class="space-y-2 mb-4">
              <h3 class="text-sm font-medium text-gray-700">Members:</h3>
              <div class="space-y-1">
                <div
                  *ngFor="let member of team.members.slice(0, 3)"
                  class="flex justify-between items-center text-sm"
                >
                  <span class="text-gray-700">{{ member.displayName }}</span>
                  <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                    {{ member.role }}
                  </span>
                </div>
                <p *ngIf="team.members.length > 3" class="text-xs text-gray-500">
                  +{{ team.members.length - 3 }} more
                </p>
              </div>
            </div>

            <button
              (click)="openInviteModal(team.id!)"
              class="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              Invite User
            </button>
          </div>
        </div>
      </div>

      <!-- Create Team Modal -->
      <div
        *ngIf="showCreateModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 class="text-2xl font-bold mb-4">Create Team</h2>
          <form (ngSubmit)="handleCreateTeam()">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2"> Team Name * </label>
              <input
                type="text"
                [(ngModel)]="newTeam.name"
                name="name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter team name"
                required
              />
            </div>

            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2"> Description </label>
              <textarea
                [(ngModel)]="newTeam.description"
                name="description"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter team description"
                rows="3"
              ></textarea>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                (click)="showCreateModal = false"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create Team
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Invite User Modal -->
      <div
        *ngIf="showInviteModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 class="text-2xl font-bold mb-4">Invite User</h2>
          <form (ngSubmit)="handleInviteUser()">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2"> Email * </label>
              <input
                type="email"
                [(ngModel)]="newInvite.email"
                name="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
                required
              />
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2"> Display Name * </label>
              <input
                type="text"
                [(ngModel)]="newInvite.displayName"
                name="displayName"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
                required
              />
            </div>

            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2"> Role * </label>
              <select
                [(ngModel)]="newInvite.role"
                name="role"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                (click)="showInviteModal = false"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class TeamManagementComponent implements OnInit {
  teams$!: Observable<TeamModel[]>;
  loading$!: Observable<boolean>;
  error$!: Observable<Error | null>;

  showCreateModal = false;
  showInviteModal = false;
  selectedTeamId: string | null = null;

  newTeam = { name: '', description: '' };
  newInvite: { email: string; displayName: string; role: TeamRole } = {
    email: '',
    displayName: '',
    role: 'member' as TeamRole,
  };

  constructor(
    public authService: AuthService,
    private authClientService: AuthClientService
  ) {
    this.authService.initialize(this.authClientService.getClient());
    this.teams$ = this.authService.teams$;
    this.loading$ = this.authService.loading$;
    this.error$ = this.authService.error$;
  }

  ngOnInit() {
    this.authService.fetchTeams();
  }

  async handleCreateTeam() {
    try {
      await this.authService.createTeam(this.newTeam.name, this.newTeam.description);
      this.showCreateModal = false;
      this.newTeam = { name: '', description: '' };
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team. Please try again.');
    }
  }

  openInviteModal(teamId: string) {
    this.selectedTeamId = teamId;
    this.showInviteModal = true;
  }

  async handleInviteUser() {
    if (this.selectedTeamId) {
      try {
        await this.authService.inviteUser(
          this.newInvite.email,
          this.newInvite.displayName,
          this.selectedTeamId,
          this.newInvite.role
        );
        alert('Invitation sent successfully!');
        this.showInviteModal = false;
        this.newInvite = { email: '', displayName: '', role: 'member' as TeamRole };
      } catch (error) {
        console.error('Error sending invitation:', error);
        alert('Failed to send invitation. Please try again.');
      }
    }
  }
}
