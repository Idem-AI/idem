import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Service, ServiceTemplate } from '../../../shared/models/ideploy.models';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

@Component({
  selector: 'app-services-list',
  imports: [ReactiveFormsModule, TranslateModule, WorkspaceTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'services.title' | translate }}</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'services.loading' | translate }}</p>
        } @else if (services().length === 0) {
          <div class="box">{{ 'services.empty' | translate }}</div>
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
                  <button class="button-secondary" (click)="action(svc, 'stop')">{{ 'services.stop' | translate }}</button>
                  <button class="button" (click)="action(svc, 'start')">{{ 'services.start' | translate }}</button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <form class="box space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <h2 class="font-semibold">{{ 'services.deployOneClick' | translate }}</h2>
        <div>
          <label class="mb-1 block text-sm">{{ 'services.template' | translate }}</label>
          <select class="input" formControlName="template">
            <option value="">{{ 'services.customNone' | translate }}</option>
            @for (t of templates(); track t.name) {
              <option [value]="t.name">{{ t.name }} — {{ t.slogan }}</option>
            }
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm">{{ 'services.name' | translate }}</label>
          <input class="input" formControlName="name" />
        </div>

        <app-workspace-target-picker (targetChange)="target.set($event)" />

        @if (!form.controls.template.value) {
          <div>
            <label class="mb-1 block text-sm">{{ 'services.dockerComposeLabel' | translate }}</label>
            <textarea class="input font-mono" rows="6" formControlName="docker_compose_raw"></textarea>
          </div>
        }
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="!target() || saving()">
          {{ (saving() ? 'services.creating' : 'services.createService') | translate }}
        </button>
      </form>
    </div>
  `,
})
export class ServicesListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly services = signal<Service[]>([]);
  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    template: [''],
    name: ['', Validators.required],
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
    const target = this.target();
    const v = this.form.getRawValue();
    if (!v.name || !target) return;
    this.saving.set(true);
    this.error.set(null);
    const done = {
      next: () => {
        this.form.reset({ template: '', name: '', docker_compose_raw: '' });
        this.target.set(null);
        this.saving.set(false);
        this.load();
      },
      error: (e: { error?: { error?: { message?: string } } }) => {
        this.error.set(e?.error?.error?.message ?? this.translate.instant('services.createError'));
        this.saving.set(false);
      },
    };
    if (v.template) {
      this.api
        .createServiceFromTemplate({
          template: v.template,
          name: v.name,
          workspace_uuid: target.workspace_uuid,
          environment_name: target.environment_name,
          project_name: target.project_name,
        })
        .subscribe(done);
    } else {
      this.api
        .createService({
          name: v.name,
          workspace_uuid: target.workspace_uuid,
          environment_name: target.environment_name,
          project_name: target.project_name,
          docker_compose_raw: v.docker_compose_raw,
        })
        .subscribe(done);
    }
  }

  protected action(svc: Service, act: 'start' | 'stop' | 'restart'): void {
    this.api.serviceLifecycle(svc.uuid, act).subscribe(() => this.load());
  }
}
