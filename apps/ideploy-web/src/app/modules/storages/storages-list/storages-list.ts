import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { S3Storage } from '../../../shared/models/ideploy.models';

/**
 * S3-compatible storages — where scheduled backups are copied off-server.
 *
 * The endpoint field is what makes this work with MinIO, Backblaze and Wasabi
 * as well as AWS, so it is offered plainly rather than hidden behind an
 * "advanced" toggle.
 */
@Component({
  selector: 'app-storages-list',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
      {{ 'storages.title' | translate }}
    </h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (storages().length === 0) {
          <div class="box">{{ 'storages.empty' | translate }}</div>
        } @else {
          <div class="space-y-3">
            @for (s of storages(); track s.uuid) {
              <div class="box flex items-center gap-3">
                <i class="fa-solid fa-box-archive" style="color:var(--color-primary-400);"></i>
                <div>
                  <div class="font-semibold">{{ s.name }}</div>
                  <div class="text-sm" style="color: var(--color-text-secondary)">
                    {{ s.region }} · {{ s.endpoint ?? 'AWS S3' }}
                  </div>
                </div>
                <button class="ml-auto text-xs" style="color:var(--color-danger);" (click)="remove(s)">
                  {{ 'storages.delete' | translate }}
                </button>
              </div>
            }
          </div>
        }
      </div>

      <form class="box space-y-3" [formGroup]="form" (ngSubmit)="submit()">
        <h2 class="text-sm font-semibold">{{ 'storages.newStorage' | translate }}</h2>
        <div>
          <label class="mb-1 block text-sm" for="s3-name">{{ 'storages.name' | translate }}</label>
          <input class="input" id="s3-name" formControlName="name" />
        </div>
        <div>
          <label class="mb-1 block text-sm" for="s3-bucket">{{ 'storages.bucket' | translate }}</label>
          <input class="input" id="s3-bucket" formControlName="bucket" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm" for="s3-region">{{ 'storages.region' | translate }}</label>
            <input class="input" id="s3-region" formControlName="region" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="s3-endpoint">{{ 'storages.endpoint' | translate }}</label>
            <input class="input" id="s3-endpoint" formControlName="endpoint" placeholder="https://…" />
          </div>
        </div>
        <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'storages.endpointHint' | translate }}</p>
        <div>
          <label class="mb-1 block text-sm" for="s3-key">{{ 'storages.accessKey' | translate }}</label>
          <input class="input font-mono" id="s3-key" autocomplete="off" formControlName="key" />
        </div>
        <div>
          <label class="mb-1 block text-sm" for="s3-secret">{{ 'storages.secretKey' | translate }}</label>
          <input class="input font-mono" id="s3-secret" type="password" autocomplete="off" formControlName="secret" />
          <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'storages.secretHint' | translate }}</p>
        </div>
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ (saving() ? 'storages.saving' : 'storages.addStorage') | translate }}
        </button>
      </form>
    </div>
  `,
})
export class StoragesListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly storages = signal<S3Storage[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    bucket: ['', Validators.required],
    region: ['us-east-1', Validators.required],
    endpoint: [''],
    key: ['', Validators.required],
    secret: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.listS3Storages().subscribe({
      next: (s) => this.storages.set(s),
      error: (e) => this.report(e, 'storages.loadError'),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.api
      .createS3Storage({ ...raw, endpoint: raw.endpoint || undefined })
      .subscribe({
        next: (s) => {
          this.storages.update((list) => [...list, s]);
          this.form.reset({ name: '', bucket: '', region: 'us-east-1', endpoint: '', key: '', secret: '' });
          this.saving.set(false);
        },
        error: (e) => {
          this.report(e, 'storages.createError');
          this.saving.set(false);
        },
      });
  }

  /** The API refuses while a backup schedule still targets it, and says so. */
  protected remove(storage: S3Storage): void {
    this.error.set(null);
    this.api.deleteS3Storage(storage.uuid).subscribe({
      next: () => this.storages.update((list) => list.filter((s) => s.uuid !== storage.uuid)),
      error: (e) => this.report(e, 'storages.deleteError'),
    });
  }
}
