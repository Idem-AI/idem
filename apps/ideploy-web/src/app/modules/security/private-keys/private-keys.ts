import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { PrivateKey } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-private-keys',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'security.privateKeys' | translate }}</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'security.loading' | translate }}</p>
        } @else if (keys().length === 0) {
          <div class="box">{{ 'security.noKeys' | translate }}</div>
        } @else {
          <div class="space-y-3">
            @for (key of keys(); track key.uuid) {
              <div class="box">
                <div class="font-semibold">{{ key.name }}</div>
                @if (key.description) {
                  <div class="text-sm" style="color: var(--color-text-secondary)">
                    {{ key.description }}
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <form class="box space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        <h2 class="font-semibold">{{ 'security.addKeyTitle' | translate }}</h2>
        <div>
          <label class="mb-1 block text-sm">{{ 'security.name' | translate }}</label>
          <input class="input" formControlName="name" />
        </div>
        <div>
          <label class="mb-1 block text-sm">{{ 'security.privateKeyPem' | translate }}</label>
          <textarea class="input font-mono" rows="6" formControlName="private_key"></textarea>
        </div>
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? ('security.saving' | translate) : ('security.addKey' | translate) }}
        </button>
      </form>
    </div>
  `,
})
export class PrivateKeysComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly keys = signal<PrivateKey[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    private_key: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listPrivateKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.createPrivateKey(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset();
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? this.translate.instant('security.addKeyFailed'));
        this.saving.set(false);
      },
    });
  }
}
