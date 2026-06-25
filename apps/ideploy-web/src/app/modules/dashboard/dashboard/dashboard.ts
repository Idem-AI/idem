import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { Project, Server } from '../../../shared/models/ideploy.models';

/**
 * Dashboard — Angular port of the Laravel `dashboard` Livewire view: a serif
 * hero title, an AI Smart Deploy callout, a Projects grid (with a create card)
 * and a Servers grid, using the same db-glass cards and status badges.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-8" style="font-size:48px;font-weight:700;color:#fff;line-height:1.1;">
      Dashboard
    </h1>

    <!-- AI Smart Deploy callout -->
    <div class="db-glass mb-8 flex items-center gap-4" style="padding:16px 20px;">
      <div class="w-11 h-11 rounded-xl flex items-center justify-center"
           style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);">
        <i class="fa-solid fa-wand-magic-sparkles text-white"></i>
      </div>
      <div class="flex items-center gap-3">
        <span style="font-size:15px;font-weight:600;color:#fff;">AI Smart Deploy</span>
        <span class="status-badge" style="background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.28);">SOON</span>
      </div>
      <p class="ml-2 text-sm" style="color:#8d919a;">Describe your app and let iDeploy configure and deploy it.</p>
    </div>

    <!-- Projects -->
    <div class="mb-4 flex items-center gap-2">
      <i class="fa-solid fa-layer-group" style="color:#2563eb;"></i>
      <h2 class="heading-serif" style="font-size:22px;font-weight:600;color:#fff;margin:0;">Projects</h2>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
      <a routerLink="/projects" class="db-add">
        <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3"
             style="background:#2d3449;color:#c3c6d7;">
          <i class="fa-solid fa-plus text-xl"></i>
        </div>
        <p style="font-size:13px;font-weight:700;color:#c3c6d7;">CREATE NEW PROJECT</p>
      </a>
      @for (project of projects(); track project.uuid) {
        <div class="db-glass p-5">
          <div class="flex items-center justify-between mb-3">
            <span style="font-size:16px;font-weight:600;color:#fff;">{{ project.name }}</span>
            <span class="status-badge" style="background:rgba(37,99,235,.12);color:#60a5fa;border:1px solid rgba(37,99,235,.28);">
              <span class="dbpulse" style="width:5px;height:5px;border-radius:50%;background:#60a5fa;"></span>active
            </span>
          </div>
          @if (project.description) {
            <p class="text-sm mb-3" style="color:#8d919a;">{{ project.description }}</p>
          }
          <div class="flex items-center justify-end">
            <a [routerLink]="['/projects']" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#b4c5ff;">
              View details <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </a>
          </div>
        </div>
      }
    </div>

    <!-- Servers -->
    <div class="mb-4 flex items-center gap-2">
      <i class="fa-solid fa-server" style="color:#2563eb;"></i>
      <h2 class="heading-serif" style="font-size:22px;font-weight:600;color:#fff;margin:0;">Servers</h2>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <a routerLink="/servers/new" class="db-add">
        <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3"
             style="background:#2d3449;color:#c3c6d7;">
          <i class="fa-solid fa-plus text-xl"></i>
        </div>
        <p style="font-size:13px;font-weight:700;color:#c3c6d7;">ADD A SERVER</p>
      </a>
      @for (server of servers(); track server.uuid) {
        <div class="db-glass p-5">
          <div class="flex items-center justify-between mb-2">
            <span style="font-size:16px;font-weight:600;color:#fff;">{{ server.name }}</span>
            <i class="fa-solid fa-server" style="color:#2563eb;"></i>
          </div>
          <p class="text-sm" style="color:#8d919a;">{{ server.user }}&#64;{{ server.ip }}:{{ server.port }}</p>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly servers = signal<Server[]>([]);

  ngOnInit(): void {
    this.api.listProjects().subscribe((p) => this.projects.set(p));
    this.api.listServers().subscribe((s) => this.servers.set(s));
  }
}
