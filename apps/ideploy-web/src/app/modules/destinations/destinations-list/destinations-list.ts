import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../../shared/services/api.service';
import { Destination, Server } from '../../../shared/models/ideploy.models';

interface ServerDestinations {
  server: Server;
  destinations: Destination[];
}

/** Destinations across all servers (Coolify destination.index). */
@Component({
  selector: 'app-destinations-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:#fff;">Destinations</h1>
    @if (rows().length === 0) {
      <div class="box">No servers yet — add a server to create Docker destinations.</div>
    } @else {
      <div class="space-y-4">
        @for (row of rows(); track row.server.uuid) {
          <div class="box">
            <div class="mb-2 flex items-center gap-2">
              <i class="fa-solid fa-server" style="color:#2563eb;"></i>
              <span class="font-semibold">{{ row.server.name }}</span>
            </div>
            @if (row.destinations.length === 0) {
              <p class="text-sm" style="color: var(--color-text-secondary)">No destinations.</p>
            } @else {
              @for (d of row.destinations; track d.uuid) {
                <div class="text-sm">
                  <i class="fa-solid fa-network-wired mr-2" style="color:#8d919a;"></i>
                  {{ d.name }} · network <code>{{ d.network }}</code>
                </div>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class DestinationsListComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly rows = signal<ServerDestinations[]>([]);

  ngOnInit(): void {
    this.api.listServers().subscribe((servers) => {
      this.rows.set(servers.map((server) => ({ server, destinations: [] })));
      for (const server of servers) {
        this.api.listDestinations(server.uuid).subscribe((destinations) => {
          this.rows.update((current) =>
            current.map((r) => (r.server.uuid === server.uuid ? { ...r, destinations } : r))
          );
        });
      }
    });
  }
}
