import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { AppVolumes, FileVolume, PersistentVolume } from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';

/**
 * What an application keeps across redeploys: persistent volumes (a folder
 * that survives the container) and mounted files (a config file written into
 * it). Two cards, because they answer two different needs.
 */
@Component({
  selector: 'app-storage-tab',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <section class="glass-card overflow-hidden">
        <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.persistentVolumes' | translate }}</h2>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.volumesHint' | translate }}</p>
        </header>

        @if (loading()) {
          <div class="px-5 py-4" aria-hidden="true"><div class="skeleton h-5 rounded"></div></div>
        } @else if ((volumes()?.persistent ?? []).length === 0) {
          <app-empty-state kind="store" [title]="'applications.detail.noVolumes' | translate" />
        } @else {
          <ul>
            @for (vol of volumes()?.persistent ?? []; track vol.id) {
              <li class="flex flex-wrap items-center gap-3 px-5 py-3" style="border-bottom:1px solid var(--glass-border-subtle);">
                <i class="pi pi-database text-xs" style="color:var(--color-text-tertiary);"></i>
                <code class="font-mono text-sm font-semibold text-text-primary">{{ vol.name }}</code>
                <i class="pi pi-arrow-right text-[10px]" style="color:var(--color-text-tertiary);"></i>
                <code class="min-w-0 flex-1 truncate font-mono text-sm" style="color:var(--color-text-secondary);">{{ vol.mount_path }}</code>
                <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-danger);"
                  [attr.aria-label]="'applications.detail.removeNamed' | translate: { name: vol.name }" (click)="removeVolume(vol)">
                  <i class="pi pi-trash text-xs"></i>
                </button>
              </li>
            }
          </ul>
        }

        <form class="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" style="background:var(--glass-bg-light);" [formGroup]="volumeForm" (ngSubmit)="addVolume()">
          <div>
            <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="vol-name">{{ 'applications.detail.volumeNameLabel' | translate }}</label>
            <input type="text" id="vol-name" [placeholder]="'applications.detail.volumeNamePlaceholder' | translate" formControlName="name" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="vol-path">{{ 'applications.detail.mountPathLabel' | translate }}</label>
            <input type="text" id="vol-path" class="font-mono text-sm" [placeholder]="'applications.detail.mountPathPlaceholder' | translate" formControlName="mount_path" />
          </div>
          <button class="inner-button" type="submit" [disabled]="volumeForm.invalid || savingVolume()">
            @if (savingVolume()) { <idem-loader size="xs" /> } @else { <i class="pi pi-plus mr-2 text-xs"></i> }
            {{ 'applications.detail.addVolume' | translate }}
          </button>
        </form>
      </section>

      <section class="glass-card overflow-hidden">
        <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.fileVolumes' | translate }}</h2>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.filesHint' | translate }}</p>
        </header>

        @if (!loading() && (volumes()?.files ?? []).length === 0) {
          <p class="px-5 py-6 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noFiles' | translate }}</p>
        } @else {
          <ul>
            @for (file of volumes()?.files ?? []; track file.id) {
              <li class="flex items-center gap-3 px-5 py-3" style="border-bottom:1px solid var(--glass-border-subtle);">
                <i class="pi pi-file text-xs" style="color:var(--color-text-tertiary);"></i>
                <code class="font-mono text-sm text-text-primary">{{ file.mount_path }}</code>
              </li>
            }
          </ul>
        }

        <form class="space-y-3 px-5 py-4" style="background:var(--glass-bg-light);" [formGroup]="fileForm" (ngSubmit)="addFile()">
          <div>
            <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="file-path">{{ 'applications.detail.mountPathLabel' | translate }}</label>
            <input type="text" id="file-path" class="font-mono text-sm" [placeholder]="'applications.detail.filePathPlaceholder' | translate" formControlName="mount_path" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="file-content">{{ 'applications.detail.fileContentLabel' | translate }}</label>
            <textarea id="file-content" rows="5" class="font-mono text-xs" [placeholder]="'applications.detail.fileContentPlaceholder' | translate" formControlName="content"></textarea>
          </div>
          <div class="flex justify-end">
            <button class="inner-button" type="submit" [disabled]="fileForm.invalid || savingFile()">
              @if (savingFile()) { <idem-loader size="xs" /> } @else { <i class="pi pi-plus mr-2 text-xs"></i> }
              {{ 'applications.detail.addFile' | translate }}
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class AppStorageTabComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly uuid = input.required<string>();

  protected readonly volumes = signal<AppVolumes | null>(null);
  protected readonly loading = signal(true);
  protected readonly savingVolume = signal(false);
  protected readonly savingFile = signal(false);

  protected readonly volumeForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mount_path: ['', Validators.required],
  });
  protected readonly fileForm = this.fb.nonNullable.group({
    mount_path: ['', Validators.required],
    content: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listVolumes(this.uuid()).subscribe({
      next: (v) => {
        this.volumes.set(v);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected addVolume(): void {
    if (this.volumeForm.invalid) return;
    this.savingVolume.set(true);
    this.api.createPersistentVolume(this.uuid(), this.volumeForm.getRawValue()).subscribe({
      next: () => {
        this.volumeForm.reset();
        this.savingVolume.set(false);
        this.load();
      },
      error: () => this.savingVolume.set(false),
    });
  }

  protected removeVolume(vol: PersistentVolume): void {
    this.api.deletePersistentVolume(this.uuid(), vol.id).subscribe(() => {
      this.volumes.update((v) => (v ? { ...v, persistent: v.persistent.filter((p) => p.id !== vol.id) } : v));
    });
  }

  protected addFile(): void {
    if (this.fileForm.invalid) return;
    this.savingFile.set(true);
    this.api.createFileVolume(this.uuid(), this.fileForm.getRawValue()).subscribe({
      next: (file: FileVolume) => {
        this.fileForm.reset();
        this.savingFile.set(false);
        this.volumes.update((v) => (v ? { ...v, files: [...v.files, file] } : v));
      },
      error: () => this.savingFile.set(false),
    });
  }
}
