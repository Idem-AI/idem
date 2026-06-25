import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import { Service, ServiceTemplate } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-services-list',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Services</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
        } @else if (services().length === 0) {
          <div class="box">No services yet.</div>
        } @else {
          <div class="space-y-3">
            @for (svc of services(); track svc.uuid) {
              <div class="box flex items-center justify-between">
                <div>
                  <div class="font-semibold">{{ svc.name }}</div>
                  <div class="text-sm" style="color: var(--color-text-secondary)">
                    {{ svc.service_type }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="button-secondary" (click)="action(svc, 'stop')">Stop</button>
                  <button class="button" (click)="action(svc, 'start')">Start</button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <form class="box space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <h2 class="font-semibold">Deploy a one-click service</h2>
        <div>
          <label class="mb-1 block text-sm">Template</label>
          <select class="input" formControlName="template">
            <option value="">— custom (none) —</option>
            @for (t of templates(); track t.name) {
              <option [value]="t.name">{{ t.name }} — {{ t.slogan }}</option>
            }
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm">Name</label>
          <input class="input" formControlName="name" />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-sm">Environment ID</label>
            <input class="input" type="number" formControlName="environment_id" />
          </div>
          <div class="flex-1">
            <label class="mb-1 block text-sm">Destination ID</label>
            <input class="input" type="number" formControlName="destination_id" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm">docker-compose.yml (ignored when a template is selected)</label>
          <textarea class="input font-mono" rows="6" formControlName="docker_compose_raw"></textarea>
        </div>
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="saving()">
          {{ saving() ? 'Creating…' : 'Create service' }}
        </button>
      </form>
    </div>
  `,
})
export class ServicesListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  protected readonly services = signal<Service[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    template: [''],
    name: ['', Validators.required],
    environment_id: [0, Validators.required],
    destination_id: [0, Validators.required],
    docker_compose_raw: [''],
  });

  ngOnInit(): void {
    this.load();
    this.api.listServiceTemplates().subscribe((t) => this.templates.set(t));
  }

  private load(): void {
    this.api.listServices().subscribe({
      next: (s) => {
        this.services.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    const v = this.form.getRawValue();
    if (!v.name) return;
    this.saving.set(true);
    this.error.set(null);
    const done = {
      next: () => {
        this.form.reset({ template: '', name: '', environment_id: 0, destination_id: 0, docker_compose_raw: '' });
        this.saving.set(false);
        this.load();
      },
      error: (e: { error?: { error?: { message?: string } } }) => {
        this.error.set(e?.error?.error?.message ?? 'Failed to create service');
        this.saving.set(false);
      },
    };
    if (v.template) {
      this.api
        .createServiceFromTemplate({
          template: v.template,
          name: v.name,
          environment_id: v.environment_id,
          destination_id: v.destination_id,
        })
        .subscribe(done);
    } else {
      this.api
        .createService({
          name: v.name,
          environment_id: v.environment_id,
          destination_id: v.destination_id,
          docker_compose_raw: v.docker_compose_raw,
        })
        .subscribe(done);
    }
  }

  protected action(svc: Service, act: 'start' | 'stop' | 'restart'): void {
    this.api.serviceLifecycle(svc.uuid, act).subscribe(() => this.load());
  }
}
