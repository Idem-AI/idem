import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Destination, Server } from '../../../shared/models/ideploy.models';

interface ServerDestinations {
  server: Server;
  destinations: Destination[];
}

/** Destinations across all servers (Coolify destination.index) + creation. */
@Component({
  selector: 'app-destinations-list',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">{{ 'destinations.title' | translate }}</h1>
    @if (rows().length === 0) {
      <div class="box">{{ 'destinations.empty' | translate }}</div>
    } @else {
      <div class="space-y-4">
        @for (row of rows(); track row.server.uuid) {
          <div class="box">
            <div class="mb-2 flex items-center gap-2">
              <i class="fa-solid fa-server" style="color:var(--color-primary-500);"></i>
              <span class="font-semibold">{{ row.server.name }}</span>
            </div>
            @if (row.destinations.length === 0) {
              <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'destinations.noDestinations' | translate }}</p>
            } @else {
              @for (d of row.destinations; track d.uuid) {
                <div class="text-sm">
                  <i class="fa-solid fa-network-wired mr-2" style="color:var(--color-text-tertiary);"></i>
                  {{ d.name }} · {{ 'destinations.network' | translate }} <code>{{ d.network }}</code>
                </div>
              }
            }
            <form class="mt-3 flex gap-2" [formGroup]="formFor(row.server.uuid)" (ngSubmit)="create(row.server.uuid)">
              <input class="input flex-1" [placeholder]="'destinations.networkPlaceholder' | translate" [formControl]="formFor(row.server.uuid).controls.network" />
              <button class="button" type="submit" [disabled]="formFor(row.server.uuid).invalid">{{ 'destinations.addDestination' | translate }}</button>
            </form>
          </div>
        }
      </div>
    }
  `,
})
export class DestinationsListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  protected readonly rows = signal<ServerDestinations[]>([]);
  private forms = new Map<string, ReturnType<DestinationsListComponent['build']>>();

  private build() {
    return this.fb.nonNullable.group({ network: ['ideploy', Validators.required] });
  }
  protected formFor(uuid: string) {
    let f = this.forms.get(uuid);
    if (!f) {
      f = this.build();
      this.forms.set(uuid, f);
    }
    return f;
  }

  ngOnInit(): void {
    this.api.listServers().subscribe((servers) => {
      this.rows.set(servers.map((server) => ({ server, destinations: [] })));
      for (const server of servers) this.refresh(server.uuid);
    });
  }

  private refresh(serverUuid: string): void {
    this.api.listDestinations(serverUuid).subscribe((destinations) => {
      this.rows.update((current) =>
        current.map((r) => (r.server.uuid === serverUuid ? { ...r, destinations } : r))
      );
    });
  }

  protected create(serverUuid: string): void {
    const form = this.formFor(serverUuid);
    if (form.invalid) return;
    this.api.createDestination(serverUuid, { network: form.getRawValue().network }).subscribe(() => {
      form.reset({ network: 'ideploy' });
      this.refresh(serverUuid);
    });
  }
}
