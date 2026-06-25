import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Settings</h1>

    @if (version(); as v) {
      <div class="box mb-6">
        <div class="text-sm">iDeploy version: <strong>{{ v.version }}</strong></div>
        <div class="text-sm" style="color: var(--color-text-secondary)">
          Auto-update: {{ v.autoUpdate ? 'enabled' : 'disabled' }}
        </div>
      </div>
    }

    <section class="box mb-6">
      <h2 class="mb-3 font-semibold">Instance settings</h2>
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-sm">Wildcard domain</label>
          <input class="input" [(ngModel)]="wildcardDomain" />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="registrationEnabled" /> Registration enabled
        </label>
        <button class="button" (click)="save()">Save</button>
      </div>
    </section>

    <section class="box">
      <h2 class="mb-3 font-semibold">Global search</h2>
      <input class="input mb-3" placeholder="Search projects, servers, apps, services…" [(ngModel)]="query" (ngModelChange)="onSearch()" />
      @for (hit of results(); track hit.uuid) {
        <div class="text-sm">
          <span class="rounded px-2 py-0.5 text-xs" style="background-color: var(--color-surface-2)">{{ hit.type }}</span>
          {{ hit.name }}
        </div>
      }
    </section>
  `,
})
export class SettingsPageComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly version = signal<{ version: string; autoUpdate: boolean } | null>(null);
  protected readonly results = signal<{ type: string; uuid: string; name: string }[]>([]);
  protected wildcardDomain = '';
  protected registrationEnabled = true;
  protected query = '';

  ngOnInit(): void {
    this.api.getVersion().subscribe((v) => this.version.set(v));
    this.api.getInstanceSettings().subscribe((s) => {
      this.wildcardDomain = (s['wildcard_domain'] as string) ?? '';
      this.registrationEnabled = Boolean(s['is_registration_enabled']);
    });
  }

  protected save(): void {
    this.api
      .updateInstanceSettings({
        wildcard_domain: this.wildcardDomain,
        is_registration_enabled: this.registrationEnabled,
      })
      .subscribe();
  }

  protected onSearch(): void {
    if (this.query.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.api.search(this.query).subscribe((r) => this.results.set(r));
  }
}
