import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-server-create',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'servers.addServerTitle' | translate }}</h1>
    <form class="box max-w-lg space-y-4" [formGroup]="form" (ngSubmit)="submit()">
      <div>
        <label class="mb-1 block text-sm">{{ 'servers.name' | translate }}</label>
        <input class="input" formControlName="name" />
      </div>
      <div>
        <label class="mb-1 block text-sm">{{ 'servers.ipAddress' | translate }}</label>
        <input class="input" formControlName="ip" />
      </div>
      <div class="flex gap-4">
        <div class="flex-1">
          <label class="mb-1 block text-sm">{{ 'servers.sshUser' | translate }}</label>
          <input class="input" formControlName="user" />
        </div>
        <div class="w-28">
          <label class="mb-1 block text-sm">{{ 'servers.port' | translate }}</label>
          <input class="input" type="number" formControlName="port" />
        </div>
      </div>
      <div>
        <label class="mb-1 block text-sm">{{ 'servers.privateKeyId' | translate }}</label>
        <input class="input" type="number" formControlName="private_key_id" />
      </div>
      @if (error()) {
        <p class="text-sm text-red-400">{{ error() }}</p>
      }
      <button class="button" type="submit" [disabled]="form.invalid || submitting()">
        {{ (submitting() ? 'servers.creating' : 'servers.createServer') | translate }}
      </button>
    </form>
  `,
})
export class ServerCreateComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ip: ['', Validators.required],
    user: ['root', Validators.required],
    port: [22, Validators.required],
    private_key_id: [0, Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api.createServer(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/servers']),
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? this.translate.instant('servers.createError'));
        this.submitting.set(false);
      },
    });
  }
}
